package com.ceoclinicos.clinicosdoc.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.model.Appointment
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object WhatsAppHelper {
    private val dateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy 'a las' HH:mm")
        .withZone(ZoneId.systemDefault())

    fun buildReminderMessage(context: Context, appointment: Appointment): String {
        val doctor = DoctorStorage.loadProfile(context)?.nombre?.ifBlank { "su médico" } ?: "su médico"
        val fecha = dateTimeFormatter.format(appointment.scheduledAt)
        return buildString {
            append("Hola ${appointment.patientNombre}, le saluda el consultorio de $doctor. ")
            append("Le recordamos su cita el $fecha.")
            if (appointment.motivo.isNotBlank()) {
                append("\n\nPor favor traiga o tenga listo: ${appointment.motivo}")
            }
            append("\n\nGracias.")
        }
    }

    fun openChat(context: Context, phone: String, message: String): Boolean {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 10) {
            Toast.makeText(context, "Número de WhatsApp inválido", Toast.LENGTH_SHORT).show()
            return false
        }
        val uri = Uri.parse("https://wa.me/$digits?text=${Uri.encode(message)}")
        val intent = Intent(Intent.ACTION_VIEW, uri)
        return try {
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            Toast.makeText(context, "WhatsApp no está instalado", Toast.LENGTH_SHORT).show()
            false
        }
    }
}
