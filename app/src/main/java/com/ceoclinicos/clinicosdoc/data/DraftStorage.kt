package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant

object DraftStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "clinical_drafts_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<ClinicalDraft> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<ClinicalDraftDto>>() {}.type
        return gson.fromJson<List<ClinicalDraftDto>>(raw, type)
            ?.map { it.toModel() }
            ?.sortedByDescending { it.updatedAt }
            ?: emptyList()
    }

    fun findById(context: Context, id: String): ClinicalDraft? =
        loadAll(context).firstOrNull { it.id == id }

    fun upsert(context: Context, draft: ClinicalDraft): ClinicalDraft {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == draft.id }
        if (idx >= 0) all[idx] = draft else all.add(0, draft)
        saveAllLocal(context, all)
        return draft
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
    }

    private fun saveAllLocal(context: Context, drafts: List<ClinicalDraft>) {
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
        membreteSexo = membrete?.sexo,
        membreteFechaNacimiento = membrete?.fechaNacimiento,
        membreteFecha = membrete?.fecha,
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
        membrete = if (
            membreteNombre != null ||
            membreteEdad != null ||
            membreteSexo != null ||
            membreteFechaNacimiento != null ||
            membreteFecha != null
        ) {
            PatientMembrete(
                nombre = membreteNombre.orEmpty(),
                edad = membreteEdad.orEmpty(),
                sexo = membreteSexo.orEmpty(),
                fechaNacimiento = membreteFechaNacimiento.orEmpty(),
                fecha = membreteFecha.orEmpty(),
            )
        } else {
            null
        },
        createdAt = Instant.parse(createdAt),
        updatedAt = Instant.parse(updatedAt),
    )
}
