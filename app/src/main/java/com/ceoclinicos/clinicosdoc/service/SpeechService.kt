package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

/**
 * Dictado: el micrófono solo está activo tras pulsar el botón y se apaga con
 * Stop o Procesar con IA. Android cierra cada sesión al detectar pausa; se
 * reinicia mientras [active] sea true.
 */
class SpeechService(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager =
        appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private var speechRecognizer: SpeechRecognizer? = null
    private var available = false
    private var spanishLocale: Locale? = null
    private var active = false
    private var committedText = ""
    private var sessionBase = ""
    private var currentPartial = ""
    private var onResultCallback: ((String, Boolean) -> Unit)? = null
    private var restartQueued = false
    private var beepMuted = false

    var lastError: String? = null
        private set

    val isListening: Boolean
        get() = active

    private val restartRunnable = Runnable {
        restartQueued = false
        if (active) beginSession()
    }

    fun initialize(): Boolean {
        lastError = null
        if (!SpeechRecognizer.isRecognitionAvailable(appContext)) {
            lastError = "Reconocimiento de voz no disponible en este dispositivo"
            available = false
            return false
        }
        spanishLocale = resolveSpanishLocale()
        available = true
        return true
    }

    fun startListening(
        existingText: String = "",
        onResult: (String, Boolean) -> Unit,
    ): Boolean {
        lastError = null
        if (!available && !initialize()) return false

        active = true
        restartQueued = false
        committedText = existingText.trimEnd()
        sessionBase = committedText
        currentPartial = ""
        onResultCallback = onResult
        if (committedText.isNotEmpty()) {
            onResult(committedText, false)
        }
        muteRecognitionBeep()
        return beginSession()
    }

    fun stopListening() {
        active = false
        restartQueued = false
        mainHandler.removeCallbacks(restartRunnable)
        mainHandler.removeCallbacksAndMessages(null)
        currentPartial = ""
        onResultCallback = null
        try {
            speechRecognizer?.cancel()
        } catch (_: Exception) {
        }
        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {
        }
        speechRecognizer = null
        unmuteRecognitionBeep()
    }

    private fun beginSession(): Boolean {
        if (!active) return false
        sessionBase = committedText
        currentPartial = ""

        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(appContext).apply {
            setRecognitionListener(recognitionListener)
        }

        val langTag = spanishLocale?.toLanguageTag() ?: "es-ES"
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, langTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, langTag)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
        }

        muteRecognitionBeep()
        return try {
            speechRecognizer?.startListening(intent)
            true
        } catch (_: Exception) {
            lastError = "No se pudo iniciar el micrófono. Revisa permisos e idioma español."
            try {
                speechRecognizer?.destroy()
            } catch (_: Exception) {
            }
            speechRecognizer = null
            if (active) queueRestart(250L)
            true
        }
    }

    private fun queueRestart(delayMs: Long) {
        if (!active || restartQueued) return
        restartQueued = true
        mainHandler.removeCallbacks(restartRunnable)
        mainHandler.postDelayed(restartRunnable, delayMs.coerceAtLeast(0L))
    }

    private fun muteRecognitionBeep() {
        if (beepMuted) return
        try {
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0)
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_MUTE, 0)
            beepMuted = true
        } catch (_: Exception) {
        }
    }

    private fun unmuteRecognitionBeep() {
        if (!beepMuted) return
        try {
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_UNMUTE, 0)
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_UNMUTE, 0)
        } catch (_: Exception) {
        }
        beepMuted = false
    }

    private fun emitDisplay(isFinal: Boolean) {
        val display = joinText(sessionBase, currentPartial)
        onResultCallback?.invoke(display, isFinal)
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            muteRecognitionBeep()
        }

        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
        override fun onEndOfSpeech() = Unit

        override fun onError(error: Int) {
            if (!active) return
            when (error) {
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                SpeechRecognizer.ERROR_NO_MATCH,
                -> queueRestart(60L)

                SpeechRecognizer.ERROR_CLIENT,
                -> queueRestart(120L)

                SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                -> queueRestart(400L)

                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                    lastError = "Permiso de micrófono requerido"
                    unmuteRecognitionBeep()
                    active = false
                }

                else -> {
                    lastError = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Error de audio"
                        SpeechRecognizer.ERROR_NETWORK -> "Error de red — revisa conexión"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Tiempo de red agotado"
                        SpeechRecognizer.ERROR_SERVER -> "Error del servidor de voz"
                        else -> null
                    }
                    queueRestart(150L)
                }
            }
        }

        override fun onResults(results: Bundle?) {
            if (!active) return
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            if (text.isNotBlank()) {
                committedText = joinText(sessionBase, text)
                currentPartial = ""
                onResultCallback?.invoke(committedText, true)
            }
            queueRestart(60L)
        }

        override fun onPartialResults(partialResults: Bundle?) {
            if (!active) return
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            if (text.isBlank() || text == currentPartial) return
            currentPartial = text
            emitDisplay(isFinal = false)
        }
    }

    private fun joinText(base: String, addition: String): String {
        val left = base.trimEnd()
        val right = addition.trim()
        if (left.isEmpty()) return right
        if (right.isEmpty()) return left
        val leftL = left.lowercase()
        val rightL = right.lowercase()
        if (rightL.startsWith(leftL)) return right
        if (leftL.endsWith(rightL)) return left
        val lastWords = leftL.split(Regex("\\s+")).takeLast(8).joinToString(" ")
        if (lastWords.isNotBlank() && rightL.startsWith(lastWords)) {
            return left + right.substring(lastWords.length)
        }
        return "$left $right"
    }

    private fun resolveSpanishLocale(): Locale? {
        val preferred = listOf("es-VE", "es-ES", "es-MX", "es-CO", "es-US", "es")
            .map { Locale.forLanguageTag(it) }
        val available = Locale.getAvailableLocales().toSet()
        return preferred.firstOrNull { loc ->
            available.any {
                it.language.equals(loc.language, ignoreCase = true) &&
                    (loc.country.isEmpty() || it.country.equals(loc.country, ignoreCase = true))
            }
        } ?: preferred.firstOrNull()
    }
}
