/** Variantes de documento para buscar en Firestore (V-23536843, V23536843, 23536843). */
export function cedulaLookupKeys(input: string): string[] {
  const raw = input.trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!raw) return [];
  const keys = new Set<string>([raw]);
  if (/^\d{6,9}$/.test(raw)) keys.add("V" + raw);
  if (/^V\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
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
