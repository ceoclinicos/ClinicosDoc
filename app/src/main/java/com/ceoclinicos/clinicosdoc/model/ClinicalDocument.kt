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
    /** Molde / sede institucional; aísla historial por centro. */
    val clinicId: String? = null,
    val clinicName: String? = null,
    val doctorNombre: String? = null,
    /** Si true, se dibuja el sello médico al pie del PDF. */
    val incluirSello: Boolean = false,
    /** Foto del sello (JPEG base64) usada al crear el documento; preserva el sello histórico. */
    val selloBase64: String? = null,
    /** Posición personalizada del sello (0..1 dentro de la última página); null = posición por defecto. */
    val selloOffsetX: Float? = null,
    val selloOffsetY: Float? = null,
) {
    val typeLabel: String get() = type.label
}
