package com.ceoclinicos.clinicosdoc.model

/** Membresía del médico en un centro de salud. */
data class ClinicMembership(
    val clinicId: String,
    val clinicName: String,
    val role: String = "medico",
)
