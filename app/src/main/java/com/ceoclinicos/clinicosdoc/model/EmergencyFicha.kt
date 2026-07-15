package com.ceoclinicos.clinicosdoc.model

/** Ficha de emergencia del portal (`pacientes/{cedula}.fichaEmergencia`). */
data class EmergencyContact(
    val nombre: String = "",
    val telefono: String = "",
    val parentesco: String = "",
)

data class EmergencyFicha(
    val publicId: String = "",
    val patientCedula: String = "",
    val nombre: String = "",
    val tipoSangre: String = "Desconocido",
    val alergias: String = "",
    val condiciones: String = "",
    val medicamentos: String = "",
    val contactos: List<EmergencyContact> = emptyList(),
    val updatedAt: String = "",
    val activo: Boolean = true,
)
