import { registerRoute, navigate } from "../app/router";
import { deleteDraft, loadDrafts } from "../services/clinical-store";
import { DocumentTypeLabels } from "../shared/models";
import { bindNavButtons, emptyState, page } from "./helpers";

registerRoute({
  path: "/borradores",
  title: "Borradores",
  medicoOnly: true,
  render: () => {
    const drafts = loadDrafts();
    const body =
      drafts.length === 0
        ? emptyState("Sin borradores. Se guardan al redactar.", "Redactar", "/")
        : `<ul class="list">${drafts
            .map(
              (d) => `
            <li class="list-item">
              <button type="button" class="tile tile-full" data-open="${d.id}">
                <strong>${d.patientNombre}</strong>
                <span class="muted">${DocumentTypeLabels[d.documentType]} · ${new Date(d.updatedAt).toLocaleString("es")}</span>
                <p class="preview">${(d.dictation || d.generatedContent || "").slice(0, 120)}${(d.dictation || "").length > 120 ? "…" : ""}</p>
              </button>
              <button type="button" class="btn btn-ghost btn-sm" data-del="${d.id}">Eliminar</button>
            </li>`,
            )
            .join("")}</ul>`;
    const el = page("Borradores", body);

    el.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open");
        if (id) navigate(`/redactar?draft=${id}`);
      });
    });
    el.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-del");
        if (!id || !confirm("¿Eliminar borrador?")) return;
        deleteDraft(id);
        navigate("/borradores");
      });
    });

    bindNavButtons(el);
    return el;
  },
});
