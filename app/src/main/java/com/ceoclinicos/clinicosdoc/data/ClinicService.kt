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
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
object ClinicService {
    private fun db() = FirebaseFirestore.getInstance()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build()

    private const val ACCEPT_INVITE_URL = "https://clinicos-doc.vercel.app/api/clinic-accept-invite"
    private const val MEMBERSHIPS_URL = "https://clinicos-doc.vercel.app/api/clinic-memberships"
    private const val TEMPLATES_URL = "https://clinicos-doc.vercel.app/api/clinic-templates"

    @Volatile
    private var lastAffiliationSyncAtMs: Long = 0L
    private const val AFFILIATION_SYNC_MIN_INTERVAL_MS = 90_000L

    /** true si ya hubo sync reciente (Redactar no debe pegarle a la red). */
    fun hasFreshAffiliationSync(): Boolean {
        val last = lastAffiliationSyncAtMs
        return last > 0L && System.currentTimeMillis() - last < AFFILIATION_SYNC_MIN_INTERVAL_MS
    }

    private suspend fun awaitAuthUser(timeoutMs: Long = 8_000L): FirebaseUser? {
        val auth = FirebaseAuth.getInstance()
        auth.currentUser?.let { return it }
        return withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine { cont ->
                val listener = object : FirebaseAuth.AuthStateListener {
                    override fun onAuthStateChanged(firebaseAuth: FirebaseAuth) {
                        val user = firebaseAuth.currentUser
                        if (user != null && cont.isActive) {
                            firebaseAuth.removeAuthStateListener(this)
                            cont.resume(user)
                        }
                    }
                }
                auth.addAuthStateListener(listener)
                cont.invokeOnCancellation { auth.removeAuthStateListener(listener) }
                // Si ya restauró entre medias
                auth.currentUser?.let {
                    auth.removeAuthStateListener(listener)
                    if (cont.isActive) cont.resume(it)
                }
            }
        }
    }

    private suspend fun idTokenOrThrow(): String {
        val user = awaitAuthUser()
            ?: throw IllegalStateException("Sincronizando sesión… intente de nuevo en unos segundos")
        return user.getIdToken(true).await().token
            ?: throw IllegalStateException("No se pudo obtener sesión segura")
    }

    /**
     * Confirma afiliaciones en la nube y descarga moldes/encabezados.
     * Ideal al abrir la app. [force] ignora el intervalo mínimo (p. ej. tras aceptar invitación).
     */
    suspend fun syncAffiliationsOnEnter(
        context: Context,
        force: Boolean = false,
    ): List<ClinicMembership> {
        if (!DoctorAuthService.isConfigured(context)) {
            return ClinicMembershipStorage.load(context)
        }
        if (DoctorStorage.loadProfile(context) == null) {
            return emptyList()
        }
        val now = System.currentTimeMillis()
        if (!force && now - lastAffiliationSyncAtMs < AFFILIATION_SYNC_MIN_INTERVAL_MS) {
            return ClinicMembershipStorage.load(context)
        }
        // Esperar restauración de Auth (no pedir cerrar sesión)
        awaitAuthUser()
        val memberships = runCatching {
            refreshMemberships(
                context,
                allowEmptyOverwrite = force,
                forceHeal = force || ClinicMembershipStorage.load(context).isEmpty(),
                forceNetwork = force,
            )
        }.getOrElse { ClinicMembershipStorage.load(context) }
        // refreshMemberships ya guarda; comparar con snapshot previo requiere detectar antes.
        // Re-aplicar detección: refreshMemberships llama save() sin detección.
        ClinicMembershipStorage.saveDetectingChanges(context, memberships)
        ClinicCatalogStorage.retainClinics(context, memberships.map { it.clinicId }.toSet())
        for (m in memberships) {
            runCatching {
                val tpls = listTemplates(context, m.clinicId, documentType = null, forceRefresh = true)
                val hdrs = listHeaders(context, m.clinicId, forceRefresh = true)
                ClinicCatalogStorage.saveTemplates(context, m.clinicId, tpls)
                ClinicCatalogStorage.saveHeaders(context, m.clinicId, hdrs)
            }
        }
        lastAffiliationSyncAtMs = System.currentTimeMillis()
        return memberships
    }
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

    // `clinicosdoc_doctor_invites/{inviteKey}/pending/{clinicId}`
    // `inviteKey` puede ser cédula normalizada o también un `cloudUserId` (UID Firebase).
    // Por eso NO debemos normalizar aquí (normalizar rompe el UID al quitar/transformar caracteres).
    private fun doctorPendingInvitesCol(inviteKey: String) =
        db().collection(FirestorePaths.DOCTOR_INVITES)
            .document(inviteKey.trim())
            .collection(FirestorePaths.SUB_PENDING)

    private fun clinicNoticesCol(userId: String) =
        db().collection(FirestorePaths.USERS).document(userId)
            .collection(FirestorePaths.SUB_CLINIC_NOTICES)

    private fun parsePendingInvitationsJson(arr: JSONArray?): List<ClinicDoctorInvitation> {
        if (arr == null || arr.length() == 0) return emptyList()
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("clinicId")
                if (id.isBlank()) continue
                add(
                    ClinicDoctorInvitation(
                        clinicId = id,
                        clinicName = o.optString("clinicName", "Centro").ifBlank { "Centro" },
                        doctorCedula = o.optString("doctorCedula"),
                        doctorNombre = o.optString("doctorNombre"),
                        status = "pending",
                        invitedAt = o.optString("invitedAt"),
                        expiresAt = o.optString("expiresAt"),
                    ),
                )
            }
        }
    }

    private suspend fun fetchPendingFromNotices(
        userId: String,
        doctorCedula: String,
    ): List<ClinicDoctorInvitation> {
        val snap = clinicNoticesCol(userId).get().await()
        val ttlMs = 7L * 24 * 60 * 60 * 1000
        return snap.documents.mapNotNull { doc ->
            val data = doc.data ?: return@mapNotNull null
            if ((data["status"]?.toString() ?: "pending") != "pending") return@mapNotNull null
            if ((data["type"]?.toString() ?: "invite") != "invite") return@mapNotNull null
            val clinicId = data["clinicId"]?.toString()?.ifBlank { doc.id } ?: doc.id
            val invitedAt = data["invitedAt"]?.toString().orEmpty()
            val expiresAt = data["expiresAt"]?.toString().orEmpty()
            val expMs = runCatching { java.time.Instant.parse(expiresAt).toEpochMilli() }.getOrNull()
            if (expMs != null && System.currentTimeMillis() > expMs) return@mapNotNull null
            val invitedMs = runCatching { java.time.Instant.parse(invitedAt).toEpochMilli() }.getOrNull()
            if (invitedMs != null && System.currentTimeMillis() > invitedMs + ttlMs) return@mapNotNull null
            ClinicDoctorInvitation(
                clinicId = clinicId,
                clinicName = data["clinicName"]?.toString() ?: "Centro",
                doctorCedula = doctorCedula,
                doctorNombre = "",
                status = "pending",
                invitedAt = invitedAt,
                expiresAt = expiresAt,
            )
        }
    }

    private fun mergeInvitations(
        vararg lists: List<ClinicDoctorInvitation>,
    ): List<ClinicDoctorInvitation> {
        val byClinic = linkedMapOf<String, ClinicDoctorInvitation>()
        for (list in lists) {
            for (inv in list) {
                if (inv.clinicId.isBlank()) continue
                byClinic.putIfAbsent(inv.clinicId, inv)
            }
        }
        return byClinic.values.sortedByDescending { it.invitedAt }
    }

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
        val clinicName = inviteSnap.getString("nombre").orEmpty().ifBlank {
            // Fallback si el código es antiguo y no trae nombre
            runCatching { clinicRef(clinicId).get().await().getString("nombre") }.getOrNull()
                .orEmpty()
                .ifBlank { "Centro" }
        }

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
        val cached = ClinicMembershipStorage.loadPendingInvites(context)
        if (!DoctorAuthService.isConfigured(context)) return cached

        val profile = DoctorStorage.loadProfile(context) ?: return cached
        val userId = DoctorStorage.userId(context).orEmpty()
        val doctorCedula = CedulaNormalizer.normalize(profile.cedula)

        var list = cached

        // Reintentos: al abrir la app Auth a veces tarda en restaurarse
        repeat(3) { attempt ->
            if (attempt > 0) delay(900L * attempt)
            awaitAuthUser(timeoutMs = if (attempt == 0) 8_000L else 12_000L)
            runCatching {
                refreshMemberships(context, forceNetwork = true, allowEmptyOverwrite = false)
            }
            val fromApi = ClinicMembershipStorage.loadPendingInvites(context)
            val fromNotices = if (userId.isNotBlank()) {
                runCatching { fetchPendingFromNotices(userId, doctorCedula) }.getOrDefault(emptyList())
            } else {
                emptyList()
            }
            list = mergeInvitations(fromApi, fromNotices)
            if (list.isNotEmpty()) return@repeat
        }

        ClinicMembershipStorage.savePendingInvites(context, list)
        return list
    }

    suspend fun acceptInvitation(context: Context, clinicId: String): ClinicMembership {
        if (!DoctorAuthService.isConfigured(context)) {
            throw IllegalStateException("Firebase no configurado")
        }
        val profile = DoctorStorage.loadProfile(context)
            ?: throw IllegalStateException("Sin sesión de médico")
        DoctorStorage.userId(context) ?: throw IllegalStateException("Sin cuenta cloud")
        val doctorCedula = CedulaNormalizer.normalize(profile.cedula)
        val idToken = FirebaseAuth.getInstance().currentUser?.getIdToken(true)?.await()?.token
            ?: throw IllegalStateException("Sesión Firebase vencida. Vuelva a iniciar sesión.")

        val result = withContext(Dispatchers.IO) {
            val bodyJson = JSONObject()
                .put("action", "accept")
                .put("clinicId", clinicId)
                .put("doctorCedula", doctorCedula)
                .put("doctorNombre", profile.nombre)
                .toString()
            val request = Request.Builder()
                .url(ACCEPT_INVITE_URL)
                .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer $idToken")
                .build()
            httpClient.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(raw) }.getOrElse {
                    error("Respuesta inválida del servidor")
                }
                if (!response.isSuccessful) {
                    error(json.optString("error").ifBlank { "No se pudo aceptar la invitación" })
                }
                ClinicMembership(
                    clinicId = json.optString("clinicId", clinicId),
                    clinicName = json.optString("clinicName", "Centro"),
                    role = json.optString("role", "medico"),
                )
            }
        }
        ClinicMembershipStorage.upsert(context, result)
        ClinicMembershipStorage.removePendingInvite(context, result.clinicId)
        runCatching { syncAffiliationsOnEnter(context, force = true) }
        return result
    }

    suspend fun rejectInvitation(context: Context, clinicId: String) {
        if (!DoctorAuthService.isConfigured(context)) {
            throw IllegalStateException("Firebase no configurado")
        }
        val profile = DoctorStorage.loadProfile(context)
            ?: throw IllegalStateException("Sin sesión de médico")
        val doctorCedula = CedulaNormalizer.normalize(profile.cedula)
        val idToken = FirebaseAuth.getInstance().currentUser?.getIdToken(true)?.await()?.token
            ?: throw IllegalStateException("Sesión Firebase vencida. Vuelva a iniciar sesión.")

        withContext(Dispatchers.IO) {
            val bodyJson = JSONObject()
                .put("action", "reject")
                .put("clinicId", clinicId)
                .put("doctorCedula", doctorCedula)
                .toString()
            val request = Request.Builder()
                .url(ACCEPT_INVITE_URL)
                .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer $idToken")
                .build()
            httpClient.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(raw) }.getOrElse {
                    error("Respuesta inválida del servidor")
                }
                if (!response.isSuccessful) {
                    error(json.optString("error").ifBlank { "No se pudo rechazar" })
                }
            }
        }
        ClinicMembershipStorage.removePendingInvite(context, clinicId)
    }

    /**
     * @param allowEmptyOverwrite si false, no borra el caché local cuando la API viene vacía
     *        (evita el falso “no afiliado” por heal lento / fallo parcial).
     * @param forceHeal pide a la API re-escanear members aunque ya haya clinic_memberships.
     * @param forceNetwork si false y hay sync reciente, devuelve caché local sin llamar a la API.
     */
    suspend fun refreshMemberships(
        context: Context,
        allowEmptyOverwrite: Boolean = false,
        forceHeal: Boolean = false,
        forceNetwork: Boolean = false,
    ): List<ClinicMembership> {
        val local = ClinicMembershipStorage.load(context)
        if (!DoctorAuthService.isConfigured(context)) return local
        if (!forceNetwork && !forceHeal && hasFreshAffiliationSync() && local.isNotEmpty()) {
            return local
        }
        val profile = DoctorStorage.loadProfile(context)
        val doctorCedula = profile?.cedula?.let { CedulaNormalizer.normalize(it) }.orEmpty()
        return runCatching {
            val idToken = idTokenOrThrow()
            withContext(Dispatchers.IO) {
                val body = JSONObject()
                if (doctorCedula.isNotBlank()) body.put("doctorCedula", doctorCedula)
                if (forceHeal) body.put("forceHeal", true)
                val request = Request.Builder()
                    .url(MEMBERSHIPS_URL)
                    .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer $idToken")
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(raw) }.getOrElse {
                        error("Respuesta inválida del servidor")
                    }
                    if (!response.isSuccessful) {
                        error(json.optString("error").ifBlank { "No se pudieron cargar centros" })
                    }
                    val arr = json.optJSONArray("memberships")
                    val list = buildList {
                        if (arr != null) {
                            for (i in 0 until arr.length()) {
                                val o = arr.optJSONObject(i) ?: continue
                                val id = o.optString("clinicId")
                                val name = o.optString("clinicName")
                                if (id.isBlank() || name.isBlank()) continue
                                add(
                                    ClinicMembership(
                                        clinicId = id,
                                        clinicName = name,
                                        role = o.optString("role", "medico"),
                                    ),
                                )
                            }
                        }
                    }.sortedBy { it.clinicName }
                    val pendingArr = json.optJSONArray("pendingInvitations")
                    val pending = parsePendingInvitationsJson(pendingArr)
                    if (pending.isNotEmpty()) {
                        val merged = mergeInvitations(
                            ClinicMembershipStorage.loadPendingInvites(context),
                            pending,
                        )
                        ClinicMembershipStorage.savePendingInvites(context, merged)
                    }
                    if (list.isEmpty() && local.isNotEmpty() && !allowEmptyOverwrite) {
                        return@use local
                    }
                    ClinicMembershipStorage.saveDetectingChanges(context, list)
                    lastAffiliationSyncAtMs = System.currentTimeMillis()
                    list
                }
            }
        }.getOrElse { apiError ->
            // Fallback Firestore (puede fallar con rules cerradas)
            runCatching {
                val userId = DoctorStorage.userId(context) ?: return@runCatching local
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
                if (list.isNotEmpty()) {
                    ClinicMembershipStorage.saveDetectingChanges(context, list)
                    lastAffiliationSyncAtMs = System.currentTimeMillis()
                    list
                } else {
                    throw apiError
                }
            }.getOrElse {
                if (local.isNotEmpty()) local
                else throw (apiError as? Exception ?: IllegalStateException(apiError.message))
            }
        }
    }

    suspend fun listTemplates(
        context: Context,
        clinicId: String,
        documentType: DocumentType? = null,
        forceRefresh: Boolean = false,
    ): List<DocumentTemplate> {
        val cached = ClinicCatalogStorage.loadTemplates(context, clinicId, documentType)
        // En Redactar usa caché; al abrir la app (forceRefresh) pide actualizaciones
        if (!forceRefresh && cached.isNotEmpty()) return cached
        return runCatching {
            val idToken = idTokenOrThrow()
            withContext(Dispatchers.IO) {
                val body = JSONObject().put("clinicId", clinicId)
                if (documentType != null) {
                    body.put("documentType", DocumentType.storageName(documentType))
                }
                val request = Request.Builder()
                    .url(TEMPLATES_URL)
                    .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer $idToken")
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(raw) }.getOrElse {
                        error("Respuesta inválida del servidor")
                    }
                    if (!response.isSuccessful) {
                        error(json.optString("error").ifBlank { "No se pudieron cargar plantillas" })
                    }
                    val arr = json.optJSONArray("templates") ?: return@use emptyList()
                    buildList {
                        for (i in 0 until arr.length()) {
                            val data = arr.optJSONObject(i) ?: continue
                            val typeRaw = data.optString("documentType")
                            if (typeRaw.isBlank()) continue
                            val sectionsJson = data.optJSONArray("sections")
                            val sections = buildList {
                                if (sectionsJson != null) {
                                    for (j in 0 until sectionsJson.length()) {
                                        add(sectionsJson.optString(j))
                                    }
                                }
                            }
                            val examIdsJson = data.optJSONArray("enabledPhysicalExamSystemIds")
                            val examIds = buildList {
                                if (examIdsJson != null) {
                                    for (j in 0 until examIdsJson.length()) {
                                        add(examIdsJson.optString(j))
                                    }
                                }
                            }
                            val defaultsObj = data.optJSONObject("sectionDefaultTexts")
                            val defaults = buildMap {
                                if (defaultsObj != null) {
                                    val keys = defaultsObj.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        put(k, defaultsObj.optString(k))
                                    }
                                }
                            }
                            add(
                                DocumentTemplate(
                                    id = data.optString("id"),
                                    name = data.optString("name", "Plantilla"),
                                    documentType = DocumentType.fromName(typeRaw),
                                    sections = sections,
                                    isDefault = data.optBoolean("isDefault", false),
                                    enabledPhysicalExamSystemIds = examIds,
                                    sectionDefaultTexts = defaults,
                                    enfermedadActualEjemplo = data.optString("enfermedadActualEjemplo"),
                                ),
                            )
                        }
                    }
                }
            }.also { remote ->
                if (documentType == null) {
                    ClinicCatalogStorage.saveTemplates(context, clinicId, remote)
                } else {
                    val merged = ClinicCatalogStorage.loadTemplates(context, clinicId)
                        .filterNot { it.documentType == documentType } + remote
                    ClinicCatalogStorage.saveTemplates(context, clinicId, merged)
                }
            }
        }.getOrElse {
            if (cached.isNotEmpty()) return@getOrElse cached
            val snap = templatesCol(clinicId).get().await()
            snap.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                val typeRaw = data["documentType"]?.toString() ?: return@mapNotNull null
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
            }.let { list ->
                if (documentType != null) list.filter { it.documentType == documentType } else list
            }
        }
    }

    suspend fun listHeaders(
        context: Context,
        clinicId: String,
        forceRefresh: Boolean = false,
    ): List<DocumentHeader> {
        val cached = ClinicCatalogStorage.loadHeaders(context, clinicId)
        if (!forceRefresh && cached.isNotEmpty()) return cached
        return runCatching {
            val idToken = idTokenOrThrow()
            withContext(Dispatchers.IO) {
                val body = JSONObject().put("clinicId", clinicId)
                val request = Request.Builder()
                    .url(TEMPLATES_URL)
                    .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer $idToken")
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(raw) }.getOrElse {
                        error("Respuesta inválida del servidor")
                    }
                    if (!response.isSuccessful) {
                        error(json.optString("error").ifBlank { "No se pudieron cargar encabezados" })
                    }
                    val arr = json.optJSONArray("headers") ?: return@use emptyList()
                    buildList {
                        for (i in 0 until arr.length()) {
                            val data = arr.optJSONObject(i) ?: continue
                            add(
                                DocumentHeader(
                                    id = data.optString("id"),
                                    name = data.optString("name", "Encabezado"),
                                    logoPath = null,
                                    logoBase64 = data.optString("logoBase64").takeIf { it.isNotBlank() },
                                    doctorName = data.optString("doctorName"),
                                    subtitle = data.optString("subtitle"),
                                    description = data.optString("description"),
                                    infoLines = DocumentHeader.emptyInfoLines(),
                                    isDefault = data.optBoolean("isDefault", false),
                                    headerType = HeaderType.CLINICA,
                                ),
                            )
                        }
                    }
                }
            }.also { ClinicCatalogStorage.saveHeaders(context, clinicId, it) }
        }.getOrElse {
            if (cached.isNotEmpty()) return@getOrElse cached
            val snap = headersCol(clinicId).get().await()
            snap.documents.mapNotNull { doc ->
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
