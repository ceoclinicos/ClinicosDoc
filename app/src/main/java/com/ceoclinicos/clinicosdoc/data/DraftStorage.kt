package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Duration
import java.time.Instant

object DraftStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "clinical_drafts_json"
    private const val DRAFT_MAX_AGE_DAYS = 7L
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<ClinicalDraft> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<ClinicalDraftDto>>() {}.type
        val parsed = gson.fromJson<List<ClinicalDraftDto>>(raw, type)
            ?.map { it.toModel() }
            ?.sortedByDescending { it.updatedAt }
            ?: emptyList()
        return purgeExpired(context, parsed)
    }

    /** Elimina borradores con más de [DRAFT_MAX_AGE_DAYS] sin actualizarse. */
    private fun purgeExpired(context: Context, drafts: List<ClinicalDraft>): List<ClinicalDraft> {
        val cutoff = Instant.now().minus(Duration.ofDays(DRAFT_MAX_AGE_DAYS))
        val fresh = drafts.filter { !it.updatedAt.isBefore(cutoff) }
        if (fresh.size == drafts.size) return fresh
        val expiredIds = drafts.filter { it.updatedAt.isBefore(cutoff) }.map { it.id }
        saveAllLocal(context, fresh)
        expiredIds.forEach { SyncCoordinator.afterDraftDeleted(context, it) }
        return fresh
    }

    fun findById(context: Context, id: String): ClinicalDraft? =
        loadAll(context).firstOrNull { it.id == id }

    fun upsert(context: Context, draft: ClinicalDraft): ClinicalDraft {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == draft.id }
        if (idx >= 0) all[idx] = draft else all.add(0, draft)
        saveAllLocal(context, all)
        SyncCoordinator.afterDraftSaved(context, draft)
        return draft
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
        SyncCoordinator.afterDraftDeleted(context, id)
    }

    fun saveAllLocal(context: Context, drafts: List<ClinicalDraft>) {
        prefs(context).edit().putString(KEY, gson.toJson(drafts.map { it.toDto() })).persist()
    }

    private fun ClinicalDraft.toDto() = ClinicalDraftDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        documentType = DocumentType.storageName(documentType),
        dictation = dictation,
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        generatedContent = generatedContent,
        membreteNombre = membrete?.nombre,
        membreteEdad = membrete?.edad,
        membreteCedula = membrete?.cedula,
        membreteSexo = membrete?.sexo,
        membreteFechaNacimiento = membrete?.fechaNacimiento,
        membreteFecha = membrete?.fecha,
        membreteTelefono = membrete?.telefono,
        membreteDireccion = membrete?.direccion,
        membreteOcupacion = membrete?.ocupacion,
        membreteAcompananteNombre = membrete?.acompananteNombre,
        membreteAcompananteTelefono = membrete?.acompananteTelefono,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

    private fun ClinicalDraftDto.toModel() = ClinicalDraft(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        documentType = DocumentType.fromName(documentType),
        dictation = dictation,
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        generatedContent = generatedContent,
        membrete = PatientMembrete.fromStorageFields(
            patientCedula = patientCedula,
            nombre = membreteNombre,
            edad = membreteEdad,
            cedula = membreteCedula,
            sexo = membreteSexo,
            fechaNacimiento = membreteFechaNacimiento,
            fecha = membreteFecha,
            telefono = membreteTelefono,
            direccion = membreteDireccion,
            ocupacion = membreteOcupacion,
            acompananteNombre = membreteAcompananteNombre,
            acompananteTelefono = membreteAcompananteTelefono,
        ),
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt),
    )
}
