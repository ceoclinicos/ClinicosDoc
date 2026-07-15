package com.ceoclinicos.clinicosdoc.data

internal data class PatientDto(
    val id: String,
    val nombre: String,
    val cedula: String,
    val edad: Int,
    val fechaNacimiento: String,
    val createdAt: String,
    val whatsapp: String? = null,
    val sexo: String? = null,
    val cedulaKey: String? = null,
)

internal data class AppointmentDto(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientWhatsapp: String,
    val scheduledAt: String,
    val motivo: String,
    val whatsappReminder: Boolean?,
    val createdAt: String,
)

internal data class ClinicalDocumentDto(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientCedula: String,
    val type: String,
    val content: String,
    val rawDictation: String?,
    val createdAt: String,
    val templateId: String?,
    val templateName: String?,
    val headerId: String?,
    val headerSnapshot: DocumentHeaderDto?,
    val membreteNombre: String? = null,
    val membreteEdad: String? = null,
    val membreteSexo: String? = null,
    val membreteFechaNacimiento: String? = null,
    val membreteFecha: String? = null,
    val doctorId: String? = null,
    val doctorNombre: String? = null,
    val patientFirestoreKey: String? = null,
)

internal data class DocumentHeaderDto(
    val id: String,
    val name: String,
    val logoPath: String?,
    val logoBase64: String? = null,
    val doctorName: String?,
    val subtitle: String?,
    val description: String?,
    val infoLines: List<HeaderInfoLineDto>?,
    val isDefault: Boolean?,
    val headerType: String? = null,
)

internal data class HeaderInfoLineDto(val label: String?, val value: String?)

internal data class DocumentTemplateDto(
    val id: String,
    val name: String,
    val documentType: String,
    val sections: List<String>,
    val isDefault: Boolean?,
    val enabledPhysicalExamSystemIds: List<String>? = null,
    val physicalExamTextOverrides: Map<String, String>? = null,
    val enfermedadActualEjemplo: String? = null,
    val sectionLayoutOrder: List<String>? = null,
)

internal data class ClinicalDraftDto(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientCedula: String,
    val documentType: String,
    val dictation: String,
    val templateId: String?,
    val templateName: String?,
    val headerId: String?,
    val generatedContent: String?,
    val membreteNombre: String? = null,
    val membreteEdad: String? = null,
    val membreteSexo: String? = null,
    val membreteFechaNacimiento: String? = null,
    val membreteFecha: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

internal data class PhysicalExamSystemCloudDto(
    val id: String,
    val name: String,
    val defaultText: String,
    val sortOrder: Int = 0,
)
