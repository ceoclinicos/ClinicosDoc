package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/** Caché local de moldes/encabezados de clínicas afiliadas. */
object ClinicCatalogStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY_TEMPLATES = "clinic_templates_cache_json"
    private const val KEY_HEADERS = "clinic_headers_cache_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveTemplates(context: Context, clinicId: String, templates: List<DocumentTemplate>) {
        val all = loadAllTemplates(context).toMutableMap()
        all[clinicId] = templates
        prefs(context).edit().putString(KEY_TEMPLATES, gson.toJson(all)).apply()
    }

    fun saveHeaders(context: Context, clinicId: String, headers: List<DocumentHeader>) {
        val all = loadAllHeaders(context).toMutableMap()
        all[clinicId] = headers
        prefs(context).edit().putString(KEY_HEADERS, gson.toJson(all)).apply()
    }

    fun loadTemplates(context: Context, clinicId: String, documentType: DocumentType? = null): List<DocumentTemplate> {
        val list = loadAllTemplates(context)[clinicId].orEmpty()
        return if (documentType == null) list else list.filter { it.documentType == documentType }
    }

    fun loadHeaders(context: Context, clinicId: String): List<DocumentHeader> =
        loadAllHeaders(context)[clinicId].orEmpty()

    fun clear(context: Context) {
        prefs(context).edit().remove(KEY_TEMPLATES).remove(KEY_HEADERS).apply()
    }

    fun retainClinics(context: Context, clinicIds: Set<String>) {
        val t = loadAllTemplates(context).filterKeys { it in clinicIds }
        val h = loadAllHeaders(context).filterKeys { it in clinicIds }
        prefs(context).edit()
            .putString(KEY_TEMPLATES, gson.toJson(t))
            .putString(KEY_HEADERS, gson.toJson(h))
            .apply()
    }

    private fun loadAllTemplates(context: Context): Map<String, List<DocumentTemplate>> {
        val raw = prefs(context).getString(KEY_TEMPLATES, null) ?: return emptyMap()
        val type = object : TypeToken<Map<String, List<DocumentTemplate>>>() {}.type
        return gson.fromJson(raw, type) ?: emptyMap()
    }

    private fun loadAllHeaders(context: Context): Map<String, List<DocumentHeader>> {
        val raw = prefs(context).getString(KEY_HEADERS, null) ?: return emptyMap()
        val type = object : TypeToken<Map<String, List<DocumentHeader>>>() {}.type
        return gson.fromJson(raw, type) ?: emptyMap()
    }
}
