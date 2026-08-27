/** Cola local con reintentos para informes que deben llegar a la clínica. */
import type { ClinicalDocument } from "../shared/models";
import { pushClinicDocument } from "../clinic/store";
import { loadJson, saveJson } from "./local-store";

const KEY = "clinic_doc_push_queue";
const KEY_FAILED = "clinic_doc_push_failed_v1";
const MAX_ATTEMPTS = 6;

interface QueueItem {
  clinicId: string;
  doctorNombre: string;
  document: ClinicalDocument;
  attempts: number;
  nextAt: number;
}

export type ClinicDocSyncFailure = {
  documentId: string;
  clinicId: string;
  clinicName: string;
  patientNombre: string;
  message: string;
  at: string;
};

let flushing = false;
let started = false;

function loadQueue(): QueueItem[] {
  return loadJson<QueueItem[]>(KEY, []);
}

function saveQueue(items: QueueItem[]): void {
  saveJson(KEY, items);
}

function loadFailures(): ClinicDocSyncFailure[] {
  return loadJson<ClinicDocSyncFailure[]>(KEY_FAILED, []);
}

function saveFailures(items: ClinicDocSyncFailure[]): void {
  saveJson(KEY_FAILED, items);
}

function backoffMs(attempts: number): number {
  // 2s, 4s, 8s, 16s, 32s, 60s
  return Math.min(60_000, 2000 * 2 ** Math.max(0, attempts - 1));
}

function notifyFailure(item: QueueItem): void {
  const clinicName = item.document.clinicName || "el centro";
  const patientNombre = item.document.patientNombre || "el paciente";
  const message =
    `No se pudo enviar el informe de ${patientNombre} a «${clinicName}». ` +
    "Revise la conexión e intente guardar de nuevo.";
  const failure: ClinicDocSyncFailure = {
    documentId: item.document.id,
    clinicId: item.clinicId,
    clinicName,
    patientNombre,
    message,
    at: new Date().toISOString(),
  };
  const next = loadFailures().filter((f) => f.documentId !== failure.documentId).concat(failure);
  saveFailures(next);
  try {
    alert(message);
  } catch {
    /* ignore */
  }
}

export function consumeClinicDocSyncFailures(): ClinicDocSyncFailure[] {
  const list = loadFailures();
  if (list.length) saveFailures([]);
  return list;
}

export function enqueueClinicDocumentPush(
  clinicId: string,
  document: ClinicalDocument,
  doctorNombre: string,
): void {
  if (!clinicId) return;
  const q = loadQueue().filter((x) => x.document.id !== document.id);
  q.push({
    clinicId,
    doctorNombre,
    document,
    attempts: 0,
    nextAt: Date.now(),
  });
  saveQueue(q);
  void flushClinicDocumentQueue();
}

export async function flushClinicDocumentQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let q = loadQueue();
    const now = Date.now();
    const ready = q.filter((x) => x.nextAt <= now);
    const deferred = q.filter((x) => x.nextAt > now);
    const remaining: QueueItem[] = [...deferred];

    for (const item of ready) {
      try {
        await pushClinicDocument(item.clinicId, item.document, item.doctorNombre);
        saveFailures(loadFailures().filter((f) => f.documentId !== item.document.id));
      } catch (err) {
        console.warn("[clinic-doc-sync]", err);
        const attempts = item.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          remaining.push({
            ...item,
            attempts,
            nextAt: Date.now() + backoffMs(attempts),
          });
        } else {
          notifyFailure(item);
        }
      }
    }
    saveQueue(remaining);

    const nextWait = remaining
      .map((x) => x.nextAt - Date.now())
      .filter((ms) => ms > 0)
      .sort((a, b) => a - b)[0];
    if (nextWait != null) {
      window.setTimeout(() => void flushClinicDocumentQueue(), nextWait + 50);
    }
  } finally {
    flushing = false;
  }
}

export function startClinicDocumentSyncWatcher(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void flushClinicDocumentQueue());
  void flushClinicDocumentQueue();
  // Mostrar fallos pendientes al abrir la app
  window.setTimeout(() => {
    const failed = consumeClinicDocSyncFailures();
    for (const f of failed) {
      try {
        alert(f.message);
      } catch {
        /* ignore */
      }
    }
  }, 800);
}
