package com.ceoclinicos.clinicosdoc.model

data class DoctorProfile(
    val nombre: String,
    val cedula: String,
    val mpps: String,
    val sexo: String,
    val especialidad: String,
    val whatsapp: String,
    val correo: String = "",
) {
    val saludo: String
        get() = nombre.trim().split(" ").firstOrNull()?.takeIf { it.isNotEmpty() } ?: "Doctor"
}
