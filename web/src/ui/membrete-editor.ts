import type { DocumentType, PatientMembrete } from "../shared/models";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Formulario editable del membrete (paridad PatientMembreteEditor Android). */
export function membreteEditorHtml(membrete: PatientMembrete, documentType?: DocumentType): string {
  const extendedHistoria = documentType === "historiaClinica";
  const historiaFields = extendedHistoria
    ? `
      <div class="grid-2">
        <label>Teléfono
          <input type="tel" name="mTelefono" class="m-telefono" value="${escapeHtml(membrete.telefono || "")}" />
        </label>
        <label>Ocupación
          <input type="text" name="mOcupacion" class="m-ocupacion" value="${escapeHtml(membrete.ocupacion || "")}" />
        </label>
      </div>
      <label>Dirección
        <input type="text" name="mDireccion" class="m-direccion" value="${escapeHtml(membrete.direccion || "")}" />
      </label>
      <p class="muted" style="margin:0.75rem 0 0.35rem"><strong>Acompañante</strong></p>
      <div class="grid-2">
        <label class="span-2">Nombre
          <input type="text" name="mAcompNombre" class="m-acomp-nombre" value="${escapeHtml(membrete.acompananteNombre || "")}" />
        </label>
        <label>Teléfono
          <input type="tel" name="mAcompTel" class="m-acomp-tel" value="${escapeHtml(membrete.acompananteTelefono || "")}" />
        </label>
      </div>`
    : "";
  return `
    <fieldset class="card-panel" id="membrete-editor">
      <legend><strong>Identificación del paciente</strong></legend>
      <p class="muted">La fecha del informe va arriba a la derecha, encima del encabezado.</p>
      <div class="grid-2">
        <label>Fecha del informe
          <input type="text" name="mFecha" class="m-fecha" value="${escapeHtml(membrete.fecha)}" placeholder="dd/MM/yyyy" />
        </label>
        <label>F. nacimiento
          <input type="text" name="mNac" class="m-nac" value="${escapeHtml(membrete.fechaNacimiento)}" placeholder="dd/MM/yyyy" />
        </label>
      </div>
      <label>Nombre
        <input type="text" name="mNombre" class="m-nombre" value="${escapeHtml(membrete.nombre)}" />
      </label>
      <div class="grid-2">
        <label>Cédula
          <input type="text" name="mCedula" class="m-cedula" value="${escapeHtml(membrete.cedula || "")}" />
        </label>
        <label>Sexo
          <input type="text" name="mSexo" class="m-sexo" value="${escapeHtml(membrete.sexo)}" />
        </label>
        <label>Edad
          <input type="text" name="mEdad" class="m-edad" value="${escapeHtml(membrete.edad)}" />
        </label>
        <span></span>
      </div>
      ${historiaFields}
    </fieldset>`;
}

export function readMembreteFromEditor(root: HTMLElement, fallback: PatientMembrete): PatientMembrete {
  const box = root.querySelector("#membrete-editor");
  if (!box) return fallback;
  return {
    nombre: (box.querySelector(".m-nombre") as HTMLInputElement)?.value.trim() || fallback.nombre,
    edad: (box.querySelector(".m-edad") as HTMLInputElement)?.value.trim() || fallback.edad,
    cedula: (box.querySelector(".m-cedula") as HTMLInputElement)?.value.trim() || fallback.cedula || "",
    sexo: (box.querySelector(".m-sexo") as HTMLInputElement)?.value.trim() || fallback.sexo,
    fechaNacimiento:
      (box.querySelector(".m-nac") as HTMLInputElement)?.value.trim() || fallback.fechaNacimiento,
    fecha: (box.querySelector(".m-fecha") as HTMLInputElement)?.value.trim() || fallback.fecha,
    telefono: (box.querySelector(".m-telefono") as HTMLInputElement)?.value.trim() || fallback.telefono || "",
    direccion: (box.querySelector(".m-direccion") as HTMLInputElement)?.value.trim() || fallback.direccion || "",
    ocupacion: (box.querySelector(".m-ocupacion") as HTMLInputElement)?.value.trim() || fallback.ocupacion || "",
    acompananteNombre:
      (box.querySelector(".m-acomp-nombre") as HTMLInputElement)?.value.trim() ||
      fallback.acompananteNombre ||
      "",
    acompananteTelefono:
      (box.querySelector(".m-acomp-tel") as HTMLInputElement)?.value.trim() ||
      fallback.acompananteTelefono ||
      "",
  };
}

export function bindMembreteEditor(
  root: HTMLElement,
  onChange: (m: PatientMembrete) => void,
  current: () => PatientMembrete,
): void {
  const box = root.querySelector("#membrete-editor");
  if (!box) return;
  const emit = () => onChange(readMembreteFromEditor(root, current()));
  box.addEventListener("input", emit);
  box.addEventListener("change", emit);
}
