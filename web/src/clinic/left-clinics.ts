/** Clínicas que el médico dejó voluntariamente (no re-heal / no aviso “te ha agregado”). */
const KEY_LEFT = "clinic_left_ids_v1";

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY_LEFT);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>): void {
  localStorage.setItem(KEY_LEFT, JSON.stringify([...ids]));
}

export function loadLeftClinicIds(): Set<string> {
  return readIds();
}

export function markClinicLeftLocal(clinicId: string): void {
  const id = clinicId.trim();
  if (!id) return;
  const next = readIds();
  next.add(id);
  writeIds(next);
}

export function clearClinicLeftLocal(clinicId: string): void {
  const id = clinicId.trim();
  if (!id) return;
  const next = readIds();
  next.delete(id);
  writeIds(next);
}

export function filterOutLeftClinics<T extends { clinicId: string }>(list: T[]): T[] {
  const left = readIds();
  if (!left.size) return list;
  return list.filter((m) => !left.has(m.clinicId));
}

export function clearAllLeftClinicsLocal(): void {
  localStorage.removeItem(KEY_LEFT);
}
