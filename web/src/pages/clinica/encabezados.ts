import { registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import {
  deleteClinicHeader,
  listClinicHeaders,
  upsertClinicHeader,
} from "../../clinic/store";
import type { DocumentHeader } from "../../shared/models";
import { fileToLogoBase64, logoDataUrl } from "../../services/header-logo";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/clinica/encabezados",
  title: "Encabezados",
  clinicOnly: true,
  render: () => {
    const session = getClinicSession()!;
    let headers: DocumentHeader[] = [];
    let draftLogoBase64: string | undefined;

    const el = page(
      "Encabezados del centro",
      `
      <p class="muted"><a href="#/clinica/plantillas">← Plantillas</a></p>
      <p class="lead">Logo y membrete institucional para los PDF del centro.</p>
      <ul class="list" id="headers-list"></ul>
      <button type="button" class="btn btn-secondary" id="btn-add">+ Nuevo encabezado</button>
      <div id="status" class="muted" style="margin-top:0.75rem"></div>
      <dialog id="edit-dialog">
        <form method="dialog" class="form" id="edit-form">
          <h2 id="dialog-title">Editar encabezado</h2>
          <input type="hidden" name="id" />
          <label>Nombre de la plantilla<input name="name" required /></label>
          <label>Título — Nombre del centro<input name="doctorName" required /></label>
          <label>Subtítulo — dirección o servicios<input name="subtitle" /></label>
          <label>Complemento — RIF u otro dato<textarea name="description" rows="3"></textarea></label>
          <label>Logo
            <input type="file" name="logo" id="logo-input" accept="image/*" />
          </label>
          <div id="logo-preview" class="header-logo-preview" hidden></div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-logo" hidden>Quitar logo</button>
          <label class="check-row"><input type="checkbox" name="isDefault" /> Predeterminado</label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="cancel-edit">Cancelar</button>
            <button type="button" class="btn btn-ghost" id="btn-delete" hidden>Eliminar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </dialog>
      `,
    );

    const list = el.querySelector("#headers-list") as HTMLElement;
    const status = el.querySelector("#status") as HTMLElement;
    const dialog = el.querySelector("#edit-dialog") as HTMLDialogElement;
    const form = el.querySelector("#edit-form") as HTMLFormElement;
    const btnDelete = el.querySelector("#btn-delete") as HTMLButtonElement;
    const logoInput = el.querySelector("#logo-input") as HTMLInputElement;
    const logoPreview = el.querySelector("#logo-preview") as HTMLElement;
    const btnClearLogo = el.querySelector("#btn-clear-logo") as HTMLButtonElement;

    function setLogoPreview(base64?: string): void {
      draftLogoBase64 = base64;
      const src = logoDataUrl(base64);
      if (src) {
        logoPreview.innerHTML = `<img src="${src}" alt="Logo" width="64" height="64" />`;
        logoPreview.hidden = false;
        btnClearLogo.hidden = false;
      } else {
        logoPreview.innerHTML = "";
        logoPreview.hidden = true;
        btnClearLogo.hidden = true;
      }
    }

    async function refresh(): Promise<void> {
      try {
        headers = await listClinicHeaders(session.clinicId);
        status.textContent = headers.length ? `${headers.length} encabezado(s)` : "Sin encabezados aún.";
        list.innerHTML = headers
          .map(
            (h) => `
          <li class="list-item list-item-action" data-id="${h.id}">
            <div>
              <strong>${escapeHtml(h.name)}</strong>
              <p class="muted">${escapeHtml(h.doctorName || session.nombre)} · ${escapeHtml(h.subtitle || "—")}</p>
              ${h.isDefault ? `<span class="status-badge status-ok">Predeterminado</span>` : ""}
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${h.id}">Editar</button>
          </li>`,
          )
          .join("");
        list.querySelectorAll("[data-edit], .list-item-action").forEach((node) => {
          node.addEventListener("click", (e) => {
            e.stopPropagation();
            const id =
              (node as HTMLElement).getAttribute("data-edit") ||
              (node as HTMLElement).getAttribute("data-id");
            const h = headers.find((x) => x.id === id);
            if (h) openEdit(h);
          });
        });
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Error al cargar";
      }
    }

    function openEdit(h: DocumentHeader, isNew = false): void {
      (form.elements.namedItem("id") as HTMLInputElement).value = h.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = h.name;
      (form.elements.namedItem("doctorName") as HTMLInputElement).value = h.doctorName ?? "";
      (form.elements.namedItem("subtitle") as HTMLInputElement).value = h.subtitle ?? "";
      (form.elements.namedItem("description") as HTMLTextAreaElement).value = h.description ?? "";
      (form.elements.namedItem("isDefault") as HTMLInputElement).checked = h.isDefault;
      logoInput.value = "";
      setLogoPreview(h.logoBase64);
      btnDelete.hidden = isNew || headers.length <= 1;
      dialog.showModal();
    }

    el.querySelector("#btn-add")?.addEventListener("click", () => {
      openEdit(
        {
          id: crypto.randomUUID(),
          name: "Encabezado institucional",
          doctorName: session.nombre,
          subtitle: "",
          description: session.rif ? `RIF ${session.rif}` : "",
          isDefault: headers.length === 0,
        },
        true,
      );
    });

    logoInput.addEventListener("change", async () => {
      const file = logoInput.files?.[0];
      if (!file) return;
      try {
        setLogoPreview(await fileToLogoBase64(file));
      } catch (err) {
        logoInput.value = "";
        alert(err instanceof Error ? err.message : "No se pudo cargar el logo");
      }
    });

    btnClearLogo.addEventListener("click", () => {
      logoInput.value = "";
      setLogoPreview(undefined);
    });

    el.querySelector("#cancel-edit")?.addEventListener("click", () => dialog.close());
    btnDelete.addEventListener("click", async () => {
      const id = (form.elements.namedItem("id") as HTMLInputElement).value;
      if (!confirm("¿Eliminar este encabezado?")) return;
      try {
        await deleteClinicHeader(session.clinicId, id);
        dialog.close();
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo eliminar");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await upsertClinicHeader(session.clinicId, {
          id: String(fd.get("id")),
          name: String(fd.get("name")).trim(),
          doctorName: String(fd.get("doctorName")).trim(),
          subtitle: String(fd.get("subtitle")).trim(),
          description: String(fd.get("description")).trim(),
          isDefault: (form.elements.namedItem("isDefault") as HTMLInputElement).checked,
          logoBase64: draftLogoBase64,
        });
        dialog.close();
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });

    void refresh();
    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
