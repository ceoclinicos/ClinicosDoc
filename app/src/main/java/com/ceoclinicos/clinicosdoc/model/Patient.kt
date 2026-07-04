package com.ceoclinicos.clinicosdoc.model

import java.time.Instant

data class Patient(
    val id: String,
    val nombre: String,
    val cedula: String,
    val edad: Int,
    val fechaNacimiento: Instant,
    val createdAt: Instant,
    val whatsapp: String = "",
    val sexo: String = "",
)
