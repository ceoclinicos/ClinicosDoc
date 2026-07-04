package com.ceoclinicos.clinicosdoc.config

import android.content.Context
import com.ceoclinicos.clinicosdoc.BuildConfig

object AiConfig {
    private var geminiKey: String = ""
    private var deepSeekKey: String = ""
    private var loaded = false

    fun load(context: Context) {
        if (loaded && geminiKey.isNotEmpty() && deepSeekKey.isNotEmpty()) return

        geminiKey = BuildConfig.GEMINI_API_KEY.trim()
        deepSeekKey = BuildConfig.DEEPSEEK_API_KEY.trim()

        if (geminiKey.isEmpty() || deepSeekKey.isEmpty()) {
            runCatching {
                context.assets.open("config/ai_keys.properties").bufferedReader().use { reader ->
                    reader.lineSequence().forEach { line ->
                        val trimmed = line.trim()
                        if (trimmed.isEmpty() || trimmed.startsWith("#") || !trimmed.contains("=")) return@forEach
                        val idx = trimmed.indexOf('=')
                        val key = trimmed.substring(0, idx).trim()
                        val value = trimmed.substring(idx + 1).trim()
                        when (key) {
                            "GEMINI_API_KEY" -> if (geminiKey.isEmpty()) geminiKey = value
                            "DEEPSEEK_API_KEY" -> if (deepSeekKey.isEmpty()) deepSeekKey = value
                        }
                    }
                }
            }
        }

        loaded = true
    }

    fun geminiApiKey(): String = geminiKey

    fun deepSeekApiKey(): String = deepSeekKey
}
