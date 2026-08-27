/** Estado de sincronización local → nube (documentos y plantillas). */
import { loadJson, saveJson } from "./local-store";
import { canSync, pushDocument, pushHeader, pushTemplate } from "./cloud-sync";
import { loadDocuments, loadHeaders, loadTemplates } from "./clinical-store";

const KEY = "pending_cloud_sync_v1";
const LAST_FLUSH_KEY = "pending_cloud_sync_last_flush_ms";
/** Evita ráfagas: como mucho un flush cada 45 s. */
const MIN_FLUSH_INTERVAL_MS = 45_000;

export type PendingSyncKind = "document" | "template" | "header";

export type PendingSyncItem = {
  kind: PendingSyncKind;
  id: string;
  label: string;
  updatedAt: string;
};

function load(): PendingSyncItem[] {
  return loadJson<PendingSyncItem[]>(KEY, []);
}

function save(items: PendingSyncItem[]): void {
  saveJson(KEY, items);
}

export function listPendingSync(): PendingSyncItem[] {
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function pendingSyncCount(): number {
  return load().length;
}

export function markPendingSync(kind: PendingSyncKind, id: string, label: string): void {
  const next = load().filter((x) => !(x.kind === kind && x.id === id));
  next.push({ kind, id, label, updatedAt: new Date().toISOString() });
  save(next);
  emitSyncStatus();
}

export function clearPendingSync(kind: PendingSyncKind, id: string): void {
  save(load().filter((x) => !(x.kind === kind && x.id === id)));
  emitSyncStatus();
}

type SyncListener = (pending: PendingSyncItem[]) => void;
const listeners = new Set<SyncListener>();

export function subscribeSyncStatus(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(listPendingSync());
  return () => listeners.delete(fn);
}

function emitSyncStatus(): void {
  const pending = listPendingSync();
  listeners.forEach((fn) => fn(pending));
}

/** Toast flotante breve (no bloquea). */
export function showSyncToast(message: string, tone: "ok" | "warn" | "err" = "ok"): void {
  if (typeof document === "undefined") return;
  let host = document.getElementById("sync-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "sync-toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `sync-toast sync-toast-${tone}`;
  el.textContent = message;
  host.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("sync-toast-out");
    window.setTimeout(() => el.remove(), 280);
  }, 2800);
}

/**
 * Ejecuta sync en segundo plano con feedback.
 * @returns mensaje inmediato para el alert/toast de “guardado”
 */
export function syncWithFeedback(
  kind: PendingSyncKind,
  id: string,
  label: string,
  canSyncNow: boolean,
  online: boolean,
  push: () => Promise<void>,
): string {
  if (!canSyncNow || !online) {
    markPendingSync(kind, id, label);
    const msg = "Sin conexión, se enviará luego";
    showSyncToast(msg, "warn");
    return msg;
  }
  markPendingSync(kind, id, label);
  showSyncToast("Sincronizando…", "ok");
  void push()
    .then(() => {
      clearPendingSync(kind, id);
      showSyncToast("Guardado en la nube", "ok");
    })
    .catch((err) => {
      console.warn("[sync]", err);
      markPendingSync(kind, id, label);
      showSyncToast("No sincronizado; pendiente de enviar", "err");
    });
  return "Guardado. Sincronizando…";
}

let flushing = false;
let started = false;

/**
 * Solo reenvía lo pendiente (no todo el catálogo) → poco tráfico.
 * Un ítem tras otro; toast único al final.
 */
export async function flushPendingCloudSync(opts?: {
  force?: boolean;
  quiet?: boolean;
}): Promise<number> {
  if (flushing) return 0;
  if (!canSync()) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const pending = listPendingSync();
  if (!pending.length) return 0;

  const last = Number(localStorage.getItem(LAST_FLUSH_KEY) || 0);
  if (!opts?.force && Date.now() - last < MIN_FLUSH_INTERVAL_MS) return 0;

  flushing = true;
  let ok = 0;
  try {
    for (const item of pending) {
      try {
        if (item.kind === "document") {
          const doc = loadDocuments().find((d) => d.id === item.id);
          if (!doc) {
            clearPendingSync(item.kind, item.id);
            continue;
          }
          await pushDocument(doc);
        } else if (item.kind === "template") {
          const tpl = loadTemplates().find((t) => t.id === item.id);
          if (!tpl) {
            clearPendingSync(item.kind, item.id);
            continue;
          }
          await pushTemplate(tpl);
        } else {
          const hdr = loadHeaders().find((h) => h.id === item.id);
          if (!hdr) {
            clearPendingSync(item.kind, item.id);
            continue;
          }
          await pushHeader(hdr);
        }
        clearPendingSync(item.kind, item.id);
        ok += 1;
      } catch (err) {
        console.warn("[flush-pending]", item.kind, item.id, err);
      }
    }
    localStorage.setItem(LAST_FLUSH_KEY, String(Date.now()));
    if (ok > 0 && !opts?.quiet) {
      showSyncToast(
        ok === 1 ? "1 pendiente enviado a la nube" : `${ok} pendientes enviados a la nube`,
        "ok",
      );
    }
  } finally {
    flushing = false;
  }
  return ok;
}

/** Arranca reintento al recuperar red y un flush suave al cargar. */
export function startPendingSyncWatcher(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    void flushPendingCloudSync({ force: true });
  });
  window.setTimeout(() => {
    if (pendingSyncCount() > 0) void flushPendingCloudSync({ quiet: true });
  }, 2500);
}
