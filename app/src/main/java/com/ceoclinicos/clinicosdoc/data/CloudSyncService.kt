package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.util.Log
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.HeaderInfoLine
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.ceoclinicos.clinicosdoc.util.PatientFirestoreId
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.tasks.await
import java.io.File
import java.time.Instant

object CloudSyncService {
    private const val TAG = "CloudSyncService"
    private val gson = Gson()

    suspend fun syncOnLogin(context: Context, userId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        val appContext = context.applicationContext
        try {
            val hasCloudData = pullAll(appContext, userId)
            if (!hasCloudData) {
                pushAllLocal(appContext, userId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "syncOnLogin falló: ${e.message}", e)
        }
    }

    suspend fun pullAll(context: Context, userId: String): Boolean {
        val patients = fetchPatients(userId)
        val documents = fetchDocuments(userId)
        val templates = fetchTemplates(userId)
        val headers = fetchHeaders(userId)
        val appointments = fetchAppointments(userId)
        val physicalExam = fetchPhysicalExamSystems(userId)

        val hasCloudData = patients.isNotEmpty() ||
            documents.isNotEmpty() ||
            templates.isNotEmpty() ||
            headers.isNotEmpty() ||
            appointments.isNotEmpty() ||
            physicalExam.isNotEmpty()

        if (!hasCloudData) return false

        SyncCoordinator.withoutSync {
            if (patients.isNotEmpty()) PatientStorage.saveAllLocal(context, patients)
            if (documents.isNotEmpty()) DocumentStorage.saveAllLocal(context, documents)
            if (templates.isNotEmpty()) TemplateStorage.saveAllLocal(context, templates)
            if (headers.isNotEmpty()) {
                HeaderStorage.saveAllLocal(context, mergeHeaderLogos(context, headers))
            }
            if (appointments.isNotEmpty()) AppointmentStorage.saveAllLocal(context, appointments)
            if (physicalExam.isNotEmpty()) PhysicalExamCatalogStorage.saveAllLocal(context, physicalExam)
        }
        return true
    }

    suspend fun pushAllLocal(context: Context, userId: String) {
        PatientStorage.loadAll(context).forEach { pushPatient(context, userId, it) }
        DocumentStorage.loadAll(context).forEach { pushDocument(context, userId, it) }
        TemplateStorage.loadAll(context).forEach { pushTemplate(context, userId, it) }
        HeaderStorage.loadAll(context).forEach { pushHeader(context, userId, it) }
        AppointmentStorage.loadAll(context).forEach { pushAppointment(context, userId, it) }
        PhysicalExamCatalogStorage.loadAll(context).forEach { pushPhysicalExamSystem(context, userId, it) }
    }

    suspend fun pushPatient(context: Context, userId: String, patient: Patient) {
        if (!DoctorAuthService.isConfigured(context)) return
        patientsRef(userId).document(patient.id).set(patient.toDto().toMap()).await()
        pushGlobalPatient(userId, patient)
    }

    private suspend fun pushGlobalPatient(userId: String, patient: Patient) {
        val key = PatientFirestoreId.from(patient)
        val now = Instant.now().toString()
        val payload = patient.toDto().toMap().toMutableMap().apply {
            put("firestoreKey", key)
            put("updatedAt", now)
            put("lastUpdatedByDoctorId", userId)
        }
        FirebaseFirestore.getInstance()
            .collection(FirestorePaths.GLOBAL_PATIENTS)
            .document(key)
            .set(payload, SetOptions.merge())
            .await()
    }

    suspend fun pushDocument(context: Context, userId: String, document: ClinicalDocument) {
        if (!DoctorAuthService.isConfigured(context)) return
        val profile = DoctorStorage.loadProfile(context)
        val doctorNombre = profile?.nombre.orEmpty()
        documentsRef(userId).document(document.id)
            .set(document.toSyncDto(doctorId = userId, doctorNombre = doctorNombre).toMap())
            .await()
        pushGlobalDocument(userId, doctorNombre, document)
    }

    private suspend fun pushGlobalDocument(userId: String, doctorNombre: String, document: ClinicalDocument) {
        val patientKey = PatientFirestoreId.from(document.patientCedula, document.patientNombre)
        val dto = document.toSyncDto(
            doctorId = userId,
            doctorNombre = doctorNombre,
            patientFirestoreKey = patientKey,
        )
        globalPatientDocumentsRef(patientKey)
            .document(document.id)
            .set(dto.toMap(), SetOptions.merge())
            .await()
    }

    suspend fun deleteDocument(context: Context, userId: String, documentId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        val local = DocumentStorage.loadAll(context).firstOrNull { it.id == documentId }
        documentsRef(userId).document(documentId).delete().await()
        local?.let {
            val key = PatientFirestoreId.from(it.patientCedula, it.patientNombre)
            globalPatientDocumentsRef(key).document(documentId).delete().await()
        }
    }

    /** Informes de un paciente escritos por todos los médicos. */
    suspend fun fetchGlobalPatientDocuments(patientKey: String): List<ClinicalDocument> =
        globalPatientDocumentsRef(patientKey).get().await().documents.mapNotNull { it.toClinicalDocument() }

    suspend fun fetchGlobalPatient(patientKey: String): Patient? {
        val snap = FirebaseFirestore.getInstance()
            .collection(FirestorePaths.GLOBAL_PATIENTS)
            .document(patientKey)
            .get()
            .await()
        return snap.toPatient()
    }

    suspend fun pushTemplate(context: Context, userId: String, template: DocumentTemplate) {
        if (!DoctorAuthService.isConfigured(context)) return
        templatesRef(userId).document(template.id).set(template.toDto().toMap()).await()
    }

    suspend fun deleteTemplate(context: Context, userId: String, templateId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        templatesRef(userId).document(templateId).delete().await()
    }

    suspend fun pushHeader(context: Context, userId: String, header: DocumentHeader) {
        if (!DoctorAuthService.isConfigured(context)) return
        headersRef(userId).document(header.id)
            .set(header.toSyncDto().toMap())
            .await()
    }

    suspend fun deleteHeader(context: Context, userId: String, headerId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        headersRef(userId).document(headerId).delete().await()
    }

    suspend fun pushAppointment(context: Context, userId: String, appointment: Appointment) {
        if (!DoctorAuthService.isConfigured(context)) return
        appointmentsRef(userId).document(appointment.id)
            .set(appointment.toDto().toMap())
            .await()
    }

    suspend fun deleteAppointment(context: Context, userId: String, appointmentId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        appointmentsRef(userId).document(appointmentId).delete().await()
    }

    suspend fun pushPhysicalExamSystem(context: Context, userId: String, system: PhysicalExamSystem) {
        if (!DoctorAuthService.isConfigured(context)) return
        physicalExamRef(userId).document(system.id).set(system.toCloudDto().toMap()).await()
    }

    suspend fun deletePhysicalExamSystem(context: Context, userId: String, systemId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        physicalExamRef(userId).document(systemId).delete().await()
    }

    suspend fun pushProfile(context: Context, userId: String, profile: DoctorProfile) {
        if (!DoctorAuthService.isConfigured(context)) return
        FirebaseFirestore.getInstance()
            .collection(FirestorePaths.USERS)
            .document(userId)
            .set(
                mapOf(
                    "nombre" to profile.nombre,
                    "cedula" to profile.cedula,
                    "mpps" to profile.mpps,
                    "sexo" to profile.sexo,
                    "especialidad" to profile.especialidad,
                    "whatsapp" to profile.whatsapp,
                ),
                SetOptions.merge(),
            )
            .await()
    }

    private suspend fun fetchPatients(userId: String): List<Patient> =
        patientsRef(userId).get().await().documents.mapNotNull { it.toPatient() }

    private suspend fun fetchDocuments(userId: String): List<ClinicalDocument> =
        documentsRef(userId).get().await().documents.mapNotNull { it.toClinicalDocument() }

    private suspend fun fetchTemplates(userId: String): List<DocumentTemplate> =
        templatesRef(userId).get().await().documents.mapNotNull { it.toDocumentTemplate() }

    private suspend fun fetchHeaders(userId: String): List<DocumentHeader> =
        headersRef(userId).get().await().documents.mapNotNull { it.toDocumentHeader() }

    private suspend fun fetchAppointments(userId: String): List<Appointment> =
        appointmentsRef(userId).get().await().documents.mapNotNull { it.toAppointment() }

    private suspend fun fetchPhysicalExamSystems(userId: String): List<PhysicalExamSystem> =
        physicalExamRef(userId).get().await().documents.mapNotNull { it.toPhysicalExamSystem() }

    private fun globalPatientDocumentsRef(patientKey: String): CollectionReference =
        FirebaseFirestore.getInstance()
            .collection(FirestorePaths.GLOBAL_PATIENTS)
            .document(patientKey)
            .collection(FirestorePaths.SUB_DOCUMENTS)

    private fun patientsRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_PATIENTS)

