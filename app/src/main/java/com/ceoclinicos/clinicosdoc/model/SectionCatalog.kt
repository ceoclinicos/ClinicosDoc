package com.ceoclinicos.clinicosdoc.model

object SectionCatalog {
    const val MOTIVO_CONSULTA = "Motivo de consulta"
    const val ENFERMEDAD_ACTUAL = "Enfermedad actual"
    const val ANTECEDENTES_PERSONALES = "Antecedentes personales"
    const val ANTECEDENTES_FAMILIARES = "Antecedentes familiares"
    const val EXAMEN_FISICO = "Examen físico"
    const val EXAMEN_FUNCIONAL = "Examen funcional"
    const val IMPRESION_DIAGNOSTICA = "Impresión diagnóstica"
    const val PLAN = "Plan"
    const val OBSERVACIONES = "Observaciones"
    const val DATOS_PACIENTE = "Datos del paciente"
    const val MOTIVO_INFORME = "Motivo del informe"
    const val HALLAZGOS_CLINICOS = "Hallazgos clínicos"
    const val CONCLUSIONES = "Conclusiones"
    const val RECOMENDACIONES = "Recomendaciones"
    const val DIAGNOSTICO = "Diagnóstico"
    const val HABITOS_PSICOBIOLOGICOS = "Hábitos psicobiológicos"
    const val DIAS_REPOSO = "Días de reposo indicados"
    const val INDICACIONES = "Indicaciones"
    const val ORDENES = OrdenesMedicasDefaults.SECTION_ORDENES

    val all = listOf(
        MOTIVO_CONSULTA,
        ENFERMEDAD_ACTUAL,
        ANTECEDENTES_PERSONALES,
        ANTECEDENTES_FAMILIARES,
        EXAMEN_FISICO,
        EXAMEN_FUNCIONAL,
        IMPRESION_DIAGNOSTICA,
        PLAN,
        OBSERVACIONES,
        DATOS_PACIENTE,
        MOTIVO_INFORME,
        HALLAZGOS_CLINICOS,
        CONCLUSIONES,
        RECOMENDACIONES,
        DIAGNOSTICO,
        HABITOS_PSICOBIOLOGICOS,
        DIAS_REPOSO,
        INDICACIONES,
        ORDENES,
    )

    /** Secciones disponibles para elegir/ordenar por tipo de documento. */
    fun catalogFor(documentType: DocumentType): List<String> = when (documentType) {
        DocumentType.HISTORIA_CLINICA -> listOf(
            DATOS_PACIENTE,
            MOTIVO_CONSULTA,
            ENFERMEDAD_ACTUAL,
            ANTECEDENTES_PERSONALES,
            ANTECEDENTES_FAMILIARES,
            HABITOS_PSICOBIOLOGICOS,
            EXAMEN_FUNCIONAL,
            EXAMEN_FISICO,
            DIAGNOSTICO,
            IMPRESION_DIAGNOSTICA,
            PLAN,
            OBSERVACIONES,
        )
        DocumentType.INFORME -> listOf(
            DATOS_PACIENTE,
            MOTIVO_CONSULTA,
            ENFERMEDAD_ACTUAL,
            EXAMEN_FISICO,
            DIAGNOSTICO,
            CONCLUSIONES,
            PLAN,
        )
        DocumentType.REPOSO -> listOf(
            DATOS_PACIENTE,
            DIAGNOSTICO,
            DIAS_REPOSO,
            INDICACIONES,
            OBSERVACIONES,
        )
        DocumentType.ORDENES_MEDICAS -> listOf(
            DATOS_PACIENTE,
            ORDENES,
        )
    }

    fun requiresLockedPatientSection(documentType: DocumentType): Boolean =
        catalogFor(documentType).firstOrNull() == DATOS_PACIENTE

    /** Asegura «Datos del paciente» primero; permite secciones personalizadas fuera del catálogo. */
    fun normalizeActive(documentType: DocumentType, sections: List<String>): List<String> {
        val catalog = catalogFor(documentType).toSet()
        val mapped = sections.map { s ->
            if (s.equals(RECOMENDACIONES, ignoreCase = true)) PLAN else s.trim()
        }.filter { it.isNotBlank() }
        val unique = mapped.distinct()
        // Catálogo + personalizadas (no descartar custom)
        val kept = unique.filter { it in catalog || it !in catalog }
        if (!requiresLockedPatientSection(documentType)) return kept
        val withoutLocked = kept.filterNot { it == DATOS_PACIENTE }
        return listOf(DATOS_PACIENTE) + withoutLocked
    }

    /** Orden visual: activas en su orden, luego inactivas según catálogo. */
    fun initialLayoutOrder(documentType: DocumentType, activeSections: List<String>): List<String> {
        val catalog = catalogFor(documentType)
        val active = normalizeActive(documentType, activeSections)
        val inactive = catalog.filter { it !in active.toSet() }
        return active + inactive
    }

    fun activeFromLayout(layoutOrder: List<String>, activeSections: List<String>): List<String> {
        val activeSet = activeSections.toSet()
        return layoutOrder.filter { it in activeSet }
    }

    fun defaultsFor(documentType: DocumentType): List<String> = when (documentType) {
        DocumentType.HISTORIA_CLINICA -> listOf(
            DATOS_PACIENTE,
            MOTIVO_CONSULTA,
            ENFERMEDAD_ACTUAL,
            ANTECEDENTES_PERSONALES,
            ANTECEDENTES_FAMILIARES,
            HABITOS_PSICOBIOLOGICOS,
            EXAMEN_FUNCIONAL,
            EXAMEN_FISICO,
            DIAGNOSTICO,
        )
        // Informe: núcleo clínico por defecto (Conclusiones/Plan opcionales)
        DocumentType.INFORME -> listOf(
            DATOS_PACIENTE,
            MOTIVO_CONSULTA,
            ENFERMEDAD_ACTUAL,
            EXAMEN_FISICO,
            DIAGNOSTICO,
        )
        DocumentType.REPOSO -> listOf(
            DATOS_PACIENTE,
            DIAGNOSTICO,
            DIAS_REPOSO,
            INDICACIONES,
            OBSERVACIONES,
        )
        DocumentType.ORDENES_MEDICAS -> listOf(
            DATOS_PACIENTE,
            ORDENES,
        )
    }
}
