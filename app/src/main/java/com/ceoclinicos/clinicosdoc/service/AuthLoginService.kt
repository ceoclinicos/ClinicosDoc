package com.ceoclinicos.clinicosdoc.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import com.google.firebase.auth.FirebaseAuth

object AuthLoginService {
    private const val LOGIN_URL = "https://clinicos-doc.vercel.app/api/auth-login"
    private const val REGISTER_URL = "https://clinicos-doc.vercel.app/api/auth-register"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .build()

    data class AuthResult(
        val uid: String,
        val nombre: String,
        val cedula: String,
        val correo: String,
        val especialidad: String,
        val mpps: String,
        val sexo: String,
        val nacionalidad: String,
    )

    private fun parseAuthResult(json: JSONObject, fallbackCedula: String): AuthResult {
        val token = json.optString("token")
        if (token.isBlank()) error("Token de autenticación vacío")
        return AuthResult(
            uid = json.optString("uid").ifBlank { json.optString("cloudUserId") },
            nombre = json.optString("nombre"),
            cedula = json.optString("cedula", fallbackCedula),
            correo = json.optString("correo"),
            especialidad = json.optString("especialidad", "Médico general"),
            mpps = json.optString("mpps"),
            sexo = json.optString("sexo"),
            nacionalidad = json.optString("nacionalidad", "Venezuela"),
        )
    }

    private suspend fun postJson(url: String, bodyJson: JSONObject, fallbackCedula: String): AuthResult {
        val request = Request.Builder()
            .url(url)
            .post(bodyJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("Accept", "application/json")
            .build()
        return httpClient.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val json = runCatching { JSONObject(raw) }.getOrElse {
                error("Respuesta inválida del servidor")
            }
            if (!response.isSuccessful) {
                error(json.optString("error").ifBlank { "No se pudo completar la operación" })
            }
            val token = json.optString("token")
            if (token.isBlank()) error("Token de autenticación vacío")
            FirebaseAuth.getInstance().signInWithCustomToken(token).await()
            parseAuthResult(json, fallbackCedula)
        }
    }

    /**
     * Valida PIN en el servidor y abre sesión Firebase Auth (custom token).
     * tipo: app | profesional | paciente | clinica
     */
    suspend fun login(cedula: String, pin: String, tipo: String = "app"): Result<AuthResult> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bodyJson = JSONObject()
                    .put("cedula", cedula.trim())
                    .put("pin", pin)
                    .put("tipo", tipo)
                postJson(LOGIN_URL, bodyJson, cedula)
            }
        }

    suspend fun register(
        cedula: String,
        pin: String,
        nombre: String,
        correo: String,
        sexo: String,
        especialidad: String,
        mpps: String,
        nacionalidad: String,
        whatsapp: String = "",
        esMedicoGeneral: Boolean = true,
    ): Result<AuthResult> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bodyJson = JSONObject()
                    .put("tipo", "app")
                    .put("cedula", cedula.trim())
                    .put("pin", pin)
                    .put("nombre", nombre.trim())
                    .put("correo", correo.trim())
                    .put("sexo", sexo)
                    .put("especialidad", especialidad)
                    .put("mpps", mpps)
                    .put("nacionalidad", nacionalidad)
                    .put("whatsapp", whatsapp)
                    .put("esMedicoGeneral", esMedicoGeneral)
                    .put("source", "android")
                postJson(REGISTER_URL, bodyJson, cedula)
            }
        }

    fun signOut() {
        runCatching { FirebaseAuth.getInstance().signOut() }
    }
}
