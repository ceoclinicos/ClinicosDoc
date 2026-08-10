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
 * Dictado clínico continuo: el micrófono permanece activo hasta [stopListening]
 * (botón Stop o “Procesar con IA”). Android cierra cada sesión de voz al detectar
 * pausa; aquí se reinicia al instante sin “frenar” la experiencia.
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
    private var restartScheduled = false
    private var beepMuted = false

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
        restartScheduled = false
        committedText = existingText.trimEnd()
        sessionBase = committedText
        currentPartial = ""
        onResultCallback = onResult
        if (committedText.isNotEmpty()) {
            onResult(committedText, false)
        }
        muteRecognitionBeep()
        return beginSession(recreate = true)
    }

    fun stopListening() {
        active = false
        restartScheduled = false
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

    private fun beginSession(recreate: Boolean = false): Boolean {
        if (!active) return false
        restartScheduled = false

        sessionBase = committedText
        currentPartial = ""

        if (recreate || speechRecognizer == null) {
            try {
                speechRecognizer?.destroy()
            } catch (_: Exception) {
            }
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(appContext).apply {
                setRecognitionListener(recognitionListener)
            }
        }

        val langTag = spanishLocale?.toLanguageTag() ?: "es-ES"
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            // Pedir silencios largos (muchos OEM lo ignoran; el reinicio cubre el resto)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 120_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 60_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1_000L)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, langTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, langTag)
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
        }

        // Mantener silencio de beeps mientras siga activo
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
            if (active) scheduleRestart(200L, recreate = true)
            true
        }
    }

    private fun scheduleRestart(delayMs: Long = 40L, recreate: Boolean = false) {
        if (!active || restartScheduled) return
        restartScheduled = true
        mainHandler.removeCallbacksAndMessages(null)
        mainHandler.postDelayed({
            restartScheduled = false
            if (active) beginSession(recreate = recreate)
        }, delayMs)
    }

    private fun muteRecognitionBeep() {
        if (beepMuted) return
        try {
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_SYSTEM, AudioManager.ADJUST_MUTE, 0)
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_MUTE, 0)
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0)
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
            @Suppress("DEPRECATION")
            audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0)
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
            // No desmutear: el beep de cada reinicio molesta en dictados largos
            muteRecognitionBeep()
        }

        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onEndOfSpeech() {
            // Android corta aquí; reiniciar al toque si el usuario no ha parado
            if (active) scheduleRestart(40L, recreate = false)
        }

        override fun onError(error: Int) {
            if (!active) return
            when (error) {
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_CLIENT,
                -> scheduleRestart(40L, recreate = false)

                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> scheduleRestart(350L, recreate = true)

                else -> {
                    lastError = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Error de audio"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permiso de micrófono requerido"
                        SpeechRecognizer.ERROR_NETWORK -> "Error de red — revisa conexión"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Tiempo de red agotado"
                        SpeechRecognizer.ERROR_SERVER -> "Error del servidor de voz"
                        else -> "Error de reconocimiento ($error)"
                    }
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                        unmuteRecognitionBeep()
                        active = false
                    } else {
                        scheduleRestart(80L, recreate = true)
                    }
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
            // Seguir escuchando de inmediato
            scheduleRestart(40L, recreate = false)
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
