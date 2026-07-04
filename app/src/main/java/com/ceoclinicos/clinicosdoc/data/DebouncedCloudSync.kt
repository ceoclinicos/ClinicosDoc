package com.ceoclinicos.clinicosdoc.data

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Espera [DEBOUNCE_MS] tras el último cambio antes de subir a Firebase.
 * Si llega otro cambio del mismo ítem, cancela el envío pendiente.
 */
object DebouncedCloudSync {
    private const val TAG = "DebouncedCloudSync"
    private const val DEBOUNCE_MS = 10_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pendingJobs = ConcurrentHashMap<String, Job>()

    fun schedule(key: String, block: suspend () -> Unit) {
        pendingJobs.remove(key)?.cancel()
        pendingJobs[key] = scope.launch {
            try {
                delay(DEBOUNCE_MS)
                block()
            } catch (e: Exception) {
                Log.e(TAG, "Envío diferido falló ($key): ${e.message}", e)
            } finally {
                pendingJobs.remove(key)
            }
        }
    }
}
