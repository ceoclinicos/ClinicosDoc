package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

class SpeechService(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    private var speechRecognizer: SpeechRecognizer? = null
    private var available = false
    private var spanishLocale: Locale? = null
    private var active = false
    private var committedText = ""
    private var sessionBase = ""
    private var currentPartial = ""
    private var onResultCallback: ((String, Boolean) -> Unit)? = null

    var lastError: String? = null
        private set

    val isListening: Boolean
        get() = active

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
        committedText = existingText.trimEnd()
        sessionBase = committedText
        currentPartial = ""
        onResultCallback = onResult
        if (committedText.isNotEmpty()) {
            onResult(committedText, false)
        }
        return beginSession()
    }

    fun stopListening() {
        active = false
        mainHandler.removeCallbacksAndMessages(null)
        currentPartial = ""
        onResultCallback = null
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun beginSession(): Boolean {
        if (!active) return false

        sessionBase = committedText
        currentPartial = ""

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(appContext).apply {
            setRecognitionListener(recognitionListener)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3_000L)
            spanishLocale?.let { putExtra(RecognizerIntent.EXTRA_LANGUAGE, it.toLanguageTag()) }
                ?: putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES")
        }

        return try {
            speechRecognizer?.startListening(intent)
            true
        } catch (_: Exception) {
            lastError = "No se pudo iniciar el micrófono. Revisa permisos e idioma español."
            active = false
            false
        }
    }

    private fun scheduleRestart() {
        if (!active) return
        mainHandler.postDelayed({
            if (active) beginSession()
        }, 200L)
    }

    private fun emitDisplay(isFinal: Boolean) {
        val display = joinText(sessionBase, currentPartial)
        onResultCallback?.invoke(display, isFinal)
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onError(error: Int) {
            if (!active) return
            when (error) {
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                SpeechRecognizer.ERROR_NO_MATCH,
                -> scheduleRestart()

                SpeechRecognizer.ERROR_CLIENT -> Unit

                else -> {
                    lastError = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Error de audio"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permiso de micrófono requerido"
                        SpeechRecognizer.ERROR_NETWORK -> "Error de red"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Tiempo de red agotado"
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Reconocedor ocupado"
                        SpeechRecognizer.ERROR_SERVER -> "Error del servidor"
                        else -> "Error de reconocimiento ($error)"
                    }
                    scheduleRestart()
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
            scheduleRestart()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            if (!active) return
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            currentPartial = text
            emitDisplay(isFinal = false)
        }
    }

    private fun joinText(base: String, addition: String): String {
        val left = base.trimEnd()
        val right = addition.trim()
        if (left.isEmpty()) return right
        if (right.isEmpty()) return left
        return "$left $right"
    }

    private fun resolveSpanishLocale(): Locale? =
        listOf("es-VE", "es-ES", "es-MX", "es-CO", "es-US", "es")
            .map { Locale.forLanguageTag(it) }
            .firstOrNull()
}
