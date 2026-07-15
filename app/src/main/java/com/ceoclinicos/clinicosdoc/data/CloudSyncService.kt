package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.util.Log
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.HeaderInfoLine
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.ceoclinicos.clinicosdoc.model.EmergencyContact
import com.ceoclinicos.clinicosdoc.model.EmergencyFicha
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.ceoclinicos.clinicosdoc.util.PatientFirestoreId
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.tasks.await
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
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
        val drafts = fetchDrafts(userId)

        val hasCloudData = patients.isNotEmpty() ||
            documents.isNotEmpty() ||
            templates.isNotEmpty() ||
            headers.isNotEmpty() ||
            appointments.isNotEmpty() ||
            physicalExam.isNotEmpty() ||
            drafts.isNotEmpty()

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
            if (drafts.isNotEmpty()) DraftStorage.saveAllLocal(context, drafts)
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
        DraftStorage.loadAll(context).forEach { pushDraft(context, userId, it) }
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
            put("cedulaKey", CedulaNormalizer.normalize(patient.cedula))
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

    /** Busca pacientes en la BD global por cédula (compartida entre médicos). */
    suspend fun findGlobalByCedula(cedula: String): List<Patient> {
        val key = CedulaNormalizer.normalize(cedula)
        if (key.isBlank()) return emptyList()
        val col = FirebaseFirestore.getInstance().collection(FirestorePaths.GLOBAL_PATIENTS)
        val byKey = col.whereEqualTo("cedulaKey", key).get().await().documents.mapNotNull { it.toPatient() }
        if (byKey.isNotEmpty()) return byKey.distinctBy { it.id }

        val raw = cedula.trim()
        val variants = CedulaNormalizer.lookupKeys(cedula) + listOf(raw)
        val found = mutableListOf<Patient>()
        for (variant in variants.distinct()) {
            col.whereEqualTo("cedula", variant).get().await().documents.mapNotNull { it.toPatient() }
                .forEach { found.add(it) }
            if (found.isNotEmpty()) break
        }
        val digits = CedulaNormalizer.digitsOnly(cedula)
        return found
            .filter { CedulaNormalizer.digitsOnly(it.cedula) == digits || CedulaNormalizer.normalize(it.cedula) == key }
            .distinctBy { it.id }
    }

    /**
     * Paciente del portal (modo paciente) en colección `pacientes/{cedula}`.
     * Cubre registro web paciente que no está en clinicosdoc_patients.
     */
    suspend fun findPortalPatientByCedula(cedula: String): Patient? {
        val db = FirebaseFirestore.getInstance()
        for (key in CedulaNormalizer.lookupKeys(cedula)) {
            val snap = db.collection(FirestorePaths.PORTAL_PACIENTES).document(key).get().await()
            if (!snap.exists()) continue
            return snap.toPortalPatient() ?: continue
        }
        return null
    }

    /** Primero global de médicos; si no, portal modo paciente. */
    suspend fun findPatientByCedulaAnywhere(cedula: String): Patient? {
        findGlobalByCedula(cedula).firstOrNull()?.let { return it }
        return findPortalPatientByCedula(cedula)
    }

    suspend fun findEmergencyFichaByCedula(cedula: String): EmergencyFicha? {
        val db = FirebaseFirestore.getInstance()
        for (key in CedulaNormalizer.lookupKeys(cedula)) {
            val snap = db.collection(FirestorePaths.PORTAL_PACIENTES).document(key).get().await()
            if (!snap.exists()) continue
            val ficha = snap.toEmergencyFicha()
            if (ficha != null && ficha.activo) return ficha
        }
        return null
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
        val ready = HeaderStorage.ensureLogoBase64(header)
        headersRef(userId).document(header.id)
            .set(ready.toSyncDto().toMap())
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

    suspend fun pushDraft(context: Context, userId: String, draft: ClinicalDraft) {
        if (!DoctorAuthService.isConfigured(context)) return
        draftsRef(userId).document(draft.id).set(draft.toSyncDto().toMap()).await()
    }

    suspend fun deleteDraft(context: Context, userId: String, draftId: String) {
        if (!DoctorAuthService.isConfigured(context)) return
        draftsRef(userId).document(draftId).delete().await()
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
                    "correo" to profile.correo,
                    "nacionalidad" to profile.nacionalidad,
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

    private suspend fun fetchDrafts(userId: String): List<ClinicalDraft> =
        draftsRef(userId).get().await().documents.mapNotNull { it.toClinicalDraft() }

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

    private fun draftsRef(userId: String): CollectionReference =
        userSubcollection(userId, FirestorePaths.SUB_DRAFTS)

    private fun userSubcollection(userId: String, sub: String): CollectionReference =
        FirebaseFirestore.getInstance()
            .collection(FirestorePaths.USERS)
            .document(userId)
            .collection(sub)

    private fun mergeHeaderLogos(context: Context, cloudHeaders: List<DocumentHeader>): List<DocumentHeader> {
        val localById = HeaderStorage.loadAll(context).associateBy { it.id }
        return cloudHeaders.map { cloud ->
            val withFile = HeaderStorage.withMaterializedLogo(context, cloud)
            if (withFile.logoPath != null) return@map withFile
            val localLogo = localById[cloud.id]?.logoPath?.takeIf { path -> File(path).exists() }
            val localB64 = localById[cloud.id]?.logoBase64
            cloud.copy(
                logoPath = localLogo,
                logoBase64 = cloud.logoBase64 ?: localB64,
            )
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

    /** Doc de colección `pacientes` (portal modo paciente). */
    private fun com.google.firebase.firestore.DocumentSnapshot.toPortalPatient(): Patient? {
        val data = data ?: return null
        val cedula = (data["cedula"] as? String).orEmpty().ifBlank { id }
        val nombre = (data["nombre"] as? String).orEmpty()
        if (nombre.isBlank() || cedula.isBlank()) return null
        val edad = when (val e = data["edad"]) {
            is Number -> e.toInt()
            is String -> e.toIntOrNull() ?: 0
            else -> 0
        }
        val birthRaw = (data["fechaNacimiento"] as? String).orEmpty()
        val createdRaw = (data["createdAt"] as? String).orEmpty()
        return Patient(
            id = "portal_${CedulaNormalizer.digitsOnly(cedula).ifBlank { UUID.randomUUID().toString().take(8) }}",
            nombre = nombre,
            cedula = cedula,
            edad = edad,
            fechaNacimiento = parseFlexibleInstant(birthRaw),
            createdAt = parseFlexibleInstant(createdRaw).takeUnless { it == Instant.EPOCH } ?: Instant.now(),
            whatsapp = (data["telefono"] as? String).orEmpty(),
            sexo = (data["sexo"] as? String).orEmpty(),
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun com.google.firebase.firestore.DocumentSnapshot.toEmergencyFicha(): EmergencyFicha? {
        val raw = data?.get("fichaEmergencia") as? Map<*, *> ?: return null
        if (raw["activo"] == false) return null
        val publicId = (raw["publicId"] as? String).orEmpty()
        if (publicId.isBlank()) return null
        val contactosRaw = raw["contactos"] as? List<*> ?: emptyList<Any>()
        val contactos = contactosRaw.mapNotNull { item ->
            val m = item as? Map<*, *> ?: return@mapNotNull null
            EmergencyContact(
                nombre = (m["nombre"] as? String).orEmpty(),
                telefono = (m["telefono"] as? String).orEmpty(),
                parentesco = (m["parentesco"] as? String).orEmpty(),
            )
        }
        return EmergencyFicha(
            publicId = publicId,
            patientCedula = (raw["patientCedula"] as? String).orEmpty().ifBlank { id },
            nombre = (raw["nombre"] as? String).orEmpty(),
            tipoSangre = (raw["tipoSangre"] as? String).orEmpty().ifBlank { "Desconocido" },
            alergias = (raw["alergias"] as? String).orEmpty(),
            condiciones = (raw["condiciones"] as? String).orEmpty(),
            medicamentos = (raw["medicamentos"] as? String).orEmpty(),
            contactos = contactos,
            updatedAt = (raw["updatedAt"] as? String).orEmpty(),
            activo = true,
        )
    }

    private fun parseFlexibleInstant(raw: String): Instant {
        if (raw.isBlank()) return Instant.EPOCH
        runCatching { Instant.parse(raw) }.getOrNull()?.let { return it }
        runCatching {
            LocalDate.parse(raw.take(10)).atStartOfDay(ZoneId.systemDefault()).toInstant()
        }.getOrNull()?.let { return it }
        return Instant.EPOCH
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

    private fun com.google.firebase.firestore.DocumentSnapshot.toClinicalDraft(): ClinicalDraft? {
        val dto = toMapData()?.toDto<ClinicalDraftDto>() ?: return null
        return ClinicalDraft(
            id = dto.id,
            patientId = dto.patientId,
            patientNombre = dto.patientNombre,
            patientCedula = dto.patientCedula,
            documentType = DocumentType.fromName(dto.documentType),
            dictation = dto.dictation,
            templateId = dto.templateId,
            templateName = dto.templateName,
            headerId = dto.headerId,
            generatedContent = dto.generatedContent,
            membrete = if (
                dto.membreteNombre != null ||
                dto.membreteEdad != null ||
                dto.membreteSexo != null ||
                dto.membreteFechaNacimiento != null ||
                dto.membreteFecha != null
            ) {
                PatientMembrete(
                    nombre = dto.membreteNombre.orEmpty(),
                    edad = dto.membreteEdad.orEmpty(),
                    sexo = dto.membreteSexo.orEmpty(),
                    fechaNacimiento = dto.membreteFechaNacimiento.orEmpty(),
                    fecha = dto.membreteFecha.orEmpty(),
                )
            } else {
                null
            },
            createdAt = Instant.parse(dto.createdAt),
            updatedAt = Instant.parse(dto.updatedAt),
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
        cedulaKey = CedulaNormalizer.normalize(cedula),
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
        membreteFechaNacimiento = membrete?.fechaNacimiento,
        membreteFecha = membrete?.fecha,
        doctorId = doctorId,
        doctorNombre = doctorNombre,
        patientFirestoreKey = patientFirestoreKey,
    )

    private fun DocumentHeader.toSyncDto() = DocumentHeaderDto(
        id = id,
        name = name,
        logoPath = null,
        logoBase64 = logoBase64,
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

    private fun ClinicalDraft.toSyncDto() = ClinicalDraftDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        documentType = DocumentType.storageName(documentType),
        dictation = dictation,
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        generatedContent = generatedContent,
        membreteNombre = membrete?.nombre,
        membreteEdad = membrete?.edad,
        membreteSexo = membrete?.sexo,
        membreteFechaNacimiento = membrete?.fechaNacimiento,
        membreteFecha = membrete?.fecha,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
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
        val hasData = listOf(
            membreteNombre,
            membreteEdad,
            membreteSexo,
            membreteFechaNacimiento,
            membreteFecha,
        ).any { !it.isNullOrBlank() }
        if (!hasData) return null
        return PatientMembrete(
            nombre = membreteNombre.orEmpty(),
            edad = membreteEdad.orEmpty(),
            sexo = membreteSexo.orEmpty(),
            fechaNacimiento = membreteFechaNacimiento.orEmpty(),
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
            logoBase64 = logoBase64,
            doctorName = doctorName ?: "",
            subtitle = subtitle ?: "",
            description = description ?: "",
            infoLines = lines.take(4),
            isDefault = isDefault ?: false,
            headerType = HeaderType.fromStorage(headerType),
        )
    }
}
