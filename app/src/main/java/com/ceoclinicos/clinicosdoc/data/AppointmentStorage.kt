package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant

object AppointmentStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "appointments_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<Appointment> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<AppointmentDto>>() {}.type
        return gson.fromJson<List<AppointmentDto>>(raw, type)?.map { it.toModel() }
            ?.sortedBy { it.scheduledAt } ?: emptyList()
    }

    fun saveAllLocal(context: Context, appointments: List<Appointment>) {
        prefs(context).edit().putString(KEY, gson.toJson(appointments.map { it.toDto() })).persist()
    }

    fun saveAll(context: Context, appointments: List<Appointment>) {
        saveAllLocal(context, appointments)
    }

    fun upsert(context: Context, appointment: Appointment): Appointment {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == appointment.id }
        if (idx >= 0) all[idx] = appointment else all.add(appointment)
        saveAllLocal(context, all)
        SyncCoordinator.afterAppointmentSaved(context, appointment)
        return appointment
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
        SyncCoordinator.afterAppointmentDeleted(context, id)
    }

    fun findById(context: Context, id: String): Appointment? =
        loadAll(context).firstOrNull { it.id == id }

    private fun Appointment.toDto() = AppointmentDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientWhatsapp = patientWhatsapp,
        scheduledAt = scheduledAt.toString(),
        motivo = motivo,
        whatsappReminder = whatsappReminder,
        createdAt = createdAt.toString(),
    )

    private fun AppointmentDto.toModel() = Appointment(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientWhatsapp = patientWhatsapp,
        scheduledAt = Instant.parse(scheduledAt),
        motivo = motivo,
        whatsappReminder = whatsappReminder ?: true,
        createdAt = Instant.parse(createdAt),
    )
}
