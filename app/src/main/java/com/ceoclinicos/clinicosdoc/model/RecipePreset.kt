package com.ceoclinicos.clinicosdoc.model

/**
 * Receta predeterminada del médico (biblioteca personal).
 * Al emitir, el contenido usa el mismo formato Recipe + Indicaciones.
 */
data class RecipePresetFarmaco(
    val principioActivo: String = "",
    val presentacion: String = "Tabletas",
    val concentracion: String = "",
    val disponase: String = "",
    val indicaciones: String = "",
)

data class RecipePreset(
    val id: String,
    val name: String,
    val farmacos: List<RecipePresetFarmaco> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String = "",
)

object RecipePresetContent {
    fun formatFarmacoRecipeLine(f: RecipePresetFarmaco): String {
        val conc = f.concentracion.trim()
        val base = if (conc.isNotBlank()) {
            "${f.principioActivo.trim()} $conc (${f.presentacion.trim()})"
        } else {
            "${f.principioActivo.trim()} (${f.presentacion.trim()})"
        }
        val disp = f.disponase.trim()
        return if (disp.isBlank()) base else "$base\nDispóngase: $disp"
    }

    fun buildContent(farmacos: List<RecipePresetFarmaco>): String {
        val recipeBody = farmacos.joinToString("\n\n") { formatFarmacoRecipeLine(it) }
        val indicacionesBody = farmacos.joinToString("\n\n") { f ->
            val name = f.principioActivo.trim()
            val ind = f.indicaciones.trim().ifBlank { "Según indicación médica." }
            "$name:\n$ind"
        }
        return buildString {
            appendLine("[[SECTION:${RecetaDefaults.SECTION_RECIPE}]]")
            appendLine(recipeBody)
            appendLine()
            appendLine("[[SECTION:${RecetaDefaults.SECTION_INDICACIONES}]]")
            append(indicacionesBody)
        }.trim()
    }

    fun previewText(preset: RecipePreset): String {
        if (preset.farmacos.isEmpty()) return "(Sin fármacos)"
        return preset.farmacos.joinToString("\n\n") { f ->
            "${formatFarmacoRecipeLine(f)}\n→ ${f.indicaciones.trim().ifBlank { "—" }}"
        }
    }
}
