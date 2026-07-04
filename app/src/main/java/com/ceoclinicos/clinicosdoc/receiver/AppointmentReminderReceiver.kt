package com.ceoclinicos.clinicosdoc.receiver

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.ceoclinicos.clinicosdoc.MainActivity
import com.ceoclinicos.clinicosdoc.data.AppointmentStorage
import com.ceoclinicos.clinicosdoc.service.NotificationChannels
import com.ceoclinicos.clinicosdoc.util.WhatsAppHelper

class AppointmentReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appointmentId = intent.getStringExtra(EXTRA_APPOINTMENT_ID) ?: return
        val appointment = AppointmentStorage.findById(context, appointmentId) ?: return
        if (!appointment.whatsappReminder) return

        NotificationChannels.ensure(context)
        val message = WhatsAppHelper.buildReminderMessage(context, appointment)

        val whatsappIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_WHATSAPP, true)
            putExtra(EXTRA_WHATSAPP_PHONE, appointment.patientWhatsapp)
            putExtra(EXTRA_WHATSAPP_MESSAGE, message)
        }
        val pending = PendingIntent.getActivity(
            context,
            appointmentId.hashCode(),
            whatsappIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, NotificationChannels.APPOINTMENTS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Cita hoy: ${appointment.patientNombre}")
            .setContentText("Toca para enviar recordatorio por WhatsApp")
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        context.getSystemService(NotificationManager::class.java)
            ?.notify(appointmentId.hashCode(), notification)
    }

    companion object {
        const val EXTRA_APPOINTMENT_ID = "appointment_id"
        const val EXTRA_OPEN_WHATSAPP = "open_whatsapp"
        const val EXTRA_WHATSAPP_PHONE = "whatsapp_phone"
        const val EXTRA_WHATSAPP_MESSAGE = "whatsapp_message"
    }
}
