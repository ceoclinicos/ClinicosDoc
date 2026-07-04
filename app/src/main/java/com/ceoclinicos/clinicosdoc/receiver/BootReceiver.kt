package com.ceoclinicos.clinicosdoc.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ceoclinicos.clinicosdoc.service.AppointmentReminderScheduler

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            AppointmentReminderScheduler.rescheduleAll(context)
        }
    }
}
