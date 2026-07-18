package com.ceoclinicos.clinicosdoc.model

/** Textos predeterminados para secciones activas sin datos en el dictado. */
object SectionDefaults {
    /** Igual en Informe e Historia clínica: solo síntomas llamativos. */
    const val MOTIVO_CONSULTA_STYLE =
        "- Motivo de consulta: SOLO síntomas principales (máximo 3), unidos con \"y\"/\"e\". " +
            "Ejemplo: \"diarrea y vómito\". PROHIBIDO frases largas, \"consulta por…\", evolución, antecedentes o diagnóstico."

    fun textFor(section: String, overrides: Map<String, String> = emptyMap()): String {
        overrides.entries.firstOrNull { it.key.equals(section, ignoreCase = true) }
            ?.value?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { return it }
        return when {
        section.equals(SectionCatalog.MOTIVO_CONSULTA, ignoreCase = true) ->
            "Evaluación médica."
        section.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true) ->
            "Se trata de paciente referido para evaluación clínica. Sin mayores detalles aportados en la evaluación actual."
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
            "1. Hospitalizar o mantener bajo observación 4 horas\n" +
                "2. Omeprazol 40 mg EV\n" +
                "3. Ketoprofeno 100 mg EV cada 12 horas\n" +
                "4. Control de signos vitales"
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
            RecetaDefaults.MOLDE_INDICACIONES
        section.equals(SectionCatalog.ORDENES, ignoreCase = true) ->
            OrdenesMedicasDefaults.MOLDE_EJEMPLO
        section.equals(SectionCatalog.RECIPE, ignoreCase = true) ->
            RecetaDefaults.MOLDE_RECIPE
        else -> "Sin datos adicionales referidos."
        }
    }

    fun promptBlock(sections: List<String>, overrides: Map<String, String> = emptyMap()): String {
        val clinical = sections.filterNot {
            it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true)
        }
        if (clinical.isEmpty()) return ""
        return buildString {
            appendLine("TEXTOS PREDETERMINADOS (usar SOLO si la sección está activa y el dictado NO aporta datos para ella):")
            clinical.forEach { section ->
                appendLine("- $section → \"${textFor(section, overrides)}\"")
            }
            appendLine("Si el dictado sí aporta datos, prioriza el dictado y mejora la redacción.")
            appendLine("NO uses la frase \"No referido\" cuando exista texto predeterminado arriba.")
        }
    }
}
