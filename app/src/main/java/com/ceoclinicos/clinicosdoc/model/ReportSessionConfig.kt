package com.ceoclinicos.clinicosdoc.model

/** Configuración por sesión de redacción (paso plantilla antes del dictado). */
data class ReportSessionConfig(
    val enabledPhysicalExamSystemIds: List<String>,
    val physicalExamTextOverrides: Map<String, String> = emptyMap(),
    val sectionDefaultTexts: Map<String, String> = emptyMap(),
    val enfermedadActualEjemplo: String = "",
    val activeSections: List<String> = emptyList(),
    val sectionLayoutOrder: List<String> = emptyList(),
) {
    fun applyTo(template: DocumentTemplate): DocumentTemplate = template.withSessionConfig(this)
}
