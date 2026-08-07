package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicDoctorInvitation
import com.ceoclinicos.clinicosdoc.model.ClinicMembership
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.ceoclinicos.clinicosdoc.service.DoctorAuthService
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

object ClinicService {
    private fun db() = FirebaseFirestore.getInstance()

    private fun inviteRef(code: String) =
        db().collection(FirestorePaths.CLINIC_INVITES).document(code.trim().uppercase())

    private fun clinicRef(clinicId: String) =
        db().collection(FirestorePaths.CLINICS).document(clinicId)

    private fun membersCol(clinicId: String) =
        clinicRef(clinicId).collection(FirestorePaths.SUB_MEMBERS)

    private fun templatesCol(clinicId: String) =
        clinicRef(clinicId).collection(FirestorePaths.SUB_TEMPLATES)

    private fun headersCol(clinicId: String) =
        clinicRef(clinicId).collection(FirestorePaths.SUB_HEADERS)

    private fun documentsCol(clinicId: String) =
        clinicRef(clinicId).collection(FirestorePaths.SUB_DOCUMENTS)

    private fun membershipsCol(userId: String) =
        db().collection(FirestorePaths.USERS).document(userId)
            .collection(FirestorePaths.SUB_CLINIC_MEMBERSHIPS)

    private fun invitationsCol(clinicId: String) =
        clinicRef(clinicId).collection(FirestorePaths.SUB_INVITATIONS)

    private fun doctorPendingInvitesCol(doctorCedula: String) =
        db().collection(FirestorePaths.DOCTOR_INVITES)
            .document(CedulaNormalizer.normalize(doctorCedula))
            .collection(FirestorePaths.SUB_PENDING)

    private suspend fun writeMembership(
        context: Context,
        clinicId: String,
        clinicName: String,
        doctorCedula: String,
        doctorNombre: String,
        userId: String,
    ): ClinicMembership {
        val joinedAt = java.time.Instant.now().toString()
        membersCol(clinicId).document(doctorCedula).set(
            mapOf(
                "doctorCedula" to doctorCedula,
                "doctorNombre" to doctorNombre,
                "cloudUserId" to userId,
                "role" to "medico",
                "joinedAt" to joinedAt,
            ),
        ).await()
        membershipsCol(userId).document(clinicId).set(
            mapOf(
                "clinicId" to clinicId,
                "clinicName" to clinicName,
                "role" to "medico",
                "joinedAt" to joinedAt,
            ),
        ).await()
        val membership = ClinicMembership(clinicId = clinicId, clinicName = clinicName, role = "medico")
        ClinicMembershipStorage.upsert(context, membership)
        return membership
    }

    suspend fun joinByInvite(context: Context, inviteCode: String): ClinicMembership {
        if (!DoctorAuthService.isConfigured(context)) {
            throw IllegalStateException("Firebase no configurado")
        }
        val profile = DoctorStorage.loadProfile(context)
            ?: throw IllegalStateException("Sin sesión de médico")
        val userId = DoctorStorage.userId(context)
            ?: throw IllegalStateException("Sin cuenta cloud")
        val code = inviteCode.trim().uppercase()
        if (code.length < 4) throw IllegalArgumentException("Código de invitación inválido")

        val inviteSnap = inviteRef(code).get().await()
        if (!inviteSnap.exists()) throw IllegalArgumentException("Código no válido o vencido")
        val clinicId = inviteSnap.getString("clinicId").orEmpty()
        if (clinicId.isBlank()) throw IllegalArgumentException("Invitación inválida")

        val clinicSnap = clinicRef(clinicId).get().await()
        if (!clinicSnap.exists()) throw IllegalArgumentException("Centro no encontrado")
        val clinicName = clinicSnap.getString("nombre").orEmpty().ifBlank { "Centro" }

        return writeMembership(
            context = context,
            clinicId = clinicId,
            clinicName = clinicName,
            doctorCedula = CedulaNormalizer.normalize(profile.cedula),
            doctorNombre = profile.nombre,
            userId = userId,
        )
    }

