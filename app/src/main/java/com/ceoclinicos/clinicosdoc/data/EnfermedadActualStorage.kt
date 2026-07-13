package com.ceoclinicos.clinicosdoc.data

import android.content.Context

object EnfermedadActualStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "enfermedad_actual_ejemplo"

    const val DEFAULT_EJEMPLO =
        "Paciente refiere inicio de síntomas hace 3 días con dolor de características cólicas, " +
            "de intensidad moderada, localizado en epigastrio, asociado a náuseas sin vómitos, " +
            "sin fiebre referida, sin cambios en el hábito intestinal. Consultó previamente en " +
            "centro de salud donde se indicó tratamiento sintomático con mejoría parcial."

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(context: Context): String =
        prefs(context).getString(KEY, DEFAULT_EJEMPLO) ?: DEFAULT_EJEMPLO

    fun save(context: Context, text: String) {
        prefs(context).edit().putString(KEY, text.trim()).persist()
    }
}
