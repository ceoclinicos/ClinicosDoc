package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.DoctorProfile

object DoctorStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val REGISTERED_KEY = "doctor_registered"
    private const val USER_ID_KEY = "doctor_user_id"
    private const val PREFIX = "doctor_"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isRegistered(context: Context): Boolean =
        prefs(context).getBoolean(REGISTERED_KEY, false)

    fun userId(context: Context): String? =
        prefs(context).getString(USER_ID_KEY, null)

    fun clearSession(context: Context) {
        prefs(context).edit()
            .remove(REGISTERED_KEY)
            .remove(USER_ID_KEY)
            .remove("${PREFIX}nombre")
            .remove("${PREFIX}cedula")
            .remove("${PREFIX}mpps")
            .remove("${PREFIX}sexo")
            .remove("${PREFIX}especialidad")
            .remove("${PREFIX}whatsapp")
            .remove("${PREFIX}correo")
            .apply()
    }

    fun loadProfile(context: Context): DoctorProfile? {
        val p = prefs(context)
        if (!p.getBoolean(REGISTERED_KEY, false)) return null
        return DoctorProfile(
            nombre = p.getString("${PREFIX}nombre", "") ?: "",
            cedula = p.getString("${PREFIX}cedula", "") ?: "",
            mpps = p.getString("${PREFIX}mpps", "") ?: "",
            sexo = p.getString("${PREFIX}sexo", "") ?: "",
            especialidad = p.getString("${PREFIX}especialidad", "") ?: "",
            whatsapp = p.getString("${PREFIX}whatsapp", "") ?: "",
            correo = p.getString("${PREFIX}correo", "") ?: "",
        )
    }

    fun saveSession(context: Context, profile: DoctorProfile, userId: String) {
        prefs(context).edit().apply {
            putString(USER_ID_KEY, userId)
            putString("${PREFIX}nombre", profile.nombre)
            putString("${PREFIX}cedula", profile.cedula)
            putString("${PREFIX}mpps", profile.mpps)
            putString("${PREFIX}sexo", profile.sexo)
            putString("${PREFIX}especialidad", profile.especialidad)
            putString("${PREFIX}whatsapp", profile.whatsapp)
            putString("${PREFIX}correo", profile.correo)
            putBoolean(REGISTERED_KEY, true)
            persist()
        }
    }

    fun saveProfileLocal(context: Context, profile: DoctorProfile) {
        prefs(context).edit().apply {
            putString("${PREFIX}nombre", profile.nombre)
            putString("${PREFIX}cedula", profile.cedula)
            putString("${PREFIX}mpps", profile.mpps)
            putString("${PREFIX}sexo", profile.sexo)
            putString("${PREFIX}especialidad", profile.especialidad)
            putString("${PREFIX}whatsapp", profile.whatsapp)
            putString("${PREFIX}correo", profile.correo)
            putBoolean(REGISTERED_KEY, true)
            persist()
        }
        SyncCoordinator.afterProfileSaved(context, profile)
    }
}
