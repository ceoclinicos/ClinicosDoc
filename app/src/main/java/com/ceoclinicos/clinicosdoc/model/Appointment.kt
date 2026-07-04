package com.ceoclinicos.clinicosdoc.model

import java.time.Instant

data class Appointment(
    val id: String,
    val patientId: String,
    val patientNombre: String,
    val patientWhatsapp: String,
    val scheduledAt: Instant,
    val motivo: String,
    val whatsappReminder: Boolean = true,
    val createdAt: Instant,
)
