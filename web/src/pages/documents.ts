import { registerRoute } from "../app/router";
import { loadJson } from "../services/local-store";
import type { ClinicalDocument } from "../shared/models";
import { DocumentTypeLabels } from "../shared/models";
import { emptyState, page } from "./helpers";

registerRoute({
  path: "/informes",
  title: "Informes",
  nav: true,
  navLabel: "Informe",
  medicoOnly: true,
  render: () => {
    const docs = loadJson<ClinicalDocument[]>("documents", []).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    const body =
      docs.length === 0
        ? emptyState("Sin informes aún. Usa Redactar en Home.")
        : `<ul class="list">${docs
            .map(
              (d) =>
                `<li class="list-item"><strong>${d.patientNombre}</strong><span>${DocumentTypeLabels[d.type]} · ${new Date(d.createdAt).toLocaleString("es")}</span></li>`,
            )
            .join("")}</ul>`;
    return page("Informes", body);
  },
});
