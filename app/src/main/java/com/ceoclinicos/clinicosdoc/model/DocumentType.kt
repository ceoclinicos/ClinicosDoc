package com.ceoclinicos.clinicosdoc.model

enum class DocumentType(val label: String) {
    HISTORIA_CLINICA("Historia clínica"),
    INFORME("Informe"),
    REPOSO("Reposo"),
    ;

    val reportTitle: String
        get() = when (this) {
            HISTORIA_CLINICA -> "HISTORIA CLÍNICA"
            INFORME -> "INFORME MÉDICO"
            REPOSO -> "REPOSO MÉDICO"
        }

    companion object {
        fun fromName(name: String): DocumentType =
            entries.firstOrNull { it.name.equals(name, ignoreCase = true) || legacyName(it) == name }
                ?: HISTORIA_CLINICA

        private fun legacyName(type: DocumentType): String = when (type) {
            HISTORIA_CLINICA -> "historiaClinica"
            INFORME -> "informe"
            REPOSO -> "reposo"
        }

        fun storageName(type: DocumentType): String = legacyName(type)
    }
}
