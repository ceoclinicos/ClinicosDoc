package com.ceoclinicos.clinicosdoc.model

enum class DocumentType(val label: String) {
    HISTORIA_CLINICA("Historia clínica"),
    INFORME("Informe"),
    REPOSO("Reposo"),
    ORDENES_MEDICAS("Órdenes médicas"),
    ;

    val reportTitle: String
        get() = when (this) {
            HISTORIA_CLINICA -> "HISTORIA CLÍNICA"
            INFORME -> "INFORME MÉDICO"
            REPOSO -> "REPOSO MÉDICO"
            ORDENES_MEDICAS -> "ÓRDENES MÉDICAS"
        }

    companion object {
        fun fromName(name: String): DocumentType =
            entries.firstOrNull { it.name.equals(name, ignoreCase = true) || legacyName(it) == name }
                ?: HISTORIA_CLINICA

        private fun legacyName(type: DocumentType): String = when (type) {
            HISTORIA_CLINICA -> "historiaClinica"
            INFORME -> "informe"
            REPOSO -> "reposo"
            ORDENES_MEDICAS -> "ordenesMedicas"
        }

        fun storageName(type: DocumentType): String = legacyName(type)
    }
}
