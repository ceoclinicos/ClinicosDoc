package com.ceoclinicos.clinicosdoc.service

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.ceoclinicos.clinicosdoc.data.AppointmentStorage
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.receiver.AppointmentReminderReceiver
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit

object AppointmentReminderScheduler {
    private const val REMINDER_HOUR = 8

    fun schedule(context: Context, appointment: Appointment) {
        if (!appointment.whatsappReminder) {
            cancel(context, appointment.id)
            return
        }
        val trigger = reminderInstant(appointment) ?: return
        val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(context, AppointmentReminderReceiver::class.java).apply {
            putExtra(AppointmentReminderReceiver.EXTRA_APPOINTMENT_ID, appointment.id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            appointment.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger.toEpochMilli(), pendingIntent)
    }

    fun cancel(context: Context, appointmentId: String) {
        val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(context, AppointmentReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            appointmentId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarmManager.cancel(pendingIntent)
    }

    fun rescheduleAll(context: Context) {
        AppointmentStorage.loadAll(context)
            .filter { it.scheduledAt.isAfter(Instant.now()) }
            .forEach { schedule(context, it) }
    }

    private fun reminderInstant(appointment: Appointment): Instant? {
        val zone = ZoneId.systemDefault()
        val appt = appointment.scheduledAt
        val dayStart = appt.atZone(zone).toLocalDate().atTime(REMINDER_HOUR, 0).atZone(zone).toInstant()
        val trigger = when {
            dayStart.isAfter(Instant.now()) -> dayStart
            appt.isAfter(Instant.now().plus(30, ChronoUnit.MINUTES)) ->
                appt.minus(30, ChronoUnit.MINUTES)
            else -> null
        }
        return trigger?.takeIf { it.isAfter(Instant.now()) }
    }
}
