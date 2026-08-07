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

/** V = venezolano (default), E = extranjero. */
export type CedulaLetter = "V" | "E";

export function composeCedula(letter: string, digitsInput: string): string {
  const digits = String(digitsInput).replace(/\D/g, "");
  if (!digits) return "";
  const L: CedulaLetter = String(letter).toUpperCase() === "E" ? "E" : "V";
  return `${L}${digits}`;
}

/** Lee selector V/E + números desde un FormData. */
export function readCedulaFromForm(
  fd: FormData,
  opts?: { letterName?: string; digitsName?: string },
): string {
  return composeCedula(
    String(fd.get(opts?.letterName ?? "cedulaLetter") || "V"),
    String(fd.get(opts?.digitsName ?? "cedula") || ""),
  );
}

/** Campo cédula: lista V/E (V default) + solo números. */
export function cedulaFieldHtml(opts?: {
  letterName?: string;
  digitsName?: string;
  required?: boolean;
  autocomplete?: string;
  id?: string;
}): string {
  const letterName = opts?.letterName ?? "cedulaLetter";
  const digitsName = opts?.digitsName ?? "cedula";
  const req = opts?.required === false ? "" : "required";
  const ac = opts?.autocomplete ? ` autocomplete="${opts.autocomplete}"` : "";
  const idAttr = opts?.id ? ` id="${opts.id}"` : "";
  return `
    <label>Cédula
      <span class="cedula-field">
        <select name="${letterName}" aria-label="Tipo de cédula (V o E)">
          <option value="V" selected>V</option>
          <option value="E">E</option>
        </select>
        <input name="${digitsName}"${idAttr} ${req} inputmode="numeric" pattern="[0-9]{6,9}" minlength="6" maxlength="9" placeholder="Solo números" ${ac} />
      </span>
    </label>`;
}

export function normalizeCedula(input: string): string {
  const raw = input.trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!raw) return "";
  if (/^[VE]\d{6,9}$/.test(raw)) return raw;
  if (/^\d{6,9}$/.test(raw)) return "V" + raw;
  const digits = raw.replace(/\D/g, "");
  if (/^[VE]/.test(raw) && digits.length >= 6) {
    return raw[0] + digits;
  }
  if (digits.length >= 6 && digits.length <= 9) return "V" + digits;
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
