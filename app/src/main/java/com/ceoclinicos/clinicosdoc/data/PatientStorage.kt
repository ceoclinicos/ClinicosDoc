package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant

object PatientStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "patients_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<Patient> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<PatientDto>>() {}.type
        val dtos: List<PatientDto> = gson.fromJson(raw, type) ?: return emptyList()
        return dtos.map { it.toModel() }.sortedBy { it.nombre.lowercase() }
    }

    fun saveAllLocal(context: Context, patients: List<Patient>) {
        val json = gson.toJson(patients.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun saveAll(context: Context, patients: List<Patient>) {
        saveAllLocal(context, patients)
    }

    fun add(context: Context, patient: Patient): Patient {
        val all = loadAll(context).toMutableList()
        all.add(patient)
        saveAllLocal(context, all)
        SyncCoordinator.afterPatientSaved(context, patient)
        return patient
    }

    fun findByCedula(context: Context, cedula: String): Patient? {
        val normalized = CedulaNormalizer.normalize(cedula)
        if (normalized.isBlank()) return null
        return loadAll(context).firstOrNull {
            CedulaNormalizer.normalize(it.cedula) == normalized
        }
    }

    private fun Patient.toDto() = PatientDto(
        id = id,
        nombre = nombre,
        cedula = cedula,
        edad = edad,
        fechaNacimiento = fechaNacimiento.toString(),
        createdAt = createdAt.toString(),
        whatsapp = whatsapp,
        sexo = sexo,
    )

    private fun PatientDto.toModel() = Patient(
        id = id,
        nombre = nombre,
        cedula = cedula,
        edad = edad,
        fechaNacimiento = Instant.parse(fechaNacimiento),
        createdAt = Instant.parse(createdAt),
        whatsapp = whatsapp.orEmpty(),
        sexo = sexo.orEmpty(),
    )
}
