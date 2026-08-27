package com.ceoclinicos.clinicosdoc.util

import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object ClinicalDateTimeFormat {
    private val docDateTimeFormatter =
        DateTimeFormatter.ofPattern("dd/MM/yyyy · h:mm a", Locale.ENGLISH)
            .withZone(ZoneId.systemDefault())

    fun formatDocumentDateTime(instant: Instant): String =
        docDateTimeFormatter.format(instant).lowercase(Locale.ENGLISH)

    fun saludoHora(): String {
        val hour = LocalTime.now().hour
        return when {
            hour < 12 -> "Buenos días"
            hour < 19 -> "Buenas tardes"
            else -> "Buenas noches"
        }
    }

    fun tituloProfesional(sexo: String): String {
        val s = sexo.trim().lowercase(Locale.getDefault())
        return when {
            s == "femenino" || s == "f" || s.startsWith("fem") || s == "mujer" -> "Dra."
            else -> "Dr."
        }
    }
}
