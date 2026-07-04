package com.ceoclinicos.clinicosdoc.model

enum class HeaderType(val label: String) {
    MEDICO("Médico"),
    CLINICA("Clínica"),
    ;

    companion object {
        fun fromStorage(value: String?): HeaderType =
            entries.firstOrNull { it.name == value } ?: MEDICO
    }
}
