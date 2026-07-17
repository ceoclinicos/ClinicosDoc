/** Variantes de documento para buscar en Firestore (V-23536843, V23536843, 23536843, E…). */
export function cedulaLookupKeys(input: string): string[] {
  const raw = input.trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!raw) return [];
  const keys = new Set<string>([raw]);
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6 && digits.length <= 9) {
    keys.add(digits);
    keys.add("V" + digits);
    keys.add("E" + digits);
  }
  if (/^V\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
  if (/^E\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
  // Variante con guion (docs antiguos)
  if (/^V\d+$/.test(raw)) keys.add("V-" + raw.slice(1));
  if (/^E\d+$/.test(raw)) keys.add("E-" + raw.slice(1));
  if (digits) keys.add("V-" + digits);
  return [...keys];
}

export function normalizeCedula(input: string): string {
  const raw = input.trim().toUpperCase().replace(/[\s.-]/g, "");
  if (/^\d{6,9}$/.test(raw)) return "V" + raw;
  return raw;
}

export function matchesCedula(patientCedula: string, query: string): boolean {
  const q = normalizeCedula(query);
  if (!q) return true;
  return normalizeCedula(patientCedula).includes(q);
}

export function findPatientByCedula<T extends { cedula: string }>(
  patients: T[],
  query: string,
): T | undefined {
  const q = normalizeCedula(query);
  if (!q) return undefined;
  return patients.find((p) => normalizeCedula(p.cedula) === q);
}
