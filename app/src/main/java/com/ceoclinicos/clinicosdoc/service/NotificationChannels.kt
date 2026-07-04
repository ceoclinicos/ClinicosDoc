package com.ceoclinicos.clinicosdoc.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

object NotificationChannels {
    const val APPOINTMENTS = "citas_whatsapp"

    fun ensure(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            APPOINTMENTS,
            "Recordatorios de citas",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Avisos para enviar recordatorio por WhatsApp"
        }
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
}
