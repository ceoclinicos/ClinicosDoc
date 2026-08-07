package com.ceoclinicos.clinicosdoc

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.ceoclinicos.clinicosdoc.data.ClinicService
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.receiver.AppointmentReminderReceiver
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.ceoclinicos.clinicosdoc.ui.navigation.ClinicosDocNavHost
import com.ceoclinicos.clinicosdoc.ui.theme.ClinicosDocTheme
import com.ceoclinicos.clinicosdoc.util.WhatsAppHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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

    override fun onStart() {
        super.onStart()
        // Al abrir/volver a la app: confirmar clínicas y descargar moldes si hay novedades
        if (DoctorStorage.loadProfile(this) == null) return
        if (!DoctorAuthService.isConfigured(this)) return
        lifecycleScope.launch(Dispatchers.IO) {
            runCatching { ClinicService.syncAffiliationsOnEnter(applicationContext) }
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
