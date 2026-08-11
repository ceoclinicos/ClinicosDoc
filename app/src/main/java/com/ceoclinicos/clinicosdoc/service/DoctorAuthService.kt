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

    suspend fun signIn(
        context: Context,
        cedulaInput: String,
        password: String,
        mpps: String = "",
    ): Result<DoctorProfile> {
        if (!isConfigured(context)) {
            return Result.failure(IllegalStateException("Sin conexión a Firebase"))
        }
        if (!password.matches(Regex("^\\d{4}$"))) {
            return Result.failure(IllegalStateException("El PIN debe tener exactamente 4 dígitos"))
        }
        return runCatching {
            val auth = AuthLoginService.login(cedulaInput, password, "app").getOrThrow()
            val profile = DoctorProfile(
                nombre = auth.nombre,
                cedula = auth.cedula.ifBlank { CedulaNormalizer.normalize(cedulaInput) },
                mpps = auth.mpps,
                sexo = auth.sexo,
                especialidad = auth.especialidad,
                whatsapp = "",
                correo = auth.correo,
                nacionalidad = auth.nacionalidad,
            )
            DoctorStorage.saveSession(context, profile, auth.uid)
            CloudSyncService.syncOnLogin(context, auth.uid)
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
        if (profile.correo.isBlank() || !profile.correo.contains("@")) {
            return Result.failure(IllegalStateException("Correo electrónico requerido"))
        }
        if (!password.matches(Regex("^\\d{4}$"))) {
            return Result.failure(IllegalStateException("El PIN debe tener exactamente 4 dígitos"))
        }
        if (profile.sexo !in listOf("Masculino", "Femenino")) {
            return Result.failure(IllegalStateException("Seleccione el sexo"))
        }

        val esVe = profile.esVenezolano
        var profileValidated = profile
        var profesionSacs = ""
        var mppsValidado = false

        if (esVe) {
            if (profile.mpps.isBlank()) {
                return Result.failure(IllegalStateException("Código MPPS requerido"))
            }
            val mppsCheck = MppsValidationService.validate(profile.cedula, profile.mpps)
            if (mppsCheck.isFailure) {
                return Result.failure(
                    mppsCheck.exceptionOrNull() ?: IllegalStateException("No se pudo validar MPPS"),
                )
            }
            val validated = mppsCheck.getOrThrow()
            profesionSacs = validated.profesion
            mppsValidado = true
            profileValidated = profile.copy(
                mpps = validated.mpps.ifBlank { profile.mpps },
                nombre = profile.nombre.ifBlank { validated.nombreCompleto },
            )
        } else {
            profileValidated = profile.copy(mpps = profile.mpps.trim())
        }

        return runCatching {
            val auth = AuthLoginService.register(
                cedula = profileValidated.cedula,
                pin = password,
                nombre = profileValidated.nombre,
                correo = profileValidated.correo,
                sexo = profileValidated.sexo,
                especialidad = profileValidated.especialidad,
                mpps = profileValidated.mpps,
                nacionalidad = profileValidated.nacionalidad,
                whatsapp = profileValidated.whatsapp,
                esMedicoGeneral = profileValidated.especialidad.contains("general", ignoreCase = true),
            ).getOrThrow()
            val saved = profileValidated.copy(
                nombre = auth.nombre.ifBlank { profileValidated.nombre },
                cedula = auth.cedula.ifBlank { CedulaNormalizer.normalize(profileValidated.cedula) },
                mpps = auth.mpps.ifBlank { profileValidated.mpps },
                correo = auth.correo.ifBlank { profileValidated.correo },
                especialidad = auth.especialidad.ifBlank { profileValidated.especialidad },
            )
            DoctorStorage.saveSession(context, saved, auth.uid)
            CloudSyncService.syncOnLogin(context, auth.uid)
            saved
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
        AuthLoginService.signOut()
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
        val digits = cedulaInput.filter { it.isDigit() }

        queryFirst(db, "cedulaNormalizada", norm)?.let { return it }
        queryFirst(db, "cedula", norm)?.let { return it }
        queryFirst(db, "cedula", cedulaInput.trim())?.let { return it }
        if (digits.isNotEmpty() && digits != cedulaInput.trim() && digits != norm) {
            queryFirst(db, "cedula", digits)?.let { return it }
            queryFirst(db, "cedulaNormalizada", "V$digits")?.let { return it }
        }
        return null
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

    private fun DocumentSnapshot.toDoctorProfile(): DoctorProfile {
        val cedRaw = getString("cedulaNormalizada").orEmpty()
            .ifBlank { getString("cedula").orEmpty() }
        return DoctorProfile(
            nombre = getString("nombre").orEmpty(),
            cedula = CedulaNormalizer.normalize(cedRaw).ifBlank { cedRaw },
            mpps = getString("mpps").orEmpty(),
            sexo = getString("sexo").orEmpty(),
            especialidad = getString("especialidad").orEmpty(),
            whatsapp = getString("whatsapp").orEmpty(),
            correo = getString("correo").orEmpty().ifBlank { getString("email").orEmpty() },
            nacionalidad = getString("nacionalidad").orEmpty().ifBlank { "Venezuela" },
        )
    }
}
