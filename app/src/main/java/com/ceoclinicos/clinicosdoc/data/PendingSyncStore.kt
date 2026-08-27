package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/** Ítems pendientes de subir a la nube (documentos / plantillas). */
object PendingSyncStore {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "pending_cloud_sync_json"
    private const val LAST_FLUSH_KEY = "pending_cloud_sync_last_flush_ms"
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    data class Item(
        val kind: String,
        val id: String,
        val label: String,
        val updatedAt: String,
    )

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun list(context: Context): List<Item> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<Item>>() {}.type
        return gson.fromJson(raw, type) ?: emptyList()
    }

    fun count(context: Context): Int = list(context).size

    fun mark(context: Context, kind: String, id: String, label: String) {
        val next = list(context).filterNot { it.kind == kind && it.id == id } +
            Item(kind, id, label, java.time.Instant.now().toString())
        prefs(context).edit().putString(KEY, gson.toJson(next)).apply()
    }

    fun clear(context: Context, kind: String, id: String) {
        val next = list(context).filterNot { it.kind == kind && it.id == id }
        prefs(context).edit().putString(KEY, gson.toJson(next)).apply()
    }

    fun lastFlushMs(context: Context): Long =
        prefs(context).getLong(LAST_FLUSH_KEY, 0L)

    fun markFlushed(context: Context) {
        prefs(context).edit().putLong(LAST_FLUSH_KEY, System.currentTimeMillis()).apply()
    }

    fun toast(context: Context, message: String, long: Boolean = false) {
        val app = context.applicationContext
        mainHandler.post {
            Toast.makeText(
                app,
                message,
                if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT,
            ).show()
        }
    }
}
