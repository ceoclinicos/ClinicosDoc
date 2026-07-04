package com.ceoclinicos.clinicosdoc.model

data class DocumentTemplate(
    val id: String,
    val name: String,
    val documentType: DocumentType,
    val sections: List<String>,
    val isDefault: Boolean = false,
    /** IDs de sistemas del catálogo de examen físico activos para esta plantilla. */
    val enabledPhysicalExamSystemIds: List<String> = emptyList(),
) {
    fun usesPhysicalExamCatalog(): Boolean =
        documentType == DocumentType.INFORME ||
            sections.any { it.equals("Examen físico", ignoreCase = true) }
}
