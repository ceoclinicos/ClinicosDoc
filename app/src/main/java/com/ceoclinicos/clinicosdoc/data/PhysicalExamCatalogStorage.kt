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
    private const val ORDER_VERSION_KEY = "physical_exam_order_version"
    private const val ORDER_VERSION = 4
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun ensureDefaults(context: Context) {
        val p = prefs(context)
        if (!p.getBoolean(INITIALIZED_KEY, false)) {
            saveAllLocal(context, PhysicalExamDefaults.builtIn)
            p.edit()
                .putBoolean(INITIALIZED_KEY, true)
                .putInt(ORDER_VERSION_KEY, ORDER_VERSION)
                .persist()
            SyncCoordinator.afterPhysicalExamCatalogBulkSaved(context)
            return
        }
        migrateSortOrder(context)
    }

    private fun migrateSortOrder(context: Context) {
        val p = prefs(context)
        if (p.getInt(ORDER_VERSION_KEY, 1) >= ORDER_VERSION) return
        val updated = loadAll(context).map { system ->
            val order = PhysicalExamDefaults.displayPriority[system.id] ?: system.sortOrder
            system.copy(sortOrder = order)
        }
        saveAllLocal(context, reportDisplayOrder(updated))
        p.edit().putInt(ORDER_VERSION_KEY, ORDER_VERSION).persist()
        SyncCoordinator.afterPhysicalExamCatalogBulkSaved(context)
    }

    fun loadAll(context: Context): List<PhysicalExamSystem> {
        val raw = prefs(context).getString(KEY, null) ?: return PhysicalExamDefaults.builtIn
        val type = object : TypeToken<List<PhysicalExamSystemCloudDto>>() {}.type
        return gson.fromJson<List<PhysicalExamSystemCloudDto>>(raw, type)
            ?.map { it.toModel() }
            ?.let { reportDisplayOrder(it) }
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
        val ids = PhysicalExamDefaults.orderEnabledIds(
            enabledIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds },
        )
        return reportDisplayOrder(catalog.filter { it.id in ids })
    }

    /** Orden de redacción clínico fijo (no depende del orden de activación). */
    fun reportDisplayOrder(systems: List<PhysicalExamSystem>): List<PhysicalExamSystem> {
        return systems.sortedWith(
            compareBy<PhysicalExamSystem>(
                { PhysicalExamDefaults.displayPriority[it.id] ?: (it.sortOrder + 100) },
                { it.sortOrder },
                { it.name },
            ),
        )
    }

    fun resolvedForReport(
        context: Context,
        enabledIds: List<String>,
        textOverrides: Map<String, String> = emptyMap(),
    ): List<PhysicalExamSystem> {
        val catalog = loadAll(context).associateBy { it.id }
        val ids = PhysicalExamDefaults.orderEnabledIds(
            enabledIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds },
        )
        return reportDisplayOrder(
            ids.mapNotNull { catalog[it] }.map { system ->
                textOverrides[system.id]?.let { system.copy(defaultText = it) } ?: system
            },
        )
    }

    /** Misma secuencia clínica del informe. */
    @Suppress("UNUSED_PARAMETER")
    fun displayOrderForConfig(
        catalog: List<PhysicalExamSystem>,
        enabledIds: List<String>,
    ): List<PhysicalExamSystem> = reportDisplayOrder(catalog)

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
