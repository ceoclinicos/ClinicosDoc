package com.ceoclinicos.clinicosdoc

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.ceoclinicos.clinicosdoc.receiver.AppointmentReminderReceiver
import com.ceoclinicos.clinicosdoc.ui.navigation.ClinicosDocNavHost
import com.ceoclinicos.clinicosdoc.ui.theme.ClinicosDocTheme
import com.ceoclinicos.clinicosdoc.util.WhatsAppHelper

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleWhatsAppIntent(intent)
        setContent {
            ClinicosDocTheme {
                ClinicosDocNavHost()
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleWhatsAppIntent(intent)
    }

    private fun handleWhatsAppIntent(intent: android.content.Intent?) {
        if (intent?.getBooleanExtra(AppointmentReminderReceiver.EXTRA_OPEN_WHATSAPP, false) != true) return
        val phone = intent.getStringExtra(AppointmentReminderReceiver.EXTRA_WHATSAPP_PHONE).orEmpty()
        val message = intent.getStringExtra(AppointmentReminderReceiver.EXTRA_WHATSAPP_MESSAGE).orEmpty()
        if (phone.isNotBlank() && message.isNotBlank()) {
            WhatsAppHelper.openChat(this, phone, message)
        }
    }
}
