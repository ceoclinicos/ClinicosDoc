package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.net.Uri
import android.util.Base64
import java.io.File

/** Foto del sello del médico: imagen cuadrada que se imprime al pie del documento. */
data class SelloMedico(
    val path: String?,
    val base64: String?,
)

/**
 * Sello médico del doctor: una sola plantilla global (no por encabezado).
 * La imagen se guarda local y en base64 para sincronizar con el perfil en la nube.
 */
object SelloStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY_PATH = "sello_medico_path"
    private const val KEY_BASE64 = "sello_medico_base64"
    private const val FILE_NAME = "sello_medico.jpg"
    private const val MIN_SELLO_SIDE = 128
    private const val MIGRATED_KEY = "sello_medico_migrated"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun hasSello(context: Context): Boolean = load(context) != null

    fun load(context: Context): SelloMedico? {
        migrateFromHeadersOnce(context)
        val p = prefs(context)
        val base64 = p.getString(KEY_BASE64, null)
        var path = p.getString(KEY_PATH, null)
        if (path != null && !File(path).exists()) path = null
        if (path == null && !base64.isNullOrBlank()) {
            path = materialize(context, base64)
        }
        if (path == null && base64.isNullOrBlank()) return null
        return SelloMedico(path = path, base64 = base64)
    }

    /** Persiste la foto elegida/recortada. Sincroniza la imagen con el perfil. */
    fun saveFromUri(context: Context, uri: Uri): SelloMedico {
        val result = HeaderStorage.persistImage(
            context,
            uri,
            destFileName = FILE_NAME,
            minSide = MIN_SELLO_SIDE,
            padToSquare = false,
        )
        val sello = SelloMedico(path = result.path, base64 = result.base64)
        prefs(context).edit()
            .putString(KEY_PATH, result.path)
            .putString(KEY_BASE64, result.base64)
            .persist()
        SyncCoordinator.afterSelloSaved(context, sello)
        return sello
    }

    /** Guarda solo el base64 recibido de la nube y materializa el archivo local. */
    fun saveRemote(context: Context, base64: String?) {
        if (base64.isNullOrBlank()) return
        val path = materialize(context, base64)
        prefs(context).edit()
            .putString(KEY_BASE64, base64)
            .putString(KEY_PATH, path)
            .persist()
    }

    fun clear(context: Context) {
        prefs(context).getString(KEY_PATH, null)?.let { path ->
            File(path).takeIf { it.exists() }?.delete()
        }
        prefs(context).edit().remove(KEY_PATH).remove(KEY_BASE64).persist()
        SyncCoordinator.afterSelloSaved(context, null)
    }

    private fun materialize(context: Context, base64: String): String? =
        runCatching {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val dest = File(context.filesDir, FILE_NAME)
            dest.writeBytes(bytes)
            dest.absolutePath
        }.getOrNull()

    /** Migra el sello que antes vivía en un encabezado a la plantilla global. */
    private fun migrateFromHeadersOnce(context: Context) {
        val p = prefs(context)
        if (p.getBoolean(MIGRATED_KEY, false)) return
        p.edit().putBoolean(MIGRATED_KEY, true).persist()
        if (p.contains(KEY_BASE64) || p.contains(KEY_PATH)) return
        val (legacyPath, dtoBase64) = HeaderStorage.legacySello(context) ?: return
        val base64 = dtoBase64 ?: runCatching {
            legacyPath?.let { File(it).takeIf { f -> f.exists() }?.readBytes() }
                ?.let { Base64.encodeToString(it, Base64.NO_WRAP) }
        }.getOrNull() ?: return
        val path = materialize(context, base64)
        p.edit().putString(KEY_BASE64, base64).putString(KEY_PATH, path).persist()
    }
}
