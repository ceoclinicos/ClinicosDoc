package com.ceoclinicos.clinicosdoc.config

import android.content.Context

/**
 * La IA va solo por proxy autenticado (/api/chat).
 * No se cargan API keys en el APK.
 */
object AiConfig {
    fun load(@Suppress("UNUSED_PARAMETER") context: Context) {
        // no-op
    }
}
