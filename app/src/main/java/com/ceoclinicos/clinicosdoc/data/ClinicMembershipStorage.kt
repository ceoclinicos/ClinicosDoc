package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicMembership
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object ClinicMembershipStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "clinic_memberships_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(context: Context): List<ClinicMembership> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<ClinicMembership>>() {}.type
        return gson.fromJson(raw, type) ?: emptyList()
    }

    fun save(context: Context, list: List<ClinicMembership>) {
        prefs(context).edit().putString(KEY, gson.toJson(list)).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().remove(KEY).apply()
    }

    fun upsert(context: Context, membership: ClinicMembership) {
        val next = load(context).filterNot { it.clinicId == membership.clinicId } + membership
        save(context, next.sortedBy { it.clinicName })
    }

    fun remove(context: Context, clinicId: String) {
        save(context, load(context).filterNot { it.clinicId == clinicId })
    }
}
