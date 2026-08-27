package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.util.Log
import com.ceoclinicos.clinicosdoc.model.AiProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

object AiService {
    private const val TAG = "AiService"
    private const val PREFS = "clinicos_doc_prefs"
    private const val PROVIDER_KEY = "ai_provider"
    private const val CHAT_PROXY_URL = "https://clinicos-doc.vercel.app/api/chat"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.MINUTES)
        .readTimeout(4, TimeUnit.MINUTES)
        .writeTimeout(4, TimeUnit.MINUTES)
        .build()

    private var provider: AiProvider = AiProvider.DEEP_SEEK
    private var appContext: Context? = null

    fun currentProvider(): AiProvider = provider

    suspend fun initialize(context: Context) {
        appContext = context.applicationContext
        val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(PROVIDER_KEY, null)
        provider = when (saved) {
            "gemini" -> AiProvider.GEMINI
            "deepSeek" -> AiProvider.DEEP_SEEK
            else -> AiProvider.DEEP_SEEK
        }
    }

    fun setProvider(context: Context, newProvider: AiProvider) {
        provider = newProvider
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(
                PROVIDER_KEY,
                if (newProvider == AiProvider.DEEP_SEEK) "deepSeek" else "gemini",
            )
            .apply()
    }

    suspend fun sendPrompt(
        prompt: String,
        systemMessage: String? = null,
        maxTokens: Int = 4096,
    ): String = withContext(Dispatchers.IO) {
        val providerName = when (provider) {
            AiProvider.GEMINI -> "gemini"
            AiProvider.DEEP_SEEK -> "deepseek"
        }
        callProtectedProxy(prompt, systemMessage, maxTokens, providerName)
    }

    private suspend fun awaitAuthUser(timeoutMs: Long = 12_000L): FirebaseUser? {
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
                auth.currentUser?.let {
                    auth.removeAuthStateListener(listener)
                    if (cont.isActive) cont.resume(it)
                }
            }
        }
    }

    /** IA solo vía proxy Vercel; la API key nunca va en el APK. */
    private suspend fun callProtectedProxy(
        prompt: String,
        systemMessage: String?,
        maxTokens: Int,
        provider: String,
    ): String {
        val user = awaitAuthUser()
            ?: throw IllegalStateException(
                "Sin sesión Firebase. Cierre la app, vuelva a iniciar sesión e intente de nuevo.",
            )
        val idToken = try {
            user.getIdToken(true).await().token
        } catch (e: Exception) {
            Log.e(TAG, "getIdToken falló: ${e.message}", e)
            throw IllegalStateException(
                "Sesión vencida o inválida. Vuelva a iniciar sesión e intente de nuevo.",
            )
        } ?: throw IllegalStateException("Sesión vencida. Vuelva a iniciar sesión.")

        val bodyJson = JSONObject()
            .put("prompt", prompt)
            .put("systemMessage", systemMessage.orEmpty())
            .put("provider", provider)
            .put("max_tokens", maxTokens)
            .toString()

        val request = Request.Builder()
            .url(CHAT_PROXY_URL)
            .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("Accept", "application/json")
            .header("Authorization", "Bearer $idToken")
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(responseBody) }.getOrNull()
                if (!response.isSuccessful) {
                    val detail = json?.optString("error")?.takeIf { it.isNotBlank() }
                        ?: responseBody.take(300).ifBlank { "Sin detalles" }
                    val friendly = when (response.code) {
                        401 -> "Sesión requerida o vencida. Vuelva a iniciar sesión."
                        402 -> json?.optString("error")?.takeIf { it.isNotBlank() }
                            ?: "Prueba o suscripción agotada. Suscríbase para seguir usando la IA."
                        429 -> "Demasiadas solicitudes. Intente en unos minutos."
                        else -> "IA ${response.code}: $detail"
                    }
                    throw IllegalStateException(friendly)
                }
                json?.optString("text")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: throw IllegalStateException("La IA no devolvió contenido")
            }
        } catch (e: IllegalStateException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "callProtectedProxy: ${e.message}", e)
            throw IllegalStateException(
                e.message?.takeIf { it.isNotBlank() } ?: "No se pudo conectar con la IA",
            )
        }
    }
}
