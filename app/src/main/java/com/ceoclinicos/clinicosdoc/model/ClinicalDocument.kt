package com.ceoclinicos.clinicosdoc.model

import java.time.Instant

data class ClinicalDocument(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientCedula: String,
    val type: DocumentType,
    val content: String,
    val rawDictation: String,
    val createdAt: Instant,
    val templateId: String? = null,
    val templateName: String? = null,
    val headerId: String? = null,
    val headerSnapshot: DocumentHeader? = null,
    val membrete: PatientMembrete? = null,
    /** Documento clínico de origen (informe/HC) si se generó desde él. */
    val sourceDocumentId: String? = null,
) {
    val typeLabel: String get() = type.label
}