    suspend fun listPendingInvitations(context: Context): List<ClinicDoctorInvitation> {
        if (!DoctorAuthService.isConfigured(context)) return emptyList()
        val profile = DoctorStorage.loadProfile(context) ?: return emptyList()
        val snap = doctorPendingInvitesCol(profile.cedula).get().await()
        return snap.documents.mapNotNull { doc ->
            val data = doc.data ?: return@mapNotNull null
            if ((data["status"]?.toString() ?: "pending") != "pending") return@mapNotNull null
            ClinicDoctorInvitation(
                clinicId = data["clinicId"]?.toString() ?: doc.id,
                clinicName = data["clinicName"]?.toString() ?: "Centro",
                doctorCedula = data["doctorCedula"]?.toString().orEmpty(),
                doctorNombre = data["doctorNombre"]?.toString().orEmpty(),
                status = "pending",
                invitedAt = data["invitedAt"]?.toString().orEmpty(),
            )
        }.sortedByDescending { it.invitedAt }
    }

    suspend fun acceptInvitation(context: Context, clinicId: String): ClinicMembership {
        if (!DoctorAuthService.isConfigured(context)) {
            throw IllegalStateException("Firebase no configurado")
        }
        val profile = DoctorStorage.loadProfile(context)
            ?: throw IllegalStateException("Sin sesión de médico")
        val userId = DoctorStorage.userId(context)
            ?: throw IllegalStateException("Sin cuenta cloud")
        val doctorCedula = CedulaNormalizer.normalize(profile.cedula)

        val invSnap = invitationsCol(clinicId).document(doctorCedula).get().await()
        if (!invSnap.exists()) throw IllegalArgumentException("Invitación no encontrada")
        val status = invSnap.getString("status") ?: "pending"
        if (status != "pending") throw IllegalArgumentException("Esta invitación ya no está pendiente")

        val clinicSnap = clinicRef(clinicId).get().await()
        if (!clinicSnap.exists()) throw IllegalArgumentException("Centro no encontrado")
        val clinicName = clinicSnap.getString("nombre").orEmpty()
            .ifBlank { invSnap.getString("clinicName").orEmpty().ifBlank { "Centro" } }

        val membership = writeMembership(
            context = context,
            clinicId = clinicId,
            clinicName = clinicName,
            doctorCedula = doctorCedula,
            doctorNombre = profile.nombre,
            userId = userId,
        )
        invitationsCol(clinicId).document(doctorCedula)
            .set(mapOf("status" to "accepted"), SetOptions.merge()).await()
        doctorPendingInvitesCol(doctorCedula).document(clinicId).delete().await()
        return membership
    }

    suspend fun rejectInvitation(context: Context, clinicId: String) {
        if (!DoctorAuthService.isConfigured(context)) {
            throw IllegalStateException("Firebase no configurado")
        }
        val profile = DoctorStorage.loadProfile(context)
            ?: throw IllegalStateException("Sin sesión de médico")
        val doctorCedula = CedulaNormalizer.normalize(profile.cedula)
        invitationsCol(clinicId).document(doctorCedula)
            .set(mapOf("status" to "rejected"), SetOptions.merge()).await()
        doctorPendingInvitesCol(doctorCedula).document(clinicId).delete().await()
    }

    suspend fun refreshMemberships(context: Context): List<ClinicMembership> {
        val userId = DoctorStorage.userId(context) ?: return ClinicMembershipStorage.load(context)
        if (!DoctorAuthService.isConfigured(context)) return ClinicMembershipStorage.load(context)
        val snap = membershipsCol(userId).get().await()
        val list = snap.documents.mapNotNull { doc ->
            val id = doc.getString("clinicId") ?: doc.id
            val name = doc.getString("clinicName") ?: return@mapNotNull null
            ClinicMembership(
                clinicId = id,
                clinicName = name,
                role = doc.getString("role") ?: "medico",
            )
        }.sortedBy { it.clinicName }
        ClinicMembershipStorage.save(context, list)
        return list
    }

