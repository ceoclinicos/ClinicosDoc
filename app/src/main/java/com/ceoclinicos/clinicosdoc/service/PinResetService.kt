package com.ceoclinicos.clinicosdoc.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object PinResetService {
    private const val API_URL = "https://clinicos-doc.vercel.app/api/pin-reset-request"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .build()

    /**
     * Solicita correo de recuperación. tipo=app para médicos de la app Android.
     */
    suspend fun requestReset(cedula: String, tipo: String = "app"): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bodyJson = JSONObject()
                    .put("cedula", cedula.trim())
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
                        error(json.optString("error").ifBlank { "No se pudo enviar el correo" })
                    }
                    json.optString("message").ifBlank {
                        "Si hay un correo registrado, recibirá un enlace en unos minutos."
                    }
                }
            }
        }
}
