package com.ceoclinicos.clinicosdoc.model

import java.util.Locale

private val ML_REGEX = Regex(
    """(\d+(?:[.,]\d+)?)\s*mg\s*/\s*(\d+(?:[.,]\d+)?)\s*ml""",
    RegexOption.IGNORE_CASE,
)

private fun fmtDosis(v: Double): String =
    if (v % 1.0 == 0.0) v.toInt().toString() else String.format(Locale.US, "%.1f", v)

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
    /** Dosis ponderal pediátrica en mg/kg/día ("" = no aplica). */
    val dosisPonderalMgKg: String = "",
    /** Tomas al día en que se divide la dosis ponderal (0 = no aplica, 2..6). */
    val tomasAlDia: Int = 0,
) {
    private fun ponderal(): Double? =
        dosisPonderalMgKg.trim().replace(",", ".").toDoubleOrNull()?.takeIf { it > 0 }

    private fun concentracionMgMl(): Pair<Double, Double>? = ML_REGEX.find(concentracion)?.let { m ->
        val mg = m.groupValues[1].replace(",", ".").toDoubleOrNull()
        val ml = m.groupValues[2].replace(",", ".").toDoubleOrNull()
        if (mg != null && ml != null && mg > 0 && ml > 0) mg to ml else null
    }

    fun tieneDosisPonderal(): Boolean = ponderal() != null && tomasAlDia in 2..6

    /** mg por toma según ponderal × peso ÷ tomas. */
    fun mgPorToma(pesoKg: Double?): Double? {
        val p = ponderal() ?: return null
        val peso = pesoKg ?: return null
        if (peso <= 0 || tomasAlDia !in 2..6) return null
        return p * peso / tomasAlDia
    }

    /** cc (ml) por toma, solo si la concentración es "X mg/Y ml". */
    fun mlPorToma(pesoKg: Double?): Double? {
        val mgToma = mgPorToma(pesoKg) ?: return null
        val (mg, ml) = concentracionMgMl() ?: return null
        return mgToma / (mg / ml)
    }

    /**
     * Texto de dosis pediátrica. Si se pasa [mlOverride] (valor editado por el
     * médico) se usa ese en lugar del calculado.
     */
    fun dosisPediatricaTexto(pesoKg: Double?, mlOverride: Double? = null): String? {
        val p = ponderal() ?: return null
        val peso = pesoKg ?: return null
        if (peso <= 0 || tomasAlDia !in 2..6) return null
        val mgPorToma = p * peso / tomasAlDia
        val conc = concentracionMgMl()
        val dosisTxt = if (mlOverride != null && mlOverride > 0) {
            val mgTxt = conc?.let { (mg, ml) -> " (${fmtDosis(mlOverride * (mg / ml))} mg)" } ?: ""
            "${fmtDosis(mlOverride)} cc$mgTxt"
        } else if (conc != null) {
            val (mg, ml) = conc
            val mlPorToma = mgPorToma / (mg / ml)
            "${fmtDosis(mlPorToma)} cc (${fmtDosis(mgPorToma)} mg)"
        } else {
            "${fmtDosis(mgPorToma)} mg"
        }
        return "Dosis pediátrica: $dosisTxt por toma " +
            "($dosisPonderalMgKg mg/kg/día × ${fmtDosis(peso)} kg ÷ $tomasAlDia tomas)."
    }
}

data class RecipePreset(
    val id: String,
    val name: String,
    val farmacos: List<RecipePresetFarmaco> = emptyList(),
    val createdAt: String = "",
    val updatedAt: String = "",
)

object RecipePresetContent {
    /** Marcador en indicaciones donde se inserta la dosis calculada. */
    const val DOSIS_PLACEHOLDER = "{dosis}"

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

    /**
     * [mlOverrides]: ml por toma editados por el médico, por índice de fármaco.
     * Si las indicaciones contienen "{dosis}" se reemplaza ahí; si no, se
     * agrega una línea "Dosis pediátrica: …".
     */
    fun buildContent(
        farmacos: List<RecipePresetFarmaco>,
        pesoKg: Double? = null,
        mlOverrides: Map<Int, Double> = emptyMap(),
    ): String {
        val recipeBody = farmacos.joinToString("\n\n") { formatFarmacoRecipeLine(it) }
        val indicacionesBody = farmacos.mapIndexed { idx, f ->
            val name = f.principioActivo.trim()
            var ind = f.indicaciones.trim().ifBlank { "Según indicación médica." }
            val override = mlOverrides[idx]
            if (ind.contains(DOSIS_PLACEHOLDER) && f.tieneDosisPonderal() && pesoKg != null) {
                val ml = override ?: f.mlPorToma(pesoKg)
                val mg = f.mgPorToma(pesoKg)
                val txt = when {
                    ml != null -> "${fmtDosis(ml)} ml"
                    mg != null -> "${fmtDosis(mg)} mg"
                    else -> null
                }
                if (txt != null) {
                    ind = ind.replace(DOSIS_PLACEHOLDER, txt)
                    "$name:\n$ind"
                } else {
                    "$name:\n$ind"
                }
            } else {
                val ped = f.dosisPediatricaTexto(pesoKg, override)
                if (ped != null) "$name:\n$ind\n$ped" else "$name:\n$ind"
            }
        }.joinToString("\n\n")
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
            val ped = if (f.dosisPonderalMgKg.isNotBlank() && f.tomasAlDia in 2..6) {
                "\nPonderal: ${f.dosisPonderalMgKg} mg/kg/día ÷ ${f.tomasAlDia} tomas"
            } else ""
            "${formatFarmacoRecipeLine(f)}\n→ ${f.indicaciones.trim().ifBlank { "—" }}$ped"
        }
    }
}