    suspend fun listTemplates(clinicId: String): List<DocumentTemplate> {
        val snap = templatesCol(clinicId).get().await()
        return snap.documents.mapNotNull { doc ->
            val data = doc.data ?: return@mapNotNull null
            val typeRaw = data["documentType"]?.toString() ?: return@mapNotNull null
            @Suppress("UNCHECKED_CAST")
            DocumentTemplate(
                id = data["id"]?.toString() ?: doc.id,
                name = data["name"]?.toString() ?: "Plantilla",
                documentType = DocumentType.fromName(typeRaw),
                sections = (data["sections"] as? List<*>)?.mapNotNull { it?.toString() }.orEmpty(),
                isDefault = data["isDefault"] as? Boolean ?: false,
                enabledPhysicalExamSystemIds =
                    (data["enabledPhysicalExamSystemIds"] as? List<*>)?.mapNotNull { it?.toString() }.orEmpty(),
                sectionDefaultTexts =
                    (data["sectionDefaultTexts"] as? Map<*, *>)?.mapNotNull { (k, v) ->
                        val key = k?.toString() ?: return@mapNotNull null
                        val value = v?.toString() ?: return@mapNotNull null
                        key to value
                    }?.toMap().orEmpty(),
                enfermedadActualEjemplo = data["enfermedadActualEjemplo"]?.toString().orEmpty(),
            )
        }
    }

    suspend fun listHeaders(clinicId: String): List<DocumentHeader> {
        val snap = headersCol(clinicId).get().await()
        return snap.documents.mapNotNull { doc ->
            val data = doc.data ?: return@mapNotNull null
            DocumentHeader(
                id = data["id"]?.toString() ?: doc.id,
                name = data["name"]?.toString() ?: "Encabezado",
                logoPath = data["logoPath"]?.toString(),
                logoBase64 = data["logoBase64"]?.toString(),
                doctorName = data["doctorName"]?.toString().orEmpty(),
                subtitle = data["subtitle"]?.toString().orEmpty(),
                description = data["description"]?.toString().orEmpty(),
                infoLines = DocumentHeader.emptyInfoLines(),
                isDefault = data["isDefault"] as? Boolean ?: false,
                headerType = HeaderType.CLINICA,
            )
        }
    }

    suspend fun pushClinicDocument(
        clinicId: String,
        document: ClinicalDocument,
        doctorNombre: String,
    ) {
        val payload = hashMapOf<String, Any?>(
            "id" to document.id,
            "patientId" to document.patientId,
            "patientNombre" to document.patientNombre,
            "patientCedula" to CedulaNormalizer.normalize(document.patientCedula),
            "type" to DocumentType.storageName(document.type),
            "content" to document.content,
            "rawDictation" to document.rawDictation,
            "createdAt" to document.createdAt.toString(),
            "templateId" to document.templateId,
            "templateName" to document.templateName,
            "headerId" to document.headerId,
            "headerSnapshot" to document.headerSnapshot?.let { h ->
                mapOf(
                    "id" to h.id,
                    "name" to h.name,
                    "logoBase64" to h.logoBase64,
                    "doctorName" to h.doctorName,
                    "subtitle" to h.subtitle,
                    "description" to h.description,
                    "isDefault" to h.isDefault,
                )
            },
            "membrete" to document.membrete?.let { m ->
                mapOf(
                    "nombre" to m.nombre,
                    "edad" to m.edad,
                    "cedula" to m.cedula,
                    "sexo" to m.sexo,
                    "fechaNacimiento" to m.fechaNacimiento,
                    "fecha" to m.fecha,
                )
            },
            "sourceDocumentId" to document.sourceDocumentId,
            "clinicId" to clinicId,
            "clinicName" to document.clinicName,
            "doctorNombre" to doctorNombre,
        )
        documentsCol(clinicId).document(document.id).set(payload, SetOptions.merge()).await()
    }
}
