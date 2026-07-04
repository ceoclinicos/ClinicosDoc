package com.ceoclinicos.clinicosdoc.model

import java.time.Instant

data class ClinicalDraft(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientCedula: String,
    val documentType: DocumentType,
    val dictation: String,
    val templateId: String? = null,
    val templateName: String? = null,
    val headerId: String? = null,
    val generatedContent: String? = null,
    val membrete: PatientMembrete? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    val hasGeneratedContent: Boolean get() = !generatedContent.isNullOrBlank()
}
