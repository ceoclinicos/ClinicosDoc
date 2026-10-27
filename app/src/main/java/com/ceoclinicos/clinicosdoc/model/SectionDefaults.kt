package com.ceoclinicos.clinicosdoc.model

/** Textos predeterminados para secciones activas sin datos en el dictado. */
object SectionDefaults {
    /**
     * Motivo = solo el o los síntomas nombrados (máx. 3), sin ningún detalle.
     */
    const val MOTIVO_CONSULTA_STYLE =
        "- Motivo de consulta: escribe EXACTAMENTE el o los síntomas mencionados en el dictado " +
            "(máximo 3), unidos con \"y\"/\"e\". SOLO el nombre del síntoma; NADA de detalles " +
            "(ni tipo, intensidad, duración, localización, características, restos alimenticios, etc.). " +
            "Ejemplos: \"dolor abdominal tipo cólico de moderada intensidad\" → \"dolor abdominal\"; " +
            "\"vómitos de restos alimenticios\" → \"vómito\"; varios → \"dolor abdominal y vómito\". " +
            "PROHIBIDO: frases largas, \"consulta por…\", \"refiere…\", evolución, antecedentes o diagnóstico."

    /** Diagnóstico clínico con nomenclatura estándar (CIE-10), sin códigos. */
    const val DIAGNOSTICO_STYLE =
        "- Diagnóstico / Impresión diagnóstica: SOLO enfermedades reales de la clasificación CIE-10 " +
            "(entidades nosológicas o síndromes reconocidos como diagnóstico). " +
            "Redacta el diagnóstico según síntomas, signos y evolución del dictado " +
            "(ej. \"Gastritis aguda\", \"Gastroenteritis aguda infecciosa\", \"Neumonía adquirida en la comunidad\"). " +
            "PROHIBIDO listar signos o síntomas como diagnóstico " +
            "(\"Fiebre\", \"Dolor abdominal\", \"Tos\", \"Vómito\", \"Cefalea\", etc. NO son diagnósticos: " +
            "son motivo de consulta o parte de la enfermedad actual). " +
            "Lista numerada 1. 2. 3. si hay varios; el principal primero. " +
            "NO incluyas códigos CIE-10 ni abreviaturas entre paréntesis; solo el nombre de la enfermedad. " +
            "PROHIBIDO dejar solo \"Evaluación clínica\" o frases vacías si el dictado permite un diagnóstico razonable. " +
            "No inventes hallazgos no referidos en el informe."

    const val DIAS_REPOSO_DEFAULT =
        "Nota: En vista de la sintomatología del paciente se indican cumplir 3 días de reposo médico completo."

    const val NOTA_INFORME_DEFAULT =
        "En vista de que el paciente presenta mejoría de la sintomatología, se indica tratamiento ambulatorio " +
            "y reposo médico por 72 horas."

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
            DIAS_REPOSO_DEFAULT
        section.equals(SectionCatalog.NOTA, ignoreCase = true) ->
            NOTA_INFORME_DEFAULT
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
