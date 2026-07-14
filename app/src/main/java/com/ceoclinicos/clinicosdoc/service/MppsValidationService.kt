package com.ceoclinicos.clinicosdoc.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class MppsMedico(
    val cedula: String,
    val nombreCompleto: String,
    val profesion: String,
    val mpps: String,
)

object MppsValidationService {
    private const val API_URL = "https://clinicos-doc.vercel.app/api/validar-mpps"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .build()

    suspend fun validate(cedula: String, mpps: String): Result<MppsMedico> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bodyJson = JSONObject()
                    .put("cedula", cedula.trim())
                    .put("mpps", mpps.trim())
                    .toString()
                val request = Request.Builder()
                    .url(API_URL)
                    .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .build()
                httpClient.newCall(request).execute().use { response ->
                    val raw = response.body?.string().orEmpty()
                    val json = runCatching { JSONObject(raw) }.getOrElse {
                        error("Respuesta inválida del servidor de validación")
                    }
                    if (!response.isSuccessful || !json.optBoolean("ok", false)) {
                        error(json.optString("error").ifBlank { "No se pudo validar cédula y MPPS" })
                    }
                    val medico = json.getJSONObject("medico")
                    MppsMedico(
                        cedula = medico.optString("cedula"),
                        nombreCompleto = medico.optString("nombreCompleto"),
                        profesion = medico.optString("profesion"),
                        mpps = medico.optString("mpps").ifBlank { mpps.trim() },
                    )
                }
            }
        }
}
