package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

object PhysicalExamCatalogStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "physical_exam_catalog_json"
    private const val INITIALIZED_KEY = "physical_exam_catalog_initialized"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun ensureDefaults(context: Context) {
        if (prefs(context).getBoolean(INITIALIZED_KEY, false)) return
        saveAllLocal(context, PhysicalExamDefaults.builtIn)
        prefs(context).edit().putBoolean(INITIALIZED_KEY, true).persist()
        SyncCoordinator.afterPhysicalExamCatalogBulkSaved(context)
    }

    fun loadAll(context: Context): List<PhysicalExamSystem> {
        val raw = prefs(context).getString(KEY, null) ?: return PhysicalExamDefaults.builtIn
        val type = object : TypeToken<List<PhysicalExamSystemCloudDto>>() {}.type
        return gson.fromJson<List<PhysicalExamSystemCloudDto>>(raw, type)
            ?.map { it.toModel() }
            ?.sortedBy { it.sortOrder }
            ?: PhysicalExamDefaults.builtIn
    }

    fun findById(context: Context, id: String): PhysicalExamSystem? =
        loadAll(context).firstOrNull { it.id == id }

    fun saveAllLocal(context: Context, systems: List<PhysicalExamSystem>) {
        val json = gson.toJson(systems.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun upsert(context: Context, system: PhysicalExamSystem): PhysicalExamSystem {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == system.id }
        if (idx >= 0) all[idx] = system else all.add(system)
        saveAllLocal(context, all.sortedBy { it.sortOrder })
        SyncCoordinator.afterPhysicalExamSystemSaved(context, system)
        return system
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
        SyncCoordinator.afterPhysicalExamSystemDeleted(context, id)
    }

    fun createNew(name: String, defaultText: String): PhysicalExamSystem {
        val slug = name.lowercase()
            .replace(Regex("[^a-záéíóúñ0-9]+"), "_")
            .trim('_')
            .ifBlank { "sistema" }
        return PhysicalExamSystem(
            id = "${slug}_${UUID.randomUUID().toString().take(6)}",
            name = name.trim(),
            defaultText = defaultText.trim(),
            sortOrder = 100,
        )
    }

    fun resolvedForTemplate(context: Context, enabledIds: List<String>): List<PhysicalExamSystem> {
        val catalog = loadAll(context)
        val ids = enabledIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds }
        return catalog.filter { it.id in ids }.sortedBy { it.sortOrder }
    }

    private fun PhysicalExamSystem.toDto() = PhysicalExamSystemCloudDto(
        id = id,
        name = name,
        defaultText = defaultText,
        sortOrder = sortOrder,
    )

    private fun PhysicalExamSystemCloudDto.toModel() = PhysicalExamSystem(
        id = id,
        name = name,
        defaultText = defaultText,
        sortOrder = sortOrder,
    )
}
