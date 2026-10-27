package com.ceoclinicos.clinicosdoc.util

import com.ceoclinicos.clinicosdoc.model.Patient
import java.text.Normalizer
import java.util.UUID

/**
 * ID de documento Firestore para pacientes: `{cedula}_{nombre}` en minúsculas sin acentos.
 * Ejemplo: 23536843 + "Jhon Noriega" → `23536843_jhonnoriega`
 */
object PatientFirestoreId {
    fun from(cedula: String, nombre: String): String {
        val cedulaPart = CedulaNormalizer.normalize(cedula).lowercase()
        val nameSlug = slugify(nombre)
        require(cedulaPart.isNotBlank() && nameSlug.isNotBlank()) {
            "Cédula y nombre son obligatorios para el ID de Firestore"
        }
        return "${cedulaPart}_$nameSlug"
    }

    fun from(patient: Patient): String = from(patient.cedula, patient.nombre)

    /** ID interno para pacientes sin cédula (ej. bebés): `sc_{nombre}_{random}`. */
    fun forSinCedula(nombre: String): String {
        val slug = slugify(nombre).ifBlank { "paciente" }
        val suffix = UUID.randomUUID().toString().replace("-", "").take(8)
        return "sc_${slug}_$suffix"
    }

    /**
     * Clave en la colección global: `cedula_nombre` si hay cédula;
     * si no, el id interno estable del paciente (`sc_...`).
     */
    fun globalKey(cedula: String, nombre: String, patientId: String): String =
        if (cedula.isNotBlank()) from(cedula, nombre)
        else patientId.ifBlank { forSinCedula(nombre) }

    fun globalKey(patient: Patient): String =
        globalKey(patient.cedula, patient.nombre, patient.id)

    private fun slugify(input: String): String =
        Normalizer.normalize(input.trim().lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .replace(Regex("[^a-z0-9]"), "")
}
