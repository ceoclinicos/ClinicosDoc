package com.ceoclinicos.clinicosdoc.model

/** Membresía del médico en un centro de salud. */
data class ClinicMembership(
    val clinicId: String,
    val clinicName: String,
    val role: String = "medico",
)

/** Invitación pendiente de un centro hacia el médico. */
data class ClinicDoctorInvitation(
    val clinicId: String,
    val clinicName: String,
    val doctorCedula: String,
    val doctorNombre: String,
    val status: String = "pending",
    val invitedAt: String = "",
    val expiresAt: String = "",
)
