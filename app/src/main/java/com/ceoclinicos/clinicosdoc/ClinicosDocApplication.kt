package com.ceoclinicos.clinicosdoc

import android.app.Application
import com.ceoclinicos.clinicosdoc.data.CloudSyncService
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.ceoclinicos.clinicosdoc.service.AiService
import com.ceoclinicos.clinicosdoc.service.AppointmentReminderScheduler
import com.ceoclinicos.clinicosdoc.service.NotificationChannels
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ClinicosDocApplication : Application() {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensure(this)
        appScope.launch {
            AiService.initialize(this@ClinicosDocApplication)
            TemplateStorage.ensureDefaults(this@ClinicosDocApplication)
            HeaderStorage.ensureDefaults(this@ClinicosDocApplication)
            PhysicalExamCatalogStorage.ensureDefaults(this@ClinicosDocApplication)
            AppointmentReminderScheduler.rescheduleAll(this@ClinicosDocApplication)
            val userId = DoctorStorage.userId(this@ClinicosDocApplication)
            if (userId != null && DoctorAuthService.isConfigured(this@ClinicosDocApplication)) {
                CloudSyncService.syncOnLogin(this@ClinicosDocApplication, userId)
            }
        }
    }
}
