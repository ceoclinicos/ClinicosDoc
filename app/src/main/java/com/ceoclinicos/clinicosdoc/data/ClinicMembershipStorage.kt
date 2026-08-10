package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicDoctorInvitation
import com.ceoclinicos.clinicosdoc.model.ClinicMembership
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object ClinicMembershipStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "clinic_memberships_json"
    private const val KEY_BASELINE = "clinic_memberships_baseline_v1"
    private const val KEY_PENDING_NOTICES = "clinic_affiliation_notices_json"
    private const val KEY_PENDING_INVITES = "clinic_pending_invites_json"
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

    fun loadPendingInvites(context: Context): List<ClinicDoctorInvitation> {
        val raw = prefs(context).getString(KEY_PENDING_INVITES, null) ?: return emptyList()
        val type = object : TypeToken<List<ClinicDoctorInvitation>>() {}.type
        return gson.fromJson(raw, type) ?: emptyList()
    }

    fun savePendingInvites(context: Context, list: List<ClinicDoctorInvitation>) {
        prefs(context).edit().putString(KEY_PENDING_INVITES, gson.toJson(list)).apply()
    }

    fun removePendingInvite(context: Context, clinicId: String) {
        savePendingInvites(context, loadPendingInvites(context).filterNot { it.clinicId == clinicId })
    }

    /**
     * Guarda membresías y, si ya había línea base, encola avisos de altas/bajas.
     * @return avisos nuevos en esta sincronización
     */
    fun saveDetectingChanges(context: Context, next: List<ClinicMembership>): List<String> {
        val previous = load(context)
        val hadBaseline = prefs(context).getBoolean(KEY_BASELINE, false)
        save(context, next.sortedBy { it.clinicName })
        if (!hadBaseline) {
            prefs(context).edit().putBoolean(KEY_BASELINE, true).apply()
            return emptyList()
        }
        val prevById = previous.associateBy { it.clinicId }
        val nextById = next.associateBy { it.clinicId }
        val notices = mutableListOf<String>()
        for ((id, m) in nextById) {
            if (id !in prevById) {
                notices += "La clínica «${m.clinicName}» te ha agregado a su equipo."
            }
        }
        for ((id, m) in prevById) {
            if (id !in nextById) {
                notices += "La clínica «${m.clinicName}» te ha quitado de su equipo."
            }
        }
        if (notices.isNotEmpty()) {
            val pending = loadPendingNotices(context) + notices
            prefs(context).edit().putString(KEY_PENDING_NOTICES, gson.toJson(pending)).apply()
        }
        return notices
    }

    fun loadPendingNotices(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_PENDING_NOTICES, null) ?: return emptyList()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(raw, type) ?: emptyList()
    }

    fun dismissCurrentNotice(context: Context) {
        val rest = loadPendingNotices(context).drop(1)
        prefs(context).edit().putString(KEY_PENDING_NOTICES, gson.toJson(rest)).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit()
            .remove(KEY)
            .remove(KEY_BASELINE)
            .remove(KEY_PENDING_NOTICES)
            .remove(KEY_PENDING_INVITES)
            .apply()
    }

    fun upsert(context: Context, membership: ClinicMembership) {
        val next = load(context).filterNot { it.clinicId == membership.clinicId } + membership
        saveDetectingChanges(context, next.sortedBy { it.clinicName })
        removePendingInvite(context, membership.clinicId)
    }

    fun remove(context: Context, clinicId: String) {
        saveDetectingChanges(context, load(context).filterNot { it.clinicId == clinicId })
    }
}
