package com.ceoclinicos.clinicosdoc.util

import android.content.Context
import java.util.UUID

/** Identificador estable de instalación (firma del dispositivo para antifraude de trial). */
object DeviceId {
    private const val PREFS = "clinicos_device"
    private const val KEY = "installation_id"

    fun get(context: Context): String {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY, null)?.trim().orEmpty()
        if (existing.length >= 8) return existing
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(KEY, created).apply()
        return created
    }
}
