package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import com.ceoclinicos.clinicosdoc.config.AiConfig
import com.ceoclinicos.clinicosdoc.model.AiProvider
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object AiService {
    private const val PREFS = "clinicos_doc_prefs"
    private const val PROVIDER_KEY = "ai_provider"
    private const val GEMINI_MODEL = "gemini-2.5-flash"
    private const val DEEP_SEEK_MODEL = "deepseek-chat"
    private const val DEEP_SEEK_URL = "https://api.deepseek.com/v1/chat/completions"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.MINUTES)
        .readTimeout(4, TimeUnit.MINUTES)
        .writeTimeout(4, TimeUnit.MINUTES)
        .build()

    private val gson = Gson()
    private var provider: AiProvider = AiProvider.DEEP_SEEK
    private var appContext: Context? = null

    fun currentProvider(): AiProvider = provider

    suspend fun initialize(context: Context) {
        appContext = context.applicationContext
        AiConfig.load(context.applicationContext)
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
        appContext?.let { AiConfig.load(it) }
        when (provider) {
            AiProvider.GEMINI -> callGemini(prompt, systemMessage)
            AiProvider.DEEP_SEEK -> callDeepSeek(prompt, systemMessage, maxTokens)
        }
    }

    private suspend fun callGemini(prompt: String, systemMessage: String?): String {
        val key = AiConfig.geminiApiKey()
        if (key.isBlank()) {
            throw IllegalStateException(
                "API Key de Gemini no configurada. Agrega GEMINI_API_KEY en local.properties",
            )
        }
        val model = GenerativeModel(
            modelName = GEMINI_MODEL,
            apiKey = key,
            systemInstruction = systemMessage?.trim()?.takeIf { it.isNotEmpty() }?.let { content { text(it) } },
        )
        val response = model.generateContent(prompt)
        return response.text?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw IllegalStateException("Gemini no devolvió contenido")
    }

    private fun callDeepSeek(prompt: String, systemMessage: String?, maxTokens: Int): String {
        val key = AiConfig.deepSeekApiKey()
        if (key.isBlank()) {
            throw IllegalStateException(
                "API Key de DeepSeek no configurada. Agrega DEEPSEEK_API_KEY en local.properties",
            )
        }

        val messages = buildList {
            systemMessage?.trim()?.takeIf { it.isNotEmpty() }?.let {
                add(mapOf("role" to "system", "content" to it))
            }
            add(mapOf("role" to "user", "content" to prompt))
        }
        val body = gson.toJson(
            mapOf(
                "model" to DEEP_SEEK_MODEL,
                "messages" to messages,
                "temperature" to 0.7,
                "max_tokens" to maxTokens,
            ),
        )
        val request = Request.Builder()
            .url(DEEP_SEEK_URL)
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $key")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        httpClient.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val detail = parseDeepSeekError(responseBody)
                throw IllegalStateException("DeepSeek ${response.code}: $detail")
            }
            val content = parseDeepSeekContent(responseBody)
            return content?.trim()?.takeIf { it.isNotEmpty() }
                ?: throw IllegalStateException("DeepSeek no devolvió texto")
        }
    }

    private fun parseDeepSeekError(body: String): String {
        if (body.isBlank()) return "Sin detalles"
        return runCatching {
            val json = JSONObject(body)
            when {
                json.has("error") -> {
                    val err = json.get("error")
                    if (err is JSONObject) err.optString("message").ifBlank { err.toString() }
                    else err.toString()
                }
                else -> body.take(300)
            }
        }.getOrElse { body.take(300) }
    }

    private fun parseDeepSeekContent(body: String): String? = runCatching {
        val json = JSONObject(body)
        json.getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content")
    }.getOrNull()
}
