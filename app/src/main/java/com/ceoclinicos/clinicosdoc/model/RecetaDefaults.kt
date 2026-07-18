package com.ceoclinicos.clinicosdoc.model

/**
 * Molde y pautas de Receta médica (IA + plantilla editable).
 * Hoja horizontal: mitad Recipe (dispóngase) + mitad Indicaciones.
 */
object RecetaDefaults {
    const val SECTION_RECIPE = "Recipe"
    const val SECTION_INDICACIONES = "Indicaciones"

    enum class Fuente(val label: String) {
        DICTAR("Dictar / escribir fármacos"),
        INFORME("Usar informe / historia"),
        DIAGNOSTICO("Por diagnóstico (protocolos)"),
    }

    val PRESENTACIONES = listOf(
        "Tabletas",
        "Cápsulas",
        "Jarabe",
        "Suspensión",
        "Gotas",
        "Crema",
        "Ungüento",
        "Gel",
        "Inyectable",
        "Sobres",
        "Óvulos",
        "Otro",
    )

    val MOLDE_RECIPE = """
Amoxicilina + Ácido Clavulánico 875 mg / 125 mg (Tabletas)
Dispóngase: 14 tabletas.

Ibuprofeno 400 mg (Tabletas)
Dispóngase: 20 tabletas.
""".trimIndent()

    val MOLDE_INDICACIONES = """
Amoxicilina + Ácido Clavulánico:
Tomar 1 tableta vía oral cada 12 horas por 7 días.

Ibuprofeno:
Tomar 1 tableta vía oral cada 8 horas por 5 días (con alimentos).
""".trimIndent()

    fun promptGuidelines(
        moldeRecipe: String = MOLDE_RECIPE,
        moldeIndicaciones: String = MOLDE_INDICACIONES,
        allowProtocolInference: Boolean = false,
    ): String = buildString {
        appendLine("FORMATO OBLIGATORIO DE RECETA MÉDICA:")
        appendLine("- Responde SOLO con dos secciones marcadas exactamente así:")
        appendLine("  [[SECTION:Recipe]]")
        appendLine("  [[SECTION:Indicaciones]]")
        appendLine("- NO incluyas Motivo de consulta, datos del paciente ni encabezado (van en el membrete de la hoja).")
        if (allowProtocolInference) {
            appendLine("- Basas el tratamiento en protocolos clínicos y guías científicas reconocidas")
            appendLine("  (esquemas de primera línea habituales en Venezuela/Latinoamérica cuando apliquen).")
            appendLine("- Usa dosis y duración típicas; si hay varias opciones, elige la más habitual y segura.")
            appendLine("- NO inventes fármacos poco usados sin base en guías; prioriza genéricos/principios activos.")
        } else {
            appendLine("- NO inventes fármacos que no estén en el dictado/caso.")
        }
        appendLine()
        appendLine("SECCIÓN Recipe (lo que se dispensa en farmacia):")
        appendLine("- Por cada medicamento: nombre + concentración + forma farmacéutica en una línea.")
        appendLine("- Debajo: \"Dispóngase: N tabletas/frasco/…\" (cantidad a entregar).")
        appendLine("- Ejemplo de estilo (respétalo):")
        appendLine("---")
        appendLine(moldeRecipe)
        appendLine("---")
        appendLine()
        appendLine("SECCIÓN Indicaciones (cómo tomarlo el paciente):")
        appendLine("- Por cada medicamento: nombre en una línea con \":\" y debajo la posología clara")
        appendLine("  (vía, dosis, frecuencia, duración).")
        appendLine("- Ejemplo de estilo:")
        appendLine("---")
        appendLine(moldeIndicaciones)
        appendLine("---")
        appendLine()
        appendLine("El orden de fármacos en Recipe e Indicaciones debe coincidir.")
    }.trimIndent()
}
