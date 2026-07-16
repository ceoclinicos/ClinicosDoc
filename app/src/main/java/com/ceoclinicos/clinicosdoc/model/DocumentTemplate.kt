package com.ceoclinicos.clinicosdoc.model

data class DocumentTemplate(
    val id: String,
    val name: String,
    val documentType: DocumentType,
    val sections: List<String>,
    val isDefault: Boolean = false,
    /** Orden visual de todas las secciones del catálogo (activas e inactivas). */
    val sectionLayoutOrder: List<String> = emptyList(),
    /** IDs de sistemas activos (orden del catálogo / ↑↓ del usuario). */
    val enabledPhysicalExamSystemIds: List<String> = emptyList(),
    /** Textos base personalizados por sistema (solo para esta plantilla). */
    val physicalExamTextOverrides: Map<String, String> = emptyMap(),
    /** Ejemplo de estilo para enfermedad actual / narrativa clínica. */
    val enfermedadActualEjemplo: String = "",
) {
    fun usesPhysicalExamCatalog(): Boolean =
        documentType == DocumentType.INFORME ||
            sections.any { it.equals("Examen físico", ignoreCase = true) }

    fun toSessionConfig(): ReportSessionConfig = ReportSessionConfig(
        enabledPhysicalExamSystemIds = PhysicalExamDefaults.orderEnabledIds(
            enabledPhysicalExamSystemIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds },
        ),
        physicalExamTextOverrides = physicalExamTextOverrides,
        enfermedadActualEjemplo = enfermedadActualEjemplo,
        activeSections = normalizedSections(),
        sectionLayoutOrder = resolvedLayoutOrder(),
    )

    fun withSessionConfig(config: ReportSessionConfig): DocumentTemplate = copy(
        enabledPhysicalExamSystemIds = PhysicalExamDefaults.orderEnabledIds(
            config.enabledPhysicalExamSystemIds,
        ),
        physicalExamTextOverrides = config.physicalExamTextOverrides,
        enfermedadActualEjemplo = config.enfermedadActualEjemplo,
        sections = if (config.activeSections.isNotEmpty()) {
            SectionCatalog.normalizeActive(documentType, config.activeSections)
        } else {
            sections
        },
        sectionLayoutOrder = if (config.sectionLayoutOrder.isNotEmpty()) {
            config.sectionLayoutOrder
        } else {
            sectionLayoutOrder
        },
    )

    fun resolvedLayoutOrder(): List<String> {
        val catalog = SectionCatalog.catalogFor(documentType)
        val base = if (sectionLayoutOrder.isNotEmpty()) {
            val known = sectionLayoutOrder.filter { it in catalog }
            val missing = catalog.filter { it !in known.toSet() }
            known + missing
        } else {
            SectionCatalog.initialLayoutOrder(documentType, sections)
        }
        if (!SectionCatalog.requiresLockedPatientSection(documentType)) return base
        return listOf(SectionCatalog.DATOS_PACIENTE) + base.filterNot { it == SectionCatalog.DATOS_PACIENTE }
    }

    fun normalizedSections(): List<String> {
        val active = SectionCatalog.normalizeActive(documentType, sections)
        val layout = resolvedLayoutOrder()
        return SectionCatalog.activeFromLayout(layout, active)
    }
}