package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.RecipePreset
import com.ceoclinicos.clinicosdoc.model.RecipePresetFarmaco
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant
import java.util.UUID

object RecipePresetStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "recipe_presets_json_v1"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<RecipePreset> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<RecipePresetDto>>() {}.type
        return gson.fromJson<List<RecipePresetDto>>(raw, type)
            ?.map { it.toModel() }
            ?.sortedBy { it.name }
            ?: emptyList()
    }

    fun findById(context: Context, id: String): RecipePreset? =
        loadAll(context).firstOrNull { it.id == id }

    fun upsert(
        context: Context,
        id: String? = null,
        name: String,
        farmacos: List<RecipePresetFarmaco>,
    ): RecipePreset {
        val trimmedName = name.trim()
        require(trimmedName.isNotBlank()) { "Indique un nombre para la receta" }
        require(farmacos.isNotEmpty()) { "Agregue al menos un fármaco" }
        farmacos.forEach { f ->
            require(f.principioActivo.isNotBlank()) { "Cada fármaco necesita principio activo" }
            require(f.indicaciones.isNotBlank()) { "Cada fármaco necesita indicaciones" }
        }
        val now = Instant.now().toString()
        val all = loadAll(context).toMutableList()
        val recipeId = id?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
        val existing = all.firstOrNull { it.id == recipeId }
        val preset = RecipePreset(
            id = recipeId,
            name = trimmedName,
            farmacos = farmacos.map { f ->
                f.copy(
                    principioActivo = f.principioActivo.trim(),
                    presentacion = f.presentacion.trim().ifBlank { "Tabletas" },
                    concentracion = f.concentracion.trim(),
                    disponase = f.disponase.trim(),
                    indicaciones = f.indicaciones.trim(),
                )
            },
            createdAt = existing?.createdAt ?: now,
            updatedAt = now,
        )
        val idx = all.indexOfFirst { it.id == recipeId }
        if (idx >= 0) all[idx] = preset else all.add(preset)
        saveAll(context, all)
        return preset
    }

    fun delete(context: Context, id: String) {
        saveAll(context, loadAll(context).filterNot { it.id == id })
    }

    private fun saveAll(context: Context, list: List<RecipePreset>) {
        val json = gson.toJson(list.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).apply()
    }

    private data class RecipePresetDto(
        val id: String,
        val name: String,
        val farmacos: List<RecipePresetFarmacoDto> = emptyList(),
        val createdAt: String = "",
        val updatedAt: String = "",
    )

    private data class RecipePresetFarmacoDto(
        val principioActivo: String = "",
        val presentacion: String = "Tabletas",
        val concentracion: String = "",
        val disponase: String = "",
        val indicaciones: String = "",
    )

    private fun RecipePreset.toDto() = RecipePresetDto(
        id = id,
        name = name,
        farmacos = farmacos.map {
            RecipePresetFarmacoDto(
                principioActivo = it.principioActivo,
                presentacion = it.presentacion,
                concentracion = it.concentracion,
                disponase = it.disponase,
                indicaciones = it.indicaciones,
            )
        },
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun RecipePresetDto.toModel() = RecipePreset(
        id = id,
        name = name,
        farmacos = farmacos.map {
            RecipePresetFarmaco(
                principioActivo = it.principioActivo,
                presentacion = it.presentacion,
                concentracion = it.concentracion,
                disponase = it.disponase,
                indicaciones = it.indicaciones,
            )
        },
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
