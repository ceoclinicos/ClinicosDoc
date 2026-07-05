package com.ceoclinicos.clinicosdoc.util

import com.ceoclinicos.clinicosdoc.model.Patient
import java.text.Normalizer

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

    private fun slugify(input: String): String =
        Normalizer.normalize(input.trim().lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .replace(Regex("[^a-z0-9]"), "")
}
