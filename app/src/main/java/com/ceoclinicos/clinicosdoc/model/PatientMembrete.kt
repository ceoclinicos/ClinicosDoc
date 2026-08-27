package com.ceoclinicos.clinicosdoc.model

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PatientMembrete(
    val nombre: String = "",
    val edad: String = "",
    val cedula: String = "",
    val sexo: String = "",
    val fechaNacimiento: String = "",
    val fecha: String = "",
    val telefono: String = "",
    val direccion: String = "",
    val ocupacion: String = "",
    val acompananteNombre: String = "",
    val acompananteTelefono: String = "",
) {
    fun displayNombre(): String = nombre.trim().ifBlank { "—" }

    fun displayEdad(): String {
        val trimmed = edad.trim()
        if (trimmed.isBlank()) return "—"
        if (trimmed.contains("año", ignoreCase = true)) return trimmed
        return "$trimmed años"
    }

    fun displayCedula(): String = cedula.trim().ifBlank { "—" }

    fun displaySexo(): String = sexo.trim().ifBlank { "—" }

    fun displayFechaNacimiento(): String = fechaNacimiento.trim().ifBlank { "—" }

    fun displayFecha(): String = fecha.trim().ifBlank { "—" }

    fun displayTelefono(): String = telefono.trim().ifBlank { "—" }

    fun displayDireccion(): String = direccion.trim().ifBlank { "—" }

    fun displayOcupacion(): String = ocupacion.trim().ifBlank { "—" }

    fun displayAcompananteNombre(): String = acompananteNombre.trim().ifBlank { "—" }

    fun displayAcompananteTelefono(): String = acompananteTelefono.trim().ifBlank { "—" }

    companion object {
        private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.systemDefault())

        fun fromPatient(patient: Patient, at: Instant = Instant.now()): PatientMembrete =
            PatientMembrete(
                nombre = patient.nombre,
                edad = patient.edad.toString(),
                cedula = patient.cedula,
                sexo = patient.sexo,
                fechaNacimiento = dateFormatter.format(patient.fechaNacimiento),
                fecha = dateFormatter.format(at),
                telefono = patient.whatsapp,
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
                cedula = stored?.cedula?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.cedula
                    ?: doc.patientCedula,
                sexo = stored?.sexo?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.sexo
                    ?: patient?.sexo.orEmpty(),
                fechaNacimiento = stored?.fechaNacimiento?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.fechaNacimiento.orEmpty(),
                fecha = stored?.fecha?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.fecha
                    ?: dateFormatter.format(doc.createdAt),
                telefono = stored?.telefono?.takeIf { it.isNotBlank() }
                    ?: fromPatient?.telefono.orEmpty(),
                direccion = stored?.direccion.orEmpty(),
                ocupacion = stored?.ocupacion.orEmpty(),
                acompananteNombre = stored?.acompananteNombre.orEmpty(),
                acompananteTelefono = stored?.acompananteTelefono.orEmpty(),
            )
        }

        fun fromStorageFields(
            patientCedula: String,
            nombre: String?,
            edad: String?,
            cedula: String?,
            sexo: String?,
            fechaNacimiento: String?,
            fecha: String?,
            telefono: String? = null,
            direccion: String? = null,
            ocupacion: String? = null,
            acompananteNombre: String? = null,
            acompananteTelefono: String? = null,
        ): PatientMembrete? {
            val hasData = listOf(
                nombre,
                edad,
                cedula,
                sexo,
                fechaNacimiento,
                fecha,
                telefono,
                direccion,
                ocupacion,
                acompananteNombre,
                acompananteTelefono,
            ).any { !it.isNullOrBlank() }
            if (!hasData) return null
            return PatientMembrete(
                nombre = nombre.orEmpty(),
                edad = edad.orEmpty(),
                cedula = cedula.orEmpty().ifBlank { patientCedula },
                sexo = sexo.orEmpty(),
                fechaNacimiento = fechaNacimiento.orEmpty(),
                fecha = fecha.orEmpty(),
                telefono = telefono.orEmpty(),
                direccion = direccion.orEmpty(),
                ocupacion = ocupacion.orEmpty(),
                acompananteNombre = acompananteNombre.orEmpty(),
                acompananteTelefono = acompananteTelefono.orEmpty(),
            )
        }
    }
}
