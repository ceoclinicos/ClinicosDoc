package com.ceoclinicos.clinicosdoc.model

enum class DocumentType(val label: String) {
    HISTORIA_CLINICA("Historia clínica"),
    INFORME("Informe"),
    REPOSO("Reposo"),
    ORDENES_MEDICAS("Órdenes médicas"),
    RECETA("Receta"),
    ;

    val reportTitle: String
        get() = when (this) {
            HISTORIA_CLINICA -> "HISTORIA CLÍNICA"
            INFORME -> "INFORME MÉDICO"
            REPOSO -> "REPOSO MÉDICO"
            ORDENES_MEDICAS -> "ÓRDENES MÉDICAS"
            RECETA -> "RECETA MÉDICA"
        }

    companion object {
        /** Plantillas en «Informes y historias». */
        val informesYHistorias: List<DocumentType> =
            listOf(HISTORIA_CLINICA, INFORME, REPOSO)

        /** Plantillas en «Recetas» (órdenes + recipe). */
        val recetasYOrdenes: List<DocumentType> =
            listOf(ORDENES_MEDICAS, RECETA)

        fun fromName(name: String): DocumentType =
            entries.firstOrNull { it.name.equals(name, ignoreCase = true) || legacyName(it) == name }
                ?: HISTORIA_CLINICA

        private fun legacyName(type: DocumentType): String = when (type) {
            HISTORIA_CLINICA -> "historiaClinica"
            INFORME -> "informe"
            REPOSO -> "reposo"
            ORDENES_MEDICAS -> "ordenesMedicas"
            RECETA -> "receta"
        }

        fun storageName(type: DocumentType): String = legacyName(type)
    }
}
