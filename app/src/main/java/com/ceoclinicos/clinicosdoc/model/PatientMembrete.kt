package com.ceoclinicos.clinicosdoc.model

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PatientMembrete(
    val nombre: String = "",
    val edad: String = "",
    val sexo: String = "",
    val fechaNacimiento: String = "",
    val fecha: String = "",
) {
    fun displayNombre(): String = nombre.trim().ifBlank { "—" }

    fun displayEdad(): String {
        val trimmed = edad.trim()
        if (trimmed.isBlank()) return "—"
        if (trimmed.contains("año", ignoreCase = true)) return trimmed
        return "$trimmed años"
    }

    fun displaySexo(): String = sexo.trim().ifBlank { "—" }

    fun displayFechaNacimiento(): String = fechaNacimiento.trim().ifBlank { "—" }

    fun displayFecha(): String = fecha.trim().ifBlank { "—" }

    companion object {
        private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.systemDefault())

        fun fromPatient(patient: Patient, at: Instant = Instant.now()): PatientMembrete =
            PatientMembrete(
                nombre = patient.nombre,
                edad = patient.edad.toString(),
                sexo = patient.sexo,
                fechaNacimiento = dateFormatter.format(patient.fechaNacimiento),
                fecha = dateFormatter.format(at),
            )

        fun forDocument(doc: ClinicalDocument, patient: Patient? = null): PatientMembrete {
            val fromPatient = patient?.let { fromPatient(it, doc.createdAt) }
            val stored = doc.membrete
            return PatientMembrete(
                nombre = stored?.nombre?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.nombre
                    ?: doc.patientNombre,
                edad = stored?.edad?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.edad.orEmpty(),
                sexo = stored?.sexo?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.sexo
                    ?: patient?.sexo.orEmpty(),
                fechaNacimiento = stored?.fechaNacimiento?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.fechaNacimiento.orEmpty(),
                fecha = stored?.fecha?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.fecha
                    ?: dateFormatter.format(doc.createdAt),
            )
        }
    }
}
