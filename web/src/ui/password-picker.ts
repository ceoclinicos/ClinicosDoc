/** Selector de contraseña: letra (A-Z) + combinación de 6 dígitos → "A123456". */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * HTML del campo de contraseña.
 * allowLegacy: incluye la opción "—" (sin letra) para PINs viejos de solo dígitos.
 */
export function passwordFieldHtml(opts: { allowLegacy?: boolean } = {}): string {
  const options = [
    opts.allowLegacy ? `<option value="">—</option>` : `<option value="" disabled selected>Letra</option>`,
    ...LETTERS.map((l) => `<option value="${l}">${l}</option>`),
  ].join("");
  return `
    <label>Contraseña
      <span class="password-picker">
        <select name="pinLetter" class="pin-letter" required${opts.allowLegacy ? "" : " title=\"Elija una letra\""}>${options}</select>
        <input name="pinDigits" class="pin-digits" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" minlength="4" required placeholder="6 dígitos" autocomplete="${opts.allowLegacy ? "current-password" : "new-password"}" />
      </span>
    </label>
  `;
}

/**
 * Compone la contraseña a partir del formulario.
 * Con letra: exige 6 dígitos → "A123456". Sin letra (legado): 4 o 6 dígitos.
 */
export function readPasswordFromForm(fd: FormData): string {
  const letter = String(fd.get("pinLetter") ?? "").trim().toUpperCase();
  const digits = String(fd.get("pinDigits") ?? "").trim();
  if (letter) {
    if (!/^[A-Z]$/.test(letter)) throw new Error("Elija la letra de su contraseña");
    if (!/^\d{6}$/.test(digits)) throw new Error("Escriba los 6 dígitos de su contraseña");
    return letter + digits;
  }
  if (!/^\d{4}$|^\d{6}$/.test(digits)) {
    throw new Error("El PIN debe tener 4 o 6 dígitos");
  }
  return digits;
}