    private fun documentsRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_DOCUMENTS)

    private fun templatesRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_TEMPLATES)

    private fun headersRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_HEADERS)

    private fun appointmentsRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_APPOINTMENTS)

    private fun physicalExamRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_PHYSICAL_EXAM)

    private fun userSubcollection(userId: String, sub: String): CollectionReference =
        FirebaseFirestore.getInstance()
            .collection(FirestorePaths.USERS)
            .document(userId)
            .collection(sub)

    private fun mergeHeaderLogos(context: Context, cloudHeaders: List<DocumentHeader>): List<DocumentHeader> {
        val localById = HeaderStorage.loadAll(context).associateBy { it.id }
        return cloudHeaders.map { cloud ->
            val localLogo = localById[cloud.id]?.logoPath?.takeIf { path -> File(path).exists() }
            cloud.copy(logoPath = localLogo)
        }
    }

    private fun Any.toMap(): Map<String, Any?> {
        val json = gson.toJson(this)
        val type = object : TypeToken<Map<String, Any?>>() {}.type
        return gson.fromJson(json, type)
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toMapData(): Map<String, Any?>? =
        data?.mapValues { it.value }

    private fun com.google.firebase.firestore.DocumentSnapshot.toPatient(): Patient? {
        val dto = toMapData()?.toDto<PatientDto>() ?: return null
        return Patient(
            id = dto.id,
            nombre = dto.nombre,
            cedula = dto.cedula,
            edad = dto.edad,
            fechaNacimiento = Instant.parse(dto.fechaNacimiento),
            createdAt = Instant.parse(dto.createdAt),
            whatsapp = dto.whatsapp.orEmpty(),
            sexo = dto.sexo.orEmpty(),
        )
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toClinicalDocument(): ClinicalDocument? {
        val dto = toMapData()?.toDto<ClinicalDocumentDto>() ?: return null
        return ClinicalDocument(
            id = dto.id,
            patientId = dto.patientId,
            patientNombre = dto.patientNombre,
            patientCedula = dto.patientCedula,
            type = DocumentType.fromName(dto.type),
            content = dto.content,
            rawDictation = dto.rawDictation.orEmpty(),
            createdAt = Instant.parse(dto.createdAt),
            templateId = dto.templateId,
            templateName = dto.templateName,
            headerId = dto.headerId,
            headerSnapshot = dto.headerSnapshot?.toHeaderModel(),
            membrete = dto.toMembrete(),
        )
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toDocumentTemplate(): DocumentTemplate? {
        val dto = toMapData()?.toDto<DocumentTemplateDto>() ?: return null
        return DocumentTemplate(
            id = dto.id,
            name = dto.name,
            documentType = DocumentType.fromName(dto.documentType),
            sections = dto.sections,
            isDefault = dto.isDefault ?: false,
            enabledPhysicalExamSystemIds = dto.enabledPhysicalExamSystemIds.orEmpty(),
            physicalExamTextOverrides = dto.physicalExamTextOverrides.orEmpty(),
            enfermedadActualEjemplo = dto.enfermedadActualEjemplo.orEmpty(),
            sectionLayoutOrder = dto.sectionLayoutOrder.orEmpty(),
        )
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toPhysicalExamSystem(): PhysicalExamSystem? {
        val dto = toMapData()?.toDto<PhysicalExamSystemCloudDto>() ?: return null
        return PhysicalExamSystem(
            id = dto.id,
            name = dto.name,
            defaultText = dto.defaultText,
            sortOrder = dto.sortOrder,
        )
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toDocumentHeader(): DocumentHeader? {
        val dto = toMapData()?.toDto<DocumentHeaderDto>() ?: return null
        return dto.toHeaderModel()
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toAppointment(): Appointment? {
        val dto = toMapData()?.toDto<AppointmentDto>() ?: return null
        return Appointment(
            id = dto.id,
            patientId = dto.patientId,
            patientNombre = dto.patientNombre,
            patientWhatsapp = dto.patientWhatsapp,
            scheduledAt = Instant.parse(dto.scheduledAt),
            motivo = dto.motivo,
            whatsappReminder = dto.whatsappReminder ?: true,
            createdAt = Instant.parse(dto.createdAt),
        )
    }

    private inline fun <reified T> Map<String, Any?>.toDto(): T {
        val json = gson.toJson(this)
        return gson.fromJson(json, T::class.java)
    }

    private fun Patient.toDto() = PatientDto(
        id = id,
        nombre = nombre,
        cedula = cedula,
        edad = edad,
        fechaNacimiento = fechaNacimiento.toString(),
        createdAt = createdAt.toString(),
        whatsapp = whatsapp,
        sexo = sexo,
    )

    private fun ClinicalDocument.toSyncDto(
        doctorId: String? = null,
        doctorNombre: String? = null,
        patientFirestoreKey: String? = null,
    ) = ClinicalDocumentDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        type = DocumentType.storageName(type),
        content = content,
        rawDictation = rawDictation,
        createdAt = createdAt.toString(),
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        headerSnapshot = headerSnapshot?.toSyncDto(),
        membreteNombre = membrete?.nombre,
        membreteEdad = membrete?.edad,
        membreteSexo = membrete?.sexo,
        membreteFecha = membrete?.fecha,
        doctorId = doctorId,
        doctorNombre = doctorNombre,
        patientFirestoreKey = patientFirestoreKey,
    )

    private fun DocumentHeader.toSyncDto() = DocumentHeaderDto(
        id = id,
        name = name,
        logoPath = null,
        doctorName = doctorName,
        subtitle = subtitle,
        description = description,
        infoLines = infoLines.map { HeaderInfoLineDto(it.label, it.value) },
        isDefault = isDefault,
        headerType = headerType.name,
    )

    private fun DocumentHeader.toDto() = toSyncDto()

    private fun DocumentTemplate.toDto() = DocumentTemplateDto(
        id = id,
        name = name,
        documentType = DocumentType.storageName(documentType),
        sections = sections,
        isDefault = isDefault,
        enabledPhysicalExamSystemIds = enabledPhysicalExamSystemIds,
        physicalExamTextOverrides = physicalExamTextOverrides,
        enfermedadActualEjemplo = enfermedadActualEjemplo,
        sectionLayoutOrder = sectionLayoutOrder,
    )

    private fun PhysicalExamSystem.toCloudDto() = PhysicalExamSystemCloudDto(
        id = id,
        name = name,
        defaultText = defaultText,
        sortOrder = sortOrder,
    )

    private fun Appointment.toDto() = AppointmentDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientWhatsapp = patientWhatsapp,
        scheduledAt = scheduledAt.toString(),
        motivo = motivo,
        whatsappReminder = whatsappReminder,
        createdAt = createdAt.toString(),
    )

    private fun ClinicalDocumentDto.toMembrete(): PatientMembrete? {
        val hasData = listOf(membreteNombre, membreteEdad, membreteSexo, membreteFecha)
            .any { !it.isNullOrBlank() }
        if (!hasData) return null
        return PatientMembrete(
            nombre = membreteNombre.orEmpty(),
            edad = membreteEdad.orEmpty(),
            sexo = membreteSexo.orEmpty(),
            fecha = membreteFecha.orEmpty(),
        )
    }

    private fun DocumentHeaderDto.toHeaderModel(): DocumentHeader {
        var lines = infoLines?.map { HeaderInfoLine(it.label ?: "", it.value ?: "") }
            ?: DocumentHeader.emptyInfoLines()
        while (lines.size < 4) {
            lines = lines + HeaderInfoLine("Dato ${lines.size + 1}", "")
        }
        return DocumentHeader(
            id = id,
            name = name,
            logoPath = null,
            doctorName = doctorName ?: "",
            subtitle = subtitle ?: "",
            description = description ?: "",
            infoLines = lines.take(4),
            isDefault = isDefault ?: false,
            headerType = HeaderType.fromStorage(headerType),
        )
    }
}
