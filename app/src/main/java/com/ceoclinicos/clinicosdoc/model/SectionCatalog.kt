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
    )

    fun defaultsFor(documentType: DocumentType): List<String> = when (documentType) {
        DocumentType.HISTORIA_CLINICA -> listOf(
            MOTIVO_CONSULTA,
            ENFERMEDAD_ACTUAL,
            ANTECEDENTES_PERSONALES,
            ANTECEDENTES_FAMILIARES,
            HABITOS_PSICOBIOLOGICOS,
            EXAMEN_FUNCIONAL,
            EXAMEN_FISICO,
            DIAGNOSTICO,
        )
        DocumentType.INFORME -> listOf(
            DIAGNOSTICO,
        )
        DocumentType.REPOSO -> listOf(
            DIAGNOSTICO,
            DIAS_REPOSO,
            INDICACIONES,
            OBSERVACIONES,
        )
    }
}
