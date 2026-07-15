package com.ceoclinicos.clinicosdoc.data

import android.content.Context

object EnfermedadActualStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "enfermedad_actual_ejemplo"

    /** Ejemplo anterior (migrar si aún está guardado). */
    private const val OLD_DEFAULT =
        "Paciente refiere inicio de síntomas hace 3 días con dolor de características cólicas, " +
            "de intensidad moderada, localizado en epigastrio, asociado a náuseas sin vómitos, " +
            "sin fiebre referida, sin cambios en el hábito intestinal. Consultó previamente en " +
            "centro de salud donde se indicó tratamiento sintomático con mejoría parcial."

    /**
     * Ejemplo de estilo canónico. El médico puede editarlo en plantillas;
     * la IA lo usa como referencia de redacción.
     */
    const val DEFAULT_EJEMPLO =
        "Se trata de paciente masculino de 35 años de edad, natural de Carúpano, procedente de la localidad, " +
            "sin diagnóstico patológico conocido, quien refiere inicio de enfermedad actual el día de hoy 15/07/2026 " +
            "por presentar caída desde su plano de sustentación evidenciándose aumento de volumen y limitación " +
            "funcional de miembro inferior derecho; por tal motivo acude a este centro donde es evaluado por el " +
            "equipo médico de guardia."

    /** Reglas fijas que acompañan al ejemplo en el prompt. */
    const val STYLE_RULES =
        "- Si nació y reside en el mismo sitio: use \"natural y procedente de la localidad\".\n" +
            "- Si nació en otro sitio y reside aquí: \"natural de [lugar], procedente de la localidad\".\n" +
            "- Sin enfermedad de base: \"sin diagnóstico patológico conocido\".\n" +
            "- Con enfermedad de base: \"con diagnóstico de hipertensión arterial controlada\" (adapte al dictado).\n" +
            "- Fecha de inicio: \"el día de hoy dd/MM/yyyy\" si es hoy, o \"el día dd/MM/yyyy\" si es anterior.\n" +
            "- Cierre típico: \"por tal motivo acude a este centro donde es evaluado por el equipo médico de guardia\" " +
            "(adapte si el dictado dice otra cosa)."

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(context: Context): String {
        val stored = prefs(context).getString(KEY, null)
        if (stored.isNullOrBlank() || stored == OLD_DEFAULT) return DEFAULT_EJEMPLO
        return stored
    }

    fun save(context: Context, text: String) {
        val trimmed = text.trim()
        prefs(context).edit().putString(
            KEY,
            trimmed.ifBlank { DEFAULT_EJEMPLO },
        ).persist()
    }

    fun resolved(ejemploPlantilla: String, context: Context): String =
        ejemploPlantilla.trim().ifBlank { load(context) }
}
