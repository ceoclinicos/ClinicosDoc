package com.ceoclinicos.clinicosdoc.model

data class DoctorProfile(
    val nombre: String,
    val cedula: String,
    val mpps: String,
    val sexo: String,
    val especialidad: String,
    val whatsapp: String,
    val correo: String = "",
    /** "Venezuela" | "Otros" — solo Venezuela valida MPPS/SACS */
    val nacionalidad: String = "Venezuela",
) {
    val saludo: String
        get() = nombre.trim().split(" ").firstOrNull()?.takeIf { it.isNotEmpty() } ?: "Doctor"

    val esVenezolano: Boolean
        get() = nacionalidad.equals("Venezuela", ignoreCase = true)
}
