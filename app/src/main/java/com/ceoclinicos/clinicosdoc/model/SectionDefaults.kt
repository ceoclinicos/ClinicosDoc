package com.ceoclinicos.clinicosdoc.model

/** Textos predeterminados para secciones activas sin datos en el dictado. */
object SectionDefaults {
    fun textFor(section: String): String = when {
        section.equals(SectionCatalog.MOTIVO_CONSULTA, ignoreCase = true) ->
            "Consulta por evaluación médica."
        section.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true) ->
            "Paciente refiere cuadro clínico de evolución reciente. Sin mayores detalles aportados en la evaluación actual."
        section.equals(SectionCatalog.ANTECEDENTES_PERSONALES, ignoreCase = true) ->
            "Niega antecedentes patológicos personales de importancia. Niega quirúrgicos y traumáticos. Niega alergias medicamentosas conocidas."
        section.equals(SectionCatalog.ANTECEDENTES_FAMILIARES, ignoreCase = true) ->
            "Niega antecedentes familiares relevantes."
        section.equals(SectionCatalog.HABITOS_PSICOBIOLOGICOS, ignoreCase = true) ->
            "Niega hábitos tóxicos. Sueño y alimentación referidos dentro de lo usual. Hábito intestinal y urinario sin alteraciones referidas."
        section.equals(SectionCatalog.EXAMEN_FUNCIONAL, ignoreCase = true) ->
            "Sin síntomas funcionales referidos por sistemas en la evaluación actual."
        section.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true) ->
            "Examen físico según plantilla de sistemas activos."
        section.equals(SectionCatalog.DIAGNOSTICO, ignoreCase = true) ->
            "1. Evaluación clínica."
        section.equals(SectionCatalog.IMPRESION_DIAGNOSTICA, ignoreCase = true) ->
            "Impresión diagnóstica pendiente de correlacionar con evolución clínica."
        section.equals(SectionCatalog.PLAN, ignoreCase = true) ->
            "Plan terapéutico según evolución clínica."
        section.equals(SectionCatalog.OBSERVACIONES, ignoreCase = true) ->
            "Sin observaciones adicionales."
        section.equals(SectionCatalog.MOTIVO_INFORME, ignoreCase = true) ->
            "Informe médico solicitado para evaluación clínica."
        section.equals(SectionCatalog.HALLAZGOS_CLINICOS, ignoreCase = true) ->
            "Hallazgos clínicos según evaluación realizada."
        section.equals(SectionCatalog.CONCLUSIONES, ignoreCase = true) ->
            "Conclusiones según hallazgos de la evaluación."
        section.equals(SectionCatalog.RECOMENDACIONES, ignoreCase = true) ->
            "Seguimiento médico según evolución clínica."
        section.equals(SectionCatalog.DIAS_REPOSO, ignoreCase = true) ->
            "Días de reposo a indicar según criterio médico."
        section.equals(SectionCatalog.INDICACIONES, ignoreCase = true) ->
            "Indicaciones médicas según evolución."
        else -> "Sin datos adicionales referidos."
    }

    fun promptBlock(sections: List<String>): String {
        val clinical = sections.filterNot {
            it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true)
        }
        if (clinical.isEmpty()) return ""
        return buildString {
            appendLine("TEXTOS PREDETERMINADOS (usar SOLO si la sección está activa y el dictado NO aporta datos para ella):")
            clinical.forEach { section ->
                appendLine("- $section → \"${textFor(section)}\"")
            }
            appendLine("Si el dictado sí aporta datos, prioriza el dictado y mejora la redacción.")
            appendLine("NO uses la frase \"No referido\" cuando exista texto predeterminado arriba.")
        }
    }
}
