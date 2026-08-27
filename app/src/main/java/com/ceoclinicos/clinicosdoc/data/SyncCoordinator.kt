package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

object SyncCoordinator {
    private const val TAG = "SyncCoordinator"
    private const val MIN_FLUSH_INTERVAL_MS = 45_000L
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var suppressDepth = 0
    private val flushMutex = Mutex()
    @Volatile private var flushing = false

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

    fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Solo reenvía pendientes (no todo el catálogo). Poco tráfico. */
    fun flushPending(context: Context, force: Boolean = false, quiet: Boolean = false) {
        val appContext = context.applicationContext
        if (!canSync(appContext) || !isOnline(appContext)) return
        if (PendingSyncStore.count(appContext) == 0) return
        if (!force &&
            System.currentTimeMillis() - PendingSyncStore.lastFlushMs(appContext) < MIN_FLUSH_INTERVAL_MS
        ) {
            return
        }
        if (flushing) return
        flushing = true
        scope.launch {
            try {
                flushMutex.withLock {
                    val userId = DoctorStorage.userId(appContext) ?: return@withLock
                    var ok = 0
                    for (item in PendingSyncStore.list(appContext)) {
                        try {
                            when (item.kind) {
                                "document" -> {
                                    val doc = DocumentStorage.loadAll(appContext)
                                        .firstOrNull { it.id == item.id }
                                    if (doc == null) {
                                        PendingSyncStore.clear(appContext, item.kind, item.id)
                                        continue
                                    }
                                    CloudSyncService.pushDocument(appContext, userId, doc)
                                }
                                "template" -> {
                                    val tpl = TemplateStorage.loadAll(appContext)
                                        .firstOrNull { it.id == item.id }
                                    if (tpl == null) {
                                        PendingSyncStore.clear(appContext, item.kind, item.id)
                                        continue
                                    }
                                    CloudSyncService.pushTemplate(appContext, userId, tpl)
                                }
                                "header" -> {
                                    val hdr = HeaderStorage.loadAll(appContext)
                                        .firstOrNull { it.id == item.id }
                                    if (hdr == null) {
                                        PendingSyncStore.clear(appContext, item.kind, item.id)
                                        continue
                                    }
                                    CloudSyncService.pushHeader(appContext, userId, hdr)
                                }
                                else -> {
                                    PendingSyncStore.clear(appContext, item.kind, item.id)
                                    continue
                                }
                            }
                            PendingSyncStore.clear(appContext, item.kind, item.id)
                            ok += 1
                        } catch (e: Exception) {
                            Log.w(TAG, "flush ${item.kind}/${item.id}: ${e.message}")
                        }
                    }
                    PendingSyncStore.markFlushed(appContext)
                    if (ok > 0 && !quiet) {
                        PendingSyncStore.toast(
                            appContext,
                            if (ok == 1) "1 pendiente enviado a la nube"
                            else "$ok pendientes enviados a la nube",
                        )
                    }
                }
            } finally {
                flushing = false
            }
        }
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
        val appContext = context.applicationContext
        val label = document.patientNombre.ifBlank { "Documento" }
        if (!canSync(context) || !isOnline(appContext)) {
            PendingSyncStore.mark(appContext, "document", document.id, label)
            PendingSyncStore.toast(appContext, "Sin conexión, se enviará luego", long = true)
            return
        }
        PendingSyncStore.mark(appContext, "document", document.id, label)
        PendingSyncStore.toast(appContext, "Sincronizando…")
        launchImmediate(context) { userId ->
            try {
                val latest = DocumentStorage.loadAll(appContext).firstOrNull { it.id == document.id }
                    ?: document
                CloudSyncService.pushDocument(appContext, userId, latest)
                PendingSyncStore.clear(appContext, "document", document.id)
                PendingSyncStore.toast(appContext, "Guardado en la nube")
            } catch (e: Exception) {
                Log.e(TAG, "Error al sincronizar documento: ${e.message}", e)
                PendingSyncStore.mark(appContext, "document", document.id, label)
                PendingSyncStore.toast(appContext, "No sincronizado; pendiente de enviar", long = true)
            }
        }
    }

    fun afterDocumentDeleted(context: Context, documentId: String) {
        val appContext = context.applicationContext
        launchImmediate(context) { userId ->
            CloudSyncService.deleteDocument(appContext, userId, documentId)
        }
    }

    fun afterTemplateSaved(context: Context, template: DocumentTemplate) {
        val appContext = context.applicationContext
        val label = template.name.ifBlank { "Plantilla" }
        if (!canSync(context) || !isOnline(appContext)) {
            PendingSyncStore.mark(appContext, "template", template.id, label)
            PendingSyncStore.toast(appContext, "Sin conexión, se enviará luego", long = true)
            return
        }
        PendingSyncStore.mark(appContext, "template", template.id, label)
        PendingSyncStore.toast(appContext, "Sincronizando…")
        launchImmediate(context) { userId ->
            try {
                val latest = TemplateStorage.loadAll(appContext).firstOrNull { it.id == template.id }
                    ?: template
                CloudSyncService.pushTemplate(appContext, userId, latest)
                PendingSyncStore.clear(appContext, "template", template.id)
                PendingSyncStore.toast(appContext, "Guardado en la nube")
            } catch (e: Exception) {
                Log.e(TAG, "Error al sincronizar plantilla: ${e.message}", e)
                PendingSyncStore.mark(appContext, "template", template.id, label)
                PendingSyncStore.toast(appContext, "No sincronizado; pendiente de enviar", long = true)
            }
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
