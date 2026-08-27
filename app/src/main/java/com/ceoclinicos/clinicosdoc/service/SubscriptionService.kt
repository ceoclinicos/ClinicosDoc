package com.ceoclinicos.clinicosdoc.service

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class EntitlementStatus(
    val canUseAi: Boolean,
    val plan: String,
    val message: String,
    val code: String,
    val trialDaysLeft: Int = 0,
    val trialUsesLeft: Int = 0,
    val periodRemaining: Int = 0,
    val warnLow: Boolean = false,
)

object SubscriptionService {
    private const val STATUS_URL = "https://clinicos-doc.vercel.app/api/subscription-status"
    private const val ACTIVATE_URL = "https://clinicos-doc.vercel.app/api/subscription-activate"

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun parseEntitlement(json: JSONObject?): EntitlementStatus? {
        if (json == null) return null
        val trial = json.optJSONObject("trial")
        val period = json.optJSONObject("period")
        return EntitlementStatus(
            canUseAi = json.optBoolean("canUseAi", true),
            plan = json.optString("plan").ifBlank { "trial" },
            message = json.optString("message"),
            code = json.optString("code").ifBlank { "OK" },
            trialDaysLeft = trial?.optInt("daysLeft") ?: 0,
            trialUsesLeft = trial?.optInt("usesLeft") ?: 0,
            periodRemaining = period?.optInt("remaining") ?: 0,
            warnLow = period?.optBoolean("warnLow") == true,
        )
    }

    suspend fun fetchStatus(): Result<EntitlementStatus> = withContext(Dispatchers.IO) {
        runCatching {
            val token = idToken()
            val request = Request.Builder()
                .url(STATUS_URL)
                .get()
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build()
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
                if (!response.isSuccessful) {
                    error(json.optString("error").ifBlank { "No se pudo leer el plan" })
                }
                parseEntitlement(json) ?: error("Respuesta de plan inválida")
            }
        }
    }

    suspend fun activateSubscription(): Result<EntitlementStatus> = withContext(Dispatchers.IO) {
        runCatching {
            val token = idToken()
            val request = Request.Builder()
                .url(ACTIVATE_URL)
                .post("{}".toRequestBody("application/json; charset=utf-8".toMediaType()))
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build()
            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
                if (!response.isSuccessful) {
                    error(json.optString("error").ifBlank { "No se pudo activar la suscripción" })
                }
                parseEntitlement(json.optJSONObject("entitlement") ?: json)
                    ?: error("Respuesta de activación inválida")
            }
        }
    }

    private suspend fun idToken(): String {
        val user = FirebaseAuth.getInstance().currentUser
            ?: error("Inicie sesión para ver su plan")
        return user.getIdToken(false).await().token
            ?: error("Sesión inválida")
    }
}
