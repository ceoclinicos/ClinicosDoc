export function normalizeCedula(input: string): string {
  return input.trim().toUpperCase().replace(/[\s.-]/g, "");
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
