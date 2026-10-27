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
    /** Clínicas dejadas voluntariamente: el sync no debe re-agregarlas ni avisar. */
    private const val KEY_LEFT_CLINICS = "clinic_left_ids_json"
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

    fun loadLeftClinicIds(context: Context): Set<String> {
        val raw = prefs(context).getString(KEY_LEFT_CLINICS, null) ?: return emptySet()
        val type = object : TypeToken<List<String>>() {}.type
        return (gson.fromJson<List<String>>(raw, type) ?: emptyList()).toSet()
    }

    fun markClinicLeft(context: Context, clinicId: String) {
        val id = clinicId.trim()
        if (id.isEmpty()) return
        val next = loadLeftClinicIds(context) + id
        prefs(context).edit().putString(KEY_LEFT_CLINICS, gson.toJson(next.toList())).apply()
    }

    fun clearClinicLeft(context: Context, clinicId: String) {
        val id = clinicId.trim()
        if (id.isEmpty()) return
        val next = loadLeftClinicIds(context) - id
        prefs(context).edit().putString(KEY_LEFT_CLINICS, gson.toJson(next.toList())).apply()
    }

    fun filterOutLeft(context: Context, list: List<ClinicMembership>): List<ClinicMembership> {
        val left = loadLeftClinicIds(context)
        if (left.isEmpty()) return list
        return list.filterNot { it.clinicId in left }
    }

    /**
     * Guarda membresías y, si ya había línea base, encola avisos de altas/bajas.
     * @return avisos nuevos en esta sincronización
     */
    fun saveDetectingChanges(context: Context, next: List<ClinicMembership>): List<String> {
        val filtered = filterOutLeft(context, next)
        val previous = load(context)
        val hadBaseline = prefs(context).getBoolean(KEY_BASELINE, false)
        save(context, filtered.sortedBy { it.clinicName })
        if (!hadBaseline) {
            prefs(context).edit().putBoolean(KEY_BASELINE, true).apply()
            return emptyList()
        }
        val left = loadLeftClinicIds(context)
        val prevById = previous.associateBy { it.clinicId }
        val nextById = filtered.associateBy { it.clinicId }
        val notices = mutableListOf<String>()
        for ((id, m) in nextById) {
            if (id !in prevById && id !in left) {
                notices += "La clínica «${m.clinicName}» te ha agregado a su equipo."
            }
        }
        for ((id, m) in prevById) {
            if (id !in nextById && id !in left) {
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

    fun enqueueNotice(context: Context, message: String) {
        val msg = message.trim()
        if (msg.isEmpty()) return
        val pending = loadPendingNotices(context) + msg
        prefs(context).edit().putString(KEY_PENDING_NOTICES, gson.toJson(pending)).apply()
    }

    fun dismissCurrentNotice(context: Context) {
        val rest = loadPendingNotices(context).drop(1)
        prefs(context).edit().putString(KEY_PENDING_NOTICES, gson.toJson(rest)).apply()
    }

    fun purgePendingNoticesForClinic(context: Context, clinicName: String) {
        val name = clinicName.trim()
        if (name.isEmpty()) return
        val pending = loadPendingNotices(context).filterNot { it.contains("«$name»") }
        prefs(context).edit().putString(KEY_PENDING_NOTICES, gson.toJson(pending)).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit()
            .remove(KEY)
            .remove(KEY_BASELINE)
            .remove(KEY_PENDING_NOTICES)
            .remove(KEY_PENDING_INVITES)
            .remove(KEY_LEFT_CLINICS)
            .apply()
    }

    fun upsert(context: Context, membership: ClinicMembership) {
        clearClinicLeft(context, membership.clinicId)
        val next = load(context).filterNot { it.clinicId == membership.clinicId } + membership
        saveDetectingChanges(context, next.sortedBy { it.clinicName })
        removePendingInvite(context, membership.clinicId)
    }

    /** Quita afiliación sin avisos (acción voluntaria del médico). */
    fun remove(context: Context, clinicId: String) {
        save(context, load(context).filterNot { it.clinicId == clinicId })
    }
}
