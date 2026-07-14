package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.util.Log
import com.ceoclinicos.clinicosdoc.data.CloudSyncService
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.FirestorePaths
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest

object DoctorAuthService {
    private const val TAG = "DoctorAuthService"

    fun isConfigured(context: Context): Boolean = FirebaseApp.getApps(context).isNotEmpty()

    fun hashPassword(password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(password.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    suspend fun cedulaExists(cedulaInput: String): Boolean =
        findUserDocument(cedulaInput) != null

    suspend fun signIn(context: Context, cedulaInput: String, password: String): Result<DoctorProfile> {
        if (!isConfigured(context)) {
            return Result.failure(IllegalStateException("Sin conexión a Firebase"))
        }
        return runCatching {
            val doc = findUserDocument(cedulaInput)
                ?: error("Cédula o contraseña incorrectos")
            val hash = doc.getString("passwordHash").orEmpty()
            if (hash.isEmpty() || hash != hashPassword(password)) {
                error("Cédula o contraseña incorrectos")
            }
            val profile = doc.toDoctorProfile()
            DoctorStorage.saveSession(context, profile, doc.id)
            CloudSyncService.syncOnLogin(context, doc.id)
            profile
        }
    }

    suspend fun register(
        context: Context,
        password: String,
        profile: DoctorProfile,
    ): Result<DoctorProfile> {
        if (!isConfigured(context)) {
            return Result.failure(IllegalStateException("Sin conexión a Firebase"))
        }
        if (!CedulaNormalizer.isValid(profile.cedula)) {
            return Result.failure(IllegalStateException("Cédula inválida"))
        }
        if (profile.mpps.isBlank()) {
            return Result.failure(IllegalStateException("Código MPPS requerido"))
        }
        if (password.length < 4) {
            return Result.failure(IllegalStateException("La contraseña debe tener al menos 4 caracteres"))
        }
        val mppsCheck = MppsValidationService.validate(profile.cedula, profile.mpps)
        if (mppsCheck.isFailure) {
            return Result.failure(
                mppsCheck.exceptionOrNull() ?: IllegalStateException("No se pudo validar MPPS"),
            )
        }
        val validated = mppsCheck.getOrThrow()
        val profileValidated = profile.copy(
            mpps = validated.mpps.ifBlank { profile.mpps },
            nombre = profile.nombre.ifBlank { validated.nombreCompleto },
        )
        return runCatching {
            if (cedulaExists(profileValidated.cedula)) {
                error("Esta cédula ya está registrada. Usa Login")
            }
            val db = firestore(context)
            val cedulaNorm = CedulaNormalizer.normalize(profileValidated.cedula)
            val docRef = db.collection(FirestorePaths.USERS).document()
            docRef.set(
                mapOf(
                    "nombre" to profileValidated.nombre,
                    "cedula" to profileValidated.cedula.trim(),
                    "cedulaNormalizada" to cedulaNorm,
                    "mpps" to profileValidated.mpps,
                    "sexo" to profileValidated.sexo,
                    "especialidad" to profileValidated.especialidad,
                    "whatsapp" to profileValidated.whatsapp,
                    "passwordHash" to hashPassword(password),
                    "mppsValidado" to true,
                    "profesionSacs" to validated.profesion,
                ),
            ).await()
            DoctorStorage.saveSession(context, profileValidated, docRef.id)
            CloudSyncService.syncOnLogin(context, docRef.id)
            profileValidated
        }
    }

    suspend fun restoreSessionFromCloud(context: Context, userId: String): Boolean {
        if (!isConfigured(context)) return false
        return try {
            val snap = firestore(context).collection(FirestorePaths.USERS).document(userId).get().await()
            if (!snap.exists()) return false
            val profile = snap.toDoctorProfile()
            DoctorStorage.saveSession(context, profile, userId)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error al restaurar sesión: ${e.message}", e)
            false
        }
    }

    fun signOut(context: Context) {
        DoctorStorage.clearSession(context)
    }

    private fun firestore(context: Context): FirebaseFirestore {
        if (!isConfigured(context)) error("Firebase no inicializado")
        return FirebaseFirestore.getInstance()
    }

    private suspend fun findUserDocument(cedulaInput: String): DocumentSnapshot? {
        val db = FirebaseFirestore.getInstance()
        val norm = CedulaNormalizer.normalize(cedulaInput)
        if (norm.isEmpty()) return null

        queryFirst(db, "cedulaNormalizada", norm)?.let { return it }
        return queryFirst(db, "cedula", cedulaInput.trim())
    }

    private suspend fun queryFirst(
        db: FirebaseFirestore,
        field: String,
        value: String,
    ): DocumentSnapshot? {
        if (value.isEmpty()) return null
        val snapshot = db.collection(FirestorePaths.USERS)
            .whereEqualTo(field, value)
            .limit(1)
            .get()
            .await()
        return snapshot.documents.firstOrNull()
    }

    private fun DocumentSnapshot.toDoctorProfile(): DoctorProfile = DoctorProfile(
        nombre = getString("nombre").orEmpty(),
        cedula = getString("cedula").orEmpty(),
        mpps = getString("mpps").orEmpty(),
        sexo = getString("sexo").orEmpty(),
        especialidad = getString("especialidad").orEmpty(),
        whatsapp = getString("whatsapp").orEmpty(),
    )
}
