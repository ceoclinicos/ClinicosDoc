package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

/**
 * Dictado continuo: una vez en play, sigue escuchando hasta [stopListening]
 * (Stop o Procesar con IA). Android corta cada sesión; aquí se reinicia
 * solo cuando la sesión ya terminó (onResults / onError), nunca a mitad.
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
    private var sessionOpen = false
    private var starting = false
    private var lastReadyAt = 0L
    private var lastStartAt = 0L
    private var beepMuted = false

    var lastError: String? = null
        private set

    val isListening: Boolean
        get() = active

    private val restartRunnable = Runnable {
        restartQueued = false
        if (active) beginSession()
    }

    /** Si Android no entrega callback, fuerza otro arranque. */
    private val watchdogRunnable = object : Runnable {
        override fun run() {
            if (!active) return
            val now = SystemClock.elapsedRealtime()
            when {
                // Arranque sin respuesta: reintentar
                starting && !restartQueued && now - lastStartAt > 4_000L -> {
                    starting = false
                    sessionOpen = false
                    queueRestart(0L)
                }
                // Sesión cerrada y sin reinicio pendiente
                !starting && !sessionOpen && !restartQueued && lastStartAt > 0L &&
                    now - lastStartAt > 500L -> {
                    queueRestart(0L)
                }
                // Sesión “viva” pero sin actividad prolongada
                sessionOpen && now - lastReadyAt > 90_000L -> {
                    sessionOpen = false
                    starting = false
                    queueRestart(0L)
                }
            }
            mainHandler.postDelayed(this, 700L)
        }
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
        sessionOpen = false
        starting = false
        lastReadyAt = 0L
        lastStartAt = 0L
        committedText = existingText.trimEnd()
        sessionBase = committedText
        currentPartial = ""
        onResultCallback = onResult
        if (committedText.isNotEmpty()) {
            onResult(committedText, false)
        }
        muteRecognitionBeep()
        mainHandler.removeCallbacks(watchdogRunnable)
        mainHandler.postDelayed(watchdogRunnable, 700L)
        return beginSession()
    }

    fun stopListening() {
        active = false
        restartQueued = false
        sessionOpen = false
        starting = false
        mainHandler.removeCallbacks(restartRunnable)
        mainHandler.removeCallbacks(watchdogRunnable)
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
        sessionOpen = false
        starting = true
        lastStartAt = SystemClock.elapsedRealtime()
        sessionBase = committedText
        currentPartial = ""

        // Siempre recrear: reusar el mismo SpeechRecognizer falla en muchos OEM
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
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 120_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 60_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2_000L)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, langTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, langTag)
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
        }

        muteRecognitionBeep()
        return try {
            speechRecognizer?.startListening(intent)
            true
        } catch (_: Exception) {
            starting = false
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
        if (!active) return
        if (restartQueued) {
            // Acercar el reinicio si pedimos uno más pronto
            return
        }
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
            starting = false
            sessionOpen = true
            lastReadyAt = SystemClock.elapsedRealtime()
            muteRecognitionBeep()
        }

        override fun onBeginningOfSpeech() {
            lastReadyAt = SystemClock.elapsedRealtime()
        }

        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onEndOfSpeech() {
            // No reiniciar aquí: la sesión aún no cerró; llegan onResults u onError
            sessionOpen = false
            starting = false
        }

        override fun onError(error: Int) {
            sessionOpen = false
            starting = false
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
                    mainHandler.removeCallbacks(watchdogRunnable)
                }

                else -> {
                    lastError = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Error de audio"
                        SpeechRecognizer.ERROR_NETWORK -> "Error de red — revisa conexión"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Tiempo de red agotado"
                        SpeechRecognizer.ERROR_SERVER -> "Error del servidor de voz"
                        else -> null // no spamear UI; seguir intentando
                    }
                    queueRestart(150L)
                }
            }
        }

        override fun onResults(results: Bundle?) {
            sessionOpen = false
            starting = false
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
            lastReadyAt = SystemClock.elapsedRealtime()
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
