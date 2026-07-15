/** Fecha de nacimiento: día / mes / año (2026 → 1910). */

export const BIRTH_YEAR_MAX = 2026;
export const BIRTH_YEAR_MIN = 1910;

export const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const SEXOS = ["Masculino", "Femenino"] as const;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function yearOptionsHtml(selected?: number): string {
  const sel = selected ?? 1990;
  let html = `<option value="">Año</option>`;
  for (let y = BIRTH_YEAR_MAX; y >= BIRTH_YEAR_MIN; y--) {
    html += `<option value="${y}" ${y === sel ? "selected" : ""}>${y}</option>`;
  }
  return html;
}

export function monthOptionsHtml(selected?: number): string {
  let html = `<option value="">Mes</option>`;
  MONTH_NAMES_ES.forEach((name, i) => {
    const m = i + 1;
    html += `<option value="${m}" ${m === selected ? "selected" : ""}>${name}</option>`;
  });
  return html;
}

export function dayOptionsHtml(year: number, month: number, selected?: number): string {
  const max = year && month ? daysInMonth(year, month) : 31;
  let html = `<option value="">Día</option>`;
  for (let d = 1; d <= max; d++) {
    html += `<option value="${d}" ${d === selected ? "selected" : ""}>${d}</option>`;
  }
  return html;
}

export function sexOptionsHtml(selected?: string): string {
  let html = `<option value="">Seleccione…</option>`;
  for (const s of SEXOS) {
    html += `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`;
  }
  return html;
}

/** HTML de los 3 selects de fecha de nacimiento. */
export function birthDateFieldsHtml(prefix = "nac"): string {
  return `
    <fieldset class="birth-date-fieldset">
      <legend>Fecha de nacimiento</legend>
      <div class="birth-date-row">
        <label>Día
          <select name="${prefix}Dia" id="${prefix}-dia" required>
            ${dayOptionsHtml(1990, 1)}
          </select>
        </label>
        <label>Mes
          <select name="${prefix}Mes" id="${prefix}-mes" required>
            ${monthOptionsHtml()}
          </select>
        </label>
        <label>Año
          <select name="${prefix}Anio" id="${prefix}-anio" required>
            ${yearOptionsHtml(1990)}
          </select>
        </label>
      </div>
    </fieldset>
  `;
}

export function bindBirthDateSelects(root: ParentNode, prefix = "nac"): void {
  const day = root.querySelector(`#${prefix}-dia`) as HTMLSelectElement | null;
  const month = root.querySelector(`#${prefix}-mes`) as HTMLSelectElement | null;
  const year = root.querySelector(`#${prefix}-anio`) as HTMLSelectElement | null;
  if (!day || !month || !year) return;

  const refreshDays = () => {
    const y = Number(year.value) || 1990;
    const m = Number(month.value) || 1;
    const prev = Number(day.value) || 1;
    const max = daysInMonth(y, m);
    day.innerHTML = dayOptionsHtml(y, m, Math.min(prev, max));
  };

  month.addEventListener("change", refreshDays);
  year.addEventListener("change", refreshDays);
}

export function parseBirthFromForm(fd: FormData, prefix = "nac"): { iso: string; age: number } {
  const day = Number(fd.get(`${prefix}Dia`));
  const month = Number(fd.get(`${prefix}Mes`));
  const year = Number(fd.get(`${prefix}Anio`));
  if (!day || !month || !year) throw new Error("Seleccione día, mes y año de nacimiento");
  if (year < BIRTH_YEAR_MIN || year > BIRTH_YEAR_MAX) {
    throw new Error(`El año debe estar entre ${BIRTH_YEAR_MIN} y ${BIRTH_YEAR_MAX}`);
  }
  const max = daysInMonth(year, month);
  if (day < 1 || day > max) throw new Error("Día de nacimiento inválido");
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00.000Z`;
  return { iso, age: calcAgeFromParts(year, month, day) };
}

export function calcAgeFromParts(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1;
  const d = today.getDate();
  if (m < month || (m === month && d < day)) age -= 1;
  return Math.max(0, age);
}
