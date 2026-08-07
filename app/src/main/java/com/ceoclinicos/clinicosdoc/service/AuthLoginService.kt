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
    private const val API_URL = "https://clinicos-doc.vercel.app/api/auth-login"

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
                    .toString()
                val request = Request.Builder()
                    .url(API_URL)
                    .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(raw) }.getOrElse {
                        error("Respuesta inválida del servidor")
                    }
                    if (!response.isSuccessful) {
                        error(json.optString("error").ifBlank { "No se pudo iniciar sesión" })
                    }
                    val token = json.optString("token")
                    if (token.isBlank()) error("Token de autenticación vacío")
                    FirebaseAuth.getInstance().signInWithCustomToken(token).await()
                    AuthResult(
                        uid = json.optString("uid").ifBlank { json.optString("cloudUserId") },
                        nombre = json.optString("nombre"),
                        cedula = json.optString("cedula", cedula),
                        correo = json.optString("correo"),
                        especialidad = json.optString("especialidad", "Médico general"),
                        mpps = json.optString("mpps"),
                        sexo = json.optString("sexo"),
                        nacionalidad = json.optString("nacionalidad", "Venezuela"),
                    )
                }
            }
        }

    fun signOut() {
        runCatching { FirebaseAuth.getInstance().signOut() }
    }
}
