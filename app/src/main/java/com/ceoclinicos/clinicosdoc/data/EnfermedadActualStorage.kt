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

    /**
     * Ejemplos de referencia adicionales (patologías variadas, evoluciones
     * largas y politraumatismos). Se envían siempre junto al ejemplo
     * principal para que la IA tome el estilo.
     */
    val EJEMPLOS_REFERENCIA = listOf(
        "Se trata de paciente femenino de 41 años de edad, natural y procedente de la localidad, " +
            "sin diagnóstico patológico conocido, quien refiere inicio de enfermedad actual el día " +
            "29/10/2026 por presentar odinofagia de inicio súbito asociada a fiebre de 38,5 °C y " +
            "malestar general, el día 30/10/2026 se anexa tos seca irritativa y congestión nasal por " +
            "lo cual consulta a ambulatorio cercano donde indican tratamiento sintomático con " +
            "mejoría parcial, el día 01/11/2026 por persistencia de fiebre y anexándose dolor " +
            "torácico al toser acude nuevamente a centro asistencial, y por no presentar mejoría " +
            "acude el día de hoy 02/11/2026 a este centro donde es evaluada por el equipo médico " +
            "de guardia.",
        "Se trata de paciente masculino de 48 años de edad, natural de Puerto La Cruz, procedente " +
            "de la localidad, con diagnóstico de gastritis crónica, quien refiere inicio de " +
            "enfermedad actual el día 30/10/2026 por presentar dolor epigástrico tipo quemazón de " +
            "intensidad moderada posterior a las comidas, el día 31/10/2026 se anexan náuseas y " +
            "pirosis nocturna por lo que automedica con antiácidos sin mejoría, el día 01/11/2026 " +
            "el dolor se hace continuo asociándose sensación de plenitud gástrica y eructos " +
            "frecuentes; por persistencia de la sintomatología acude el día de hoy 02/11/2026 a " +
            "este centro donde es evaluado por el equipo médico de guardia.",
        "Se trata de paciente femenino de 55 años de edad, natural y procedente de la localidad, " +
            "con diagnóstico de diabetes mellitus tipo 2 en tratamiento, quien refiere inicio de " +
            "enfermedad actual el día 29/10/2026 por presentar polaquiuria y disuria, el día " +
            "30/10/2026 se anexa dolor suprapúbico y orina de aspecto turbio con mal olor, el día " +
            "01/11/2026 por anexarse fiebre de 38,7 °C y dolor lumbar izquierdo consulta en " +
            "ambulatorio donde indican antibioticoterapia oral, y por persistencia de la fiebre y " +
            "el dolor lumbar acude el día de hoy 02/11/2026 a este centro donde es evaluada por " +
            "el equipo médico de guardia.",
        "Se trata de paciente masculino de 33 años de edad, natural y procedente de la localidad, " +
            "sin diagnóstico patológico conocido, quien refiere inicio de enfermedad actual el día " +
            "de hoy 02/11/2026 por presentar traumatismo de tórax derecho y miembro superior " +
            "izquierdo posterior a colisión de motocicleta contra vehículo liviano, evidenciándose " +
            "dolor torácico que aumenta con la inspiración, aumento de volumen y limitación " +
            "funcional del brazo izquierdo, sin pérdida de conciencia; por tal motivo es traído a " +
            "este centro donde es evaluado por el equipo médico de guardia.",
        "Se trata de paciente masculino de 45 años de edad, natural de El Tigre, procedente de la " +
            "localidad, sin diagnóstico patológico conocido, quien refiere inicio de enfermedad " +
            "actual el día de hoy 02/11/2026 por presentar caída desde escalera de aproximadamente " +
            "3 metros de altura durante labores de construcción, evidenciándose traumatismo " +
            "craneofacial con herida contusa en región frontal, dolor en cadera derecha con " +
            "imposibilidad para la marcha y dolor en muñeca izquierda con deformidad y aumento de " +
            "volumen, sin pérdida de conciencia ni vómitos; por tal motivo es traído a este centro " +
            "donde es evaluado por el equipo médico de guardia.",
        "Se trata de paciente femenino de 61 años de edad, natural y procedente de la localidad, " +
            "con diagnóstico de hipertensión arterial en tratamiento, quien es traída el día de " +
            "hoy 02/11/2026 posterior a ser atropellada por vehículo en vía pública, presentando " +
            "traumatismo de cráneo con pérdida de conciencia transitoria de aproximadamente 2 " +
            "minutos, traumatismo de miembro inferior derecho con deformidad a nivel de pierna y " +
            "múltiples excoriaciones en cara y extremidades; por tal motivo es traída a este " +
            "centro donde es evaluada por el equipo médico de guardia.",
    )

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

    fun reset(context: Context) {
        prefs(context).edit().remove(KEY).persist()
    }

    fun resolved(ejemploPlantilla: String, context: Context): String =
        ejemploPlantilla.trim().ifBlank { load(context) }
}
