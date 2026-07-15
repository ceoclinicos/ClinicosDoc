package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.util.Log
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

object SyncCoordinator {
    private const val TAG = "SyncCoordinator"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var suppressDepth = 0

    fun <T> withoutSync(block: () -> T): T {
        suppressDepth++
        return try {
            block()
        } finally {
            suppressDepth--
        }
    }

    private fun canSync(context: Context): Boolean {
        if (suppressDepth > 0) return false
        val userId = DoctorStorage.userId(context) ?: return false
        return DoctorAuthService.isConfigured(context) && userId.isNotBlank()
    }

    private fun launchImmediate(context: Context, block: suspend (userId: String) -> Unit) {
        if (!canSync(context)) return
        val userId = DoctorStorage.userId(context) ?: return
        val appContext = context.applicationContext
        scope.launch {
            try {
                block(userId)
            } catch (e: Exception) {
                Log.e(TAG, "Error al sincronizar: ${e.message}", e)
            }
        }
    }

    private fun scheduleDebounced(
        context: Context,
        key: String,
        block: suspend (userId: String, appContext: Context) -> Unit,
    ) {
        if (!canSync(context)) return
        val appContext = context.applicationContext
        DebouncedCloudSync.schedule(key) {
            val userId = DoctorStorage.userId(appContext) ?: return@schedule
            if (!DoctorAuthService.isConfigured(appContext)) return@schedule
            block(userId, appContext)
        }
    }

    fun afterPatientSaved(context: Context, patient: Patient) {
        scheduleDebounced(context, "patient:${patient.id}") { userId, appContext ->
            val latest = PatientStorage.loadAll(appContext).firstOrNull { it.id == patient.id } ?: return@scheduleDebounced
            CloudSyncService.pushPatient(appContext, userId, latest)
        }
    }

    fun afterDocumentSaved(context: Context, document: ClinicalDocument) {
        scheduleDebounced(context, "document:${document.id}") { userId, appContext ->
            val latest = DocumentStorage.loadAll(appContext).firstOrNull { it.id == document.id } ?: return@scheduleDebounced
            CloudSyncService.pushDocument(appContext, userId, latest)
        }
    }

    fun afterDocumentDeleted(context: Context, documentId: String) {
        val appContext = context.applicationContext
        launchImmediate(context) { userId ->
            CloudSyncService.deleteDocument(appContext, userId, documentId)
        }
    }

    fun afterTemplateSaved(context: Context, template: DocumentTemplate) {
        scheduleDebounced(context, "template:${template.id}") { userId, appContext ->
            val latest = TemplateStorage.loadAll(appContext).firstOrNull { it.id == template.id } ?: return@scheduleDebounced
            CloudSyncService.pushTemplate(appContext, userId, latest)
        }
    }

    fun afterTemplateDeleted(context: Context, templateId: String) {
        val appContext = context.applicationContext
        launchImmediate(context) { userId ->
            CloudSyncService.deleteTemplate(appContext, userId, templateId)
        }
    }

    fun afterHeaderSaved(context: Context, header: DocumentHeader) {
        scheduleDebounced(context, "header:${header.id}") { userId, appContext ->
            val latest = HeaderStorage.loadAll(appContext).firstOrNull { it.id == header.id } ?: return@scheduleDebounced
            CloudSyncService.pushHeader(appContext, userId, latest)
        }
    }

    fun afterHeaderDeleted(context: Context, headerId: String) {
        val appContext = context.applicationContext
        launchImmediate(context) { userId ->
            CloudSyncService.deleteHeader(appContext, userId, headerId)
        }
    }

    fun afterAppointmentSaved(context: Context, appointment: Appointment) {
        scheduleDebounced(context, "appointment:${appointment.id}") { userId, appContext ->
            val latest = AppointmentStorage.loadAll(appContext).firstOrNull { it.id == appointment.id }
                ?: return@scheduleDebounced
            CloudSyncService.pushAppointment(appContext, userId, latest)
        }
    }

    fun afterAppointmentDeleted(context: Context, appointmentId: String) {
        val appContext = context.applicationContext
        launchImmediate(context) { userId ->
            CloudSyncService.deleteAppointment(appContext, userId, appointmentId)
        }
    }

    fun afterProfileSaved(context: Context, profile: DoctorProfile) {
        scheduleDebounced(context, "profile") { userId, appContext ->
            val latest = DoctorStorage.loadProfile(appContext) ?: profile
            CloudSyncService.pushProfile(appContext, userId, latest)
        }
    }

    fun afterTemplatesBulkSaved(context: Context) {
        scheduleDebounced(context, "templates:bulk") { userId, appContext ->
            TemplateStorage.loadAll(appContext).forEach { template ->
                CloudSyncService.pushTemplate(appContext, userId, template)
            }
        }
    }

    fun afterHeadersBulkSaved(context: Context) {
        scheduleDebounced(context, "headers:bulk") { userId, appContext ->
            HeaderStorage.loadAll(appContext).forEach { header ->
                CloudSyncService.pushHeader(appContext, userId, header)
            }
        }
    }

    fun afterPhysicalExamSystemSaved(context: Context, system: PhysicalExamSystem) {
        scheduleDebounced(context, "physical_exam:${system.id}") { userId, appContext ->
            val latest = PhysicalExamCatalogStorage.loadAll(appContext).firstOrNull { it.id == system.id }
                ?: return@scheduleDebounced
            CloudSyncService.pushPhysicalExamSystem(appContext, userId, latest)
        }
    }

    fun afterPhysicalExamSystemDeleted(context: Context, systemId: String) {
        launchImmediate(context) { userId ->
            CloudSyncService.deletePhysicalExamSystem(context.applicationContext, userId, systemId)
        }
    }

    fun afterPhysicalExamCatalogBulkSaved(context: Context) {
        scheduleDebounced(context, "physical_exam:bulk") { userId, appContext ->
            PhysicalExamCatalogStorage.loadAll(appContext).forEach { system ->
                CloudSyncService.pushPhysicalExamSystem(appContext, userId, system)
            }
        }
    }

    fun afterDraftSaved(context: Context, draft: ClinicalDraft) {
        scheduleDebounced(context, "draft:${draft.id}") { userId, appContext ->
            val latest = DraftStorage.findById(appContext, draft.id) ?: return@scheduleDebounced
            CloudSyncService.pushDraft(appContext, userId, latest)
        }
    }

    fun afterDraftDeleted(context: Context, draftId: String) {
        launchImmediate(context) { userId ->
            CloudSyncService.deleteDraft(context.applicationContext, userId, draftId)
        }
    }
}
