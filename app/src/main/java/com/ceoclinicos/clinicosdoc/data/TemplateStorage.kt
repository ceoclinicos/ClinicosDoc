package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

object TemplateStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "document_templates_json"
    private const val INITIALIZED_KEY = "templates_initialized"
    private const val HC_SECTIONS_VERSION_KEY = "hc_template_sections_version"
    private const val HC_SECTIONS_VERSION = 2
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun ensureDefaults(context: Context) {
        val p = prefs(context)
        if (!p.getBoolean(INITIALIZED_KEY, false)) {
            val defaults = DocumentType.entries.map { type ->
                DocumentTemplate(
                    id = UUID.randomUUID().toString(),
                    name = "Plantilla ${type.label}",
                    documentType = type,
                    sections = SectionCatalog.defaultsFor(type),
                    isDefault = true,
                    enabledPhysicalExamSystemIds = defaultExamSystemsFor(type),
                )
            }
            saveAllLocal(context, defaults)
            p.edit()
                .putBoolean(INITIALIZED_KEY, true)
                .putInt(HC_SECTIONS_VERSION_KEY, HC_SECTIONS_VERSION)
                .persist()
            SyncCoordinator.afterTemplatesBulkSaved(context)
            return
        }
        migrateHistoriaClinicaDefault(context)
    }

    private val LEGACY_HC_DEFAULT_SECTIONS = listOf(
        SectionCatalog.MOTIVO_CONSULTA,
        SectionCatalog.ENFERMEDAD_ACTUAL,
        SectionCatalog.ANTECEDENTES_PERSONALES,
        SectionCatalog.ANTECEDENTES_FAMILIARES,
        SectionCatalog.HABITOS_PSICOBIOLOGICOS,
        SectionCatalog.EXAMEN_FISICO,
        SectionCatalog.DIAGNOSTICO,
    )

    private fun migrateHistoriaClinicaDefault(context: Context) {
        val p = prefs(context)
        if (p.getInt(HC_SECTIONS_VERSION_KEY, 1) >= HC_SECTIONS_VERSION) return
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.documentType == DocumentType.HISTORIA_CLINICA && it.isDefault }
        if (idx >= 0 && all[idx].sections == LEGACY_HC_DEFAULT_SECTIONS) {
            all[idx] = all[idx].copy(sections = SectionCatalog.defaultsFor(DocumentType.HISTORIA_CLINICA))
            saveAllLocal(context, all)
            SyncCoordinator.afterTemplateSaved(context, all[idx])
        }
        p.edit().putInt(HC_SECTIONS_VERSION_KEY, HC_SECTIONS_VERSION).persist()
    }

    fun loadAll(context: Context): List<DocumentTemplate> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<DocumentTemplateDto>>() {}.type
        return gson.fromJson<List<DocumentTemplateDto>>(raw, type)?.map { it.toModel() } ?: emptyList()
    }

    fun forType(context: Context, type: DocumentType): List<DocumentTemplate> =
        loadAll(context)
            .filter { it.documentType == type }
            .sortedWith(compareBy<DocumentTemplate> { !it.isDefault }.thenBy { it.name })

    fun defaultForType(context: Context, type: DocumentType): DocumentTemplate? =
        forType(context, type).firstOrNull { it.isDefault }
            ?: forType(context, type).firstOrNull()

    fun saveAllLocal(context: Context, templates: List<DocumentTemplate>) {
        val json = gson.toJson(templates.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun saveAll(context: Context, templates: List<DocumentTemplate>) {
        saveAllLocal(context, templates)
    }

    fun upsert(context: Context, template: DocumentTemplate): DocumentTemplate {
        val all = loadAll(context).toMutableList()
        if (template.isDefault) {
            for (i in all.indices) {
                if (all[i].documentType == template.documentType && all[i].id != template.id) {
                    all[i] = all[i].copy(isDefault = false)
                }
            }
        }
        val idx = all.indexOfFirst { it.id == template.id }
        if (idx >= 0) all[idx] = template else all.add(template)
        saveAllLocal(context, all)
        SyncCoordinator.afterTemplateSaved(context, template)
        return template
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
        SyncCoordinator.afterTemplateDeleted(context, id)
    }

    private fun defaultExamSystemsFor(type: DocumentType): List<String> =
        when (type) {
            DocumentType.INFORME, DocumentType.HISTORIA_CLINICA -> PhysicalExamDefaults.defaultEnabledIds
            else -> emptyList()
        }

    private fun DocumentTemplate.toDto() = DocumentTemplateDto(
        id = id,
        name = name,
        documentType = DocumentType.storageName(documentType),
        sections = sections,
        isDefault = isDefault,
        enabledPhysicalExamSystemIds = enabledPhysicalExamSystemIds,
    )

    private fun DocumentTemplateDto.toModel() = DocumentTemplate(
        id = id,
        name = name,
        documentType = DocumentType.fromName(documentType),
        sections = sections,
        isDefault = isDefault ?: false,
        enabledPhysicalExamSystemIds = enabledPhysicalExamSystemIds.orEmpty(),
    )
}
