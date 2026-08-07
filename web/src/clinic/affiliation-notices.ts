/** Avisos cuando una clínica agrega o quita al médico del equipo. */
const KEY_MEMBERSHIPS = "clinic_memberships_snapshot_v1";
const KEY_BASELINE = "clinic_memberships_baseline_v1";
const KEY_PENDING = "clinic_affiliation_notices_v1";

export type ClinicMembershipSnap = { clinicId: string; clinicName: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadMembershipSnapshot(): ClinicMembershipSnap[] {
  return readJson(KEY_MEMBERSHIPS, []);
}

export function applyMembershipSnapshot(next: ClinicMembershipSnap[]): string[] {
  const previous = loadMembershipSnapshot();
  const hadBaseline = localStorage.getItem(KEY_BASELINE) === "1";
  writeJson(KEY_MEMBERSHIPS, next);
  if (!hadBaseline) {
    localStorage.setItem(KEY_BASELINE, "1");
    return [];
  }
  const prevIds = new Set(previous.map((m) => m.clinicId));
  const nextIds = new Set(next.map((m) => m.clinicId));
  const notices: string[] = [];
  for (const m of next) {
    if (!prevIds.has(m.clinicId)) {
      notices.push(`La clínica «${m.clinicName}» te ha agregado a su equipo.`);
    }
  }
  for (const m of previous) {
    if (!nextIds.has(m.clinicId)) {
      notices.push(`La clínica «${m.clinicName}» te ha quitado de su equipo.`);
    }
  }
  if (notices.length) {
    const pending = [...loadPendingNotices(), ...notices];
    writeJson(KEY_PENDING, pending);
  }
  return notices;
}

export function loadPendingNotices(): string[] {
  return readJson(KEY_PENDING, []);
}

export function dismissCurrentNotice(): void {
  writeJson(KEY_PENDING, loadPendingNotices().slice(1));
}

export function clearAffiliationNotices(): void {
  localStorage.removeItem(KEY_MEMBERSHIPS);
  localStorage.removeItem(KEY_BASELINE);
  localStorage.removeItem(KEY_PENDING);
}

/** Muestra avisos pendientes uno a uno con botón OK. */
export function showPendingAffiliationNotices(): void {
  const showNext = () => {
    const pending = loadPendingNotices();
    if (!pending.length) return;
    const msg = pending[0];
    const dialog = document.createElement("dialog");
    dialog.className = "sheet-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="sheet-body">
        <h2>Equipo clínico</h2>
        <p>${msg.replace(/</g, "&lt;")}</p>
        <button type="submit" class="btn btn-primary" value="ok">OK</button>
      </form>
    `;
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => {
      dismissCurrentNotice();
      dialog.remove();
      showNext();
    });
    dialog.showModal();
  };
  showNext();
}
