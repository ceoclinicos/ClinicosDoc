import type { PatientMembrete } from "../shared/models";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Formulario editable del membrete (paridad PatientMembreteEditor Android). */
export function membreteEditorHtml(membrete: PatientMembrete): string {
  return `
    <fieldset class="card-panel" id="membrete-editor">
      <legend><strong>Identificación del paciente</strong></legend>
      <p class="muted">La fecha del informe va arriba a la derecha, encima del encabezado.</p>
      <label>Fecha del informe
        <input type="text" name="mFecha" class="m-fecha" value="${escapeHtml(membrete.fecha)}" placeholder="dd/MM/yyyy" />
      </label>
      <div class="grid-2">
        <label>Nombre
          <input type="text" name="mNombre" class="m-nombre" value="${escapeHtml(membrete.nombre)}" />
        </label>
        <label>Edad
          <input type="text" name="mEdad" class="m-edad" value="${escapeHtml(membrete.edad)}" />
        </label>
      </div>
      <div class="grid-2">
        <label>Sexo
          <input type="text" name="mSexo" class="m-sexo" value="${escapeHtml(membrete.sexo)}" />
        </label>
        <label>F. nacimiento
          <input type="text" name="mNac" class="m-nac" value="${escapeHtml(membrete.fechaNacimiento)}" placeholder="dd/MM/yyyy" />
        </label>
      </div>
    </fieldset>`;
}

export function readMembreteFromEditor(root: HTMLElement, fallback: PatientMembrete): PatientMembrete {
  const box = root.querySelector("#membrete-editor");
  if (!box) return fallback;
  return {
    nombre: (box.querySelector(".m-nombre") as HTMLInputElement)?.value.trim() || fallback.nombre,
    edad: (box.querySelector(".m-edad") as HTMLInputElement)?.value.trim() || fallback.edad,
    sexo: (box.querySelector(".m-sexo") as HTMLInputElement)?.value.trim() || fallback.sexo,
    fechaNacimiento:
      (box.querySelector(".m-nac") as HTMLInputElement)?.value.trim() || fallback.fechaNacimiento,
    fecha: (box.querySelector(".m-fecha") as HTMLInputElement)?.value.trim() || fallback.fecha,
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
