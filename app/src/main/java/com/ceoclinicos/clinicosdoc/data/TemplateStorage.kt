package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.OrdenesMedicasDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.RecetaDefaults
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

object TemplateStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "document_templates_json"
    private const val INITIALIZED_KEY = "templates_initialized"
    private const val HC_SECTIONS_VERSION_KEY = "hc_template_sections_version"
    private const val HC_SECTIONS_VERSION = 8
    const val MAX_PER_TYPE = 1
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun ensureDefaults(context: Context) {
        val p = prefs(context)
        if (!p.getBoolean(INITIALIZED_KEY, false)) {
            val defaults = DocumentType.entries.map { type ->
                defaultTemplateFor(type)
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
        enforceOneTemplatePerType(context)
    }

    /** Deja una sola plantilla por tipo (preferida: la predeterminada). */
    private fun collapseToOnePerType(templates: List<DocumentTemplate>): List<DocumentTemplate> {
        return DocumentType.entries.mapNotNull { type ->
            val ofType = templates.filter { it.documentType == type }
            ofType.firstOrNull { it.isDefault } ?: ofType.firstOrNull()
        }.map { it.copy(isDefault = true) }
    }

    private fun enforceOneTemplatePerType(context: Context) {
        val all = loadAll(context)
        val unique = collapseToOnePerType(all).toMutableList()
        var changed = unique.size != all.size ||
            unique.any { a -> all.none { b -> b.id == a.id && b.isDefault == a.isDefault } }
        DocumentType.entries.forEach { type ->
            if (unique.none { it.documentType == type }) {
                unique.add(defaultTemplateFor(type))
                changed = true
            }
        }
        // Sembrar molde de órdenes si la plantilla existe sin texto personalizado
        unique.forEachIndexed { index, tpl ->
            if (tpl.documentType == DocumentType.ORDENES_MEDICAS) {
                val hasMolde = tpl.sectionDefaultTexts.keys.any {
                    it.equals(OrdenesMedicasDefaults.SECTION_ORDENES, ignoreCase = true)
                }
                if (!hasMolde) {
                    unique[index] = tpl.copy(
                        sectionDefaultTexts = tpl.sectionDefaultTexts + (
                            OrdenesMedicasDefaults.SECTION_ORDENES to OrdenesMedicasDefaults.MOLDE_EJEMPLO
                            ),
                        sections = SectionCatalog.defaultsFor(DocumentType.ORDENES_MEDICAS),
                        sectionLayoutOrder = SectionCatalog.initialLayoutOrder(
                            DocumentType.ORDENES_MEDICAS,
                            SectionCatalog.defaultsFor(DocumentType.ORDENES_MEDICAS),
                        ),
                    )
                    changed = true
                }
            }
            if (tpl.documentType == DocumentType.RECETA) {
                val texts = tpl.sectionDefaultTexts.toMutableMap()
                var seeded = false
                if (texts.keys.none { it.equals(RecetaDefaults.SECTION_RECIPE, ignoreCase = true) }) {
                    texts[RecetaDefaults.SECTION_RECIPE] = RecetaDefaults.MOLDE_RECIPE
                    seeded = true
                }
                if (texts.keys.none { it.equals(RecetaDefaults.SECTION_INDICACIONES, ignoreCase = true) }) {
                    texts[RecetaDefaults.SECTION_INDICACIONES] = RecetaDefaults.MOLDE_INDICACIONES
                    seeded = true
                }
                if (seeded) {
                    unique[index] = tpl.copy(
                        sectionDefaultTexts = texts,
                        sections = SectionCatalog.defaultsFor(DocumentType.RECETA),
                        sectionLayoutOrder = SectionCatalog.initialLayoutOrder(
                            DocumentType.RECETA,
                            SectionCatalog.defaultsFor(DocumentType.RECETA),
                        ),
                    )
                    changed = true
                }
            }
        }
        if (changed) {
            saveAllLocal(context, unique)
            SyncCoordinator.afterTemplatesBulkSaved(context)
        }
    }

    private fun defaultTemplateFor(type: DocumentType): DocumentTemplate {
        val sections = SectionCatalog.defaultsFor(type)
        val texts = when (type) {
            DocumentType.ORDENES_MEDICAS -> mapOf(
                OrdenesMedicasDefaults.SECTION_ORDENES to OrdenesMedicasDefaults.MOLDE_EJEMPLO,
            )
            DocumentType.RECETA -> mapOf(
                RecetaDefaults.SECTION_RECIPE to RecetaDefaults.MOLDE_RECIPE,
                RecetaDefaults.SECTION_INDICACIONES to RecetaDefaults.MOLDE_INDICACIONES,
            )
            else -> emptyMap()
        }
        return DocumentTemplate(
            id = UUID.randomUUID().toString(),
            name = "Plantilla ${type.label}",
            documentType = type,
            sections = sections,
            isDefault = true,
            enabledPhysicalExamSystemIds = defaultExamSystemsFor(type),
            sectionLayoutOrder = SectionCatalog.initialLayoutOrder(type, sections),
            sectionDefaultTexts = texts,
        )
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

    /**
     * Garantiza una plantilla por tipo (útil tras sync o al añadir tipos nuevos como Órdenes).
     * No es suspend: se puede llamar desde UI.
     */
    fun ensureAllTypesPresent(context: Context): List<DocumentTemplate> {
        enforceOneTemplatePerType(context)
        return loadAll(context)
    }

    /** Devuelve la plantilla del tipo, creándola si falta. */
    fun ensureTemplateForType(context: Context, type: DocumentType): DocumentTemplate {
        ensureAllTypesPresent(context)
        return defaultForType(context, type)
            ?: run {
                val created = defaultTemplateFor(type)
                upsert(context, created)
            }
    }

    fun saveAllLocal(context: Context, templates: List<DocumentTemplate>) {
        val json = gson.toJson(templates.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun saveAll(context: Context, templates: List<DocumentTemplate>) {
        saveAllLocal(context, templates)
    }

    fun upsert(context: Context, template: DocumentTemplate): DocumentTemplate {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == template.id }
        // Solo se permite personalizar la única plantilla de cada tipo; no crear extras.
        val toSave = if (idx < 0) {
            val existing = all.firstOrNull { it.documentType == template.documentType }
            if (existing != null) {
                template.copy(id = existing.id, isDefault = true)
            } else {
                template.copy(isDefault = true)
            }
        } else {
            template.copy(isDefault = true)
        }.let { tpl ->
            tpl.copy(
                enabledPhysicalExamSystemIds = PhysicalExamDefaults.orderEnabledIds(
                    tpl.enabledPhysicalExamSystemIds.ifEmpty {
                        defaultExamSystemsFor(tpl.documentType)
                    },
                ),
            )
        }
        val saveIdx = all.indexOfFirst { it.id == toSave.id }
        if (saveIdx >= 0) {
            all[saveIdx] = toSave
        } else {
            all.add(toSave)
        }
        val unique = collapseToOnePerType(all)
        saveAllLocal(context, unique)
        val saved = unique.first { it.documentType == toSave.documentType }
        SyncCoordinator.afterTemplateSaved(context, saved)
        return saved
    }

    fun delete(context: Context, id: String) {
        // No permitir borrar la única plantilla de un tipo.
        val all = loadAll(context)
        val target = all.firstOrNull { it.id == id } ?: return
        if (all.count { it.documentType == target.documentType } <= MAX_PER_TYPE) return
        saveAllLocal(context, all.filterNot { it.id == id })
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
        sectionDefaultTexts = sectionDefaultTexts,
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
        enabledPhysicalExamSystemIds = PhysicalExamDefaults.orderEnabledIds(
            enabledPhysicalExamSystemIds.orEmpty(),
        ),
        physicalExamTextOverrides = physicalExamTextOverrides.orEmpty(),
        sectionDefaultTexts = sectionDefaultTexts.orEmpty(),
        enfermedadActualEjemplo = enfermedadActualEjemplo.orEmpty(),
    )
}
