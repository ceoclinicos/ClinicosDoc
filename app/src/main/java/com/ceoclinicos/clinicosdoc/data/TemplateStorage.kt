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
    private const val HC_SECTIONS_VERSION = 5
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
                    sectionLayoutOrder = SectionCatalog.initialLayoutOrder(type, SectionCatalog.defaultsFor(type)),
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
        migrateTemplateSections(context)
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

    private fun migrateTemplateSections(context: Context) {
        val p = prefs(context)
        if (p.getInt(HC_SECTIONS_VERSION_KEY, 1) >= HC_SECTIONS_VERSION) return
        val all = loadAll(context).toMutableList()
        var changed = false
        for (i in all.indices) {
            val tpl = all[i]
            val renamed = tpl.sections.map { section ->
                when {
                    section.equals(SectionCatalog.MOTIVO_INFORME, ignoreCase = true) ->
                        SectionCatalog.MOTIVO_CONSULTA
                    section.equals(SectionCatalog.HALLAZGOS_CLINICOS, ignoreCase = true) ->
                        SectionCatalog.ENFERMEDAD_ACTUAL
                    else -> section
                }
            }.distinct()
            val layoutRenamed = tpl.sectionLayoutOrder.map { section ->
                when {
                    section.equals(SectionCatalog.MOTIVO_INFORME, ignoreCase = true) ->
                        SectionCatalog.MOTIVO_CONSULTA
                    section.equals(SectionCatalog.HALLAZGOS_CLINICOS, ignoreCase = true) ->
                        SectionCatalog.ENFERMEDAD_ACTUAL
                    else -> section
                }
            }.distinct()

            val sections = when {
                tpl.documentType == DocumentType.INFORME -> {
                    val base = SectionCatalog.defaultsFor(DocumentType.INFORME)
                    val extras = renamed.filter {
                        it !in base && it in SectionCatalog.catalogFor(DocumentType.INFORME)
                    }
                    SectionCatalog.normalizeActive(DocumentType.INFORME, base + extras)
                }
                tpl.documentType == DocumentType.HISTORIA_CLINICA -> {
                    val normalized = SectionCatalog.normalizeActive(tpl.documentType, renamed)
                    if (SectionCatalog.EXAMEN_FISICO !in normalized) {
                        val diagIdx = normalized.indexOf(SectionCatalog.DIAGNOSTICO)
                        if (diagIdx >= 0) {
                            normalized.toMutableList().apply { add(diagIdx, SectionCatalog.EXAMEN_FISICO) }
                        } else {
                            normalized + SectionCatalog.EXAMEN_FISICO
                        }
                    } else {
                        normalized
                    }
                }
                else -> SectionCatalog.normalizeActive(tpl.documentType, renamed)
            }

            val desiredOrder = if (tpl.documentType == DocumentType.INFORME) {
                SectionCatalog.catalogFor(DocumentType.INFORME)
            } else {
                null
            }

            val updated = tpl.copy(
                sections = sections,
                sectionLayoutOrder = when {
                    desiredOrder != null -> {
                        val activeFirst = sections
                        val rest = desiredOrder.filter { it !in activeFirst.toSet() }
                        activeFirst + rest
                    }
                    layoutRenamed.isEmpty() ->
                        SectionCatalog.initialLayoutOrder(tpl.documentType, sections)
                    else -> {
                        val known = layoutRenamed.filter { it in SectionCatalog.catalogFor(tpl.documentType) }
                        val missing = SectionCatalog.catalogFor(tpl.documentType).filter { it !in known.toSet() }
                        (listOf(SectionCatalog.DATOS_PACIENTE) +
                            (known + missing).filterNot { it == SectionCatalog.DATOS_PACIENTE })
                            .distinct()
                    }
                },
            )
            if (updated != tpl) {
                all[i] = updated
                changed = true
            }
        }
        if (changed) {
            saveAllLocal(context, all)
            SyncCoordinator.afterTemplatesBulkSaved(context)
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
        physicalExamTextOverrides = physicalExamTextOverrides,
        enfermedadActualEjemplo = enfermedadActualEjemplo,
        sectionLayoutOrder = sectionLayoutOrder,
    )

    private fun DocumentTemplateDto.toModel() = DocumentTemplate(
        id = id,
        name = name,
        documentType = DocumentType.fromName(documentType),
        sections = sections,
        isDefault = isDefault ?: false,
        sectionLayoutOrder = sectionLayoutOrder.orEmpty(),
        enabledPhysicalExamSystemIds = enabledPhysicalExamSystemIds.orEmpty(),
        physicalExamTextOverrides = physicalExamTextOverrides.orEmpty(),
        enfermedadActualEjemplo = enfermedadActualEjemplo.orEmpty(),
    )
}
