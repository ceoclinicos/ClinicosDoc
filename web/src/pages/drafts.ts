import { registerRoute } from "../app/router";
import { loadJson } from "../services/local-store";
import type { ClinicalDraft } from "../shared/models";
import { DocumentTypeLabels } from "../shared/models";
import { bindNavButtons, emptyState, page } from "./helpers";

registerRoute({
  path: "/borradores",
  title: "Borradores",
  medicoOnly: true,
  render: () => {
    const drafts = loadJson<ClinicalDraft[]>("drafts", []).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const body =
      drafts.length === 0
        ? emptyState("Sin borradores. Se guardan al procesar con IA.", "Redactar", "/redactar")
        : `<ul class="list">${drafts
            .map(
              (d) =>
                `<li class="list-item"><strong>${d.patientNombre}</strong><span>${DocumentTypeLabels[d.documentType]} · ${new Date(d.updatedAt).toLocaleString("es")}</span><p class="preview">${d.dictation.slice(0, 120)}…</p></li>`,
            )
            .join("")}</ul>`;
    const el = page("Borradores", body);
    bindNavButtons(el);
    return el;
  },
});
