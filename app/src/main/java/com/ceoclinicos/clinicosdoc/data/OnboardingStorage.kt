package com.ceoclinicos.clinicosdoc.data

import android.content.Context

object OnboardingStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val REDACTAR_TUTORIAL_SEEN = "onboarding_redactar_v1_seen"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun hasSeenRedactarTutorial(context: Context): Boolean =
        prefs(context).getBoolean(REDACTAR_TUTORIAL_SEEN, false)

    fun markRedactarTutorialSeen(context: Context) {
        prefs(context).edit().putBoolean(REDACTAR_TUTORIAL_SEEN, true).apply()
    }

    fun resetRedactarTutorial(context: Context) {
        prefs(context).edit().remove(REDACTAR_TUTORIAL_SEEN).apply()
    }
}
