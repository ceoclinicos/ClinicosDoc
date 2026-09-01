import type { ClinicalDocument } from "../shared/models";
import { getIdToken } from "./firebase-auth";
import { normalizeCedula } from "./cedula";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export async function pushClinicDocumentViaApi(
  clinicId: string,
  document: ClinicalDocument,
  doctorNombre: string,
  doctorCedula?: string,
): Promise<void> {
  const token = await getIdToken(true);
  if (!token) throw new Error("Sesión vencida. Vuelva a iniciar sesión.");

  const res = await fetch(`${API_BASE}/api/clinic-document-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clinicId,
      doctorNombre,
      doctorCedula: doctorCedula ? normalizeCedula(doctorCedula) : undefined,
      document: {
        id: document.id,
        patientId: document.patientId,
        patientNombre: document.patientNombre,
        patientCedula: document.patientCedula,
        type: document.type,
        content: document.content,
        rawDictation: document.rawDictation,
        createdAt: document.createdAt,
        templateId: document.templateId,
        templateName: document.templateName,
        headerId: document.headerId,
        headerSnapshot: document.headerSnapshot,
        membrete: document.membrete,
        sourceDocumentId: document.sourceDocumentId,
        clinicId: document.clinicId,
        clinicName: document.clinicName,
      },
    }),
  });

  const raw = await res.text();
  let data: { error?: string; code?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err = new Error(data.error || "No se pudo enviar el informe al centro");
    (err as Error & { code?: string }).code = data.code;
    throw err;
  }
}
