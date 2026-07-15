package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.HeaderInfoLine
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant

object DocumentStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "clinical_documents_json"
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun loadAll(context: Context): List<ClinicalDocument> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<ClinicalDocumentDto>>() {}.type
        val dtos: List<ClinicalDocumentDto> = gson.fromJson(raw, type) ?: return emptyList()
        return dtos.map { it.toModel() }.sortedByDescending { it.createdAt }
    }

    fun saveAllLocal(context: Context, docs: List<ClinicalDocument>) {
        val json = gson.toJson(docs.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun saveAll(context: Context, docs: List<ClinicalDocument>) {
        saveAllLocal(context, docs)
    }

    fun add(context: Context, doc: ClinicalDocument): ClinicalDocument {
        val all = loadAll(context).toMutableList()
        all.add(0, doc)
        saveAllLocal(context, all)
        SyncCoordinator.afterDocumentSaved(context, doc)
        return doc
    }

    fun update(context: Context, doc: ClinicalDocument): ClinicalDocument {
        val all = loadAll(context)
        if (all.none { it.id == doc.id }) return add(context, doc)
        saveAllLocal(context, all.map { if (it.id == doc.id) doc else it })
        SyncCoordinator.afterDocumentSaved(context, doc)
        return doc
    }

    fun delete(context: Context, id: String) {
        saveAllLocal(context, loadAll(context).filterNot { it.id == id })
        SyncCoordinator.afterDocumentDeleted(context, id)
    }

    private fun ClinicalDocument.toDto() = ClinicalDocumentDto(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        type = DocumentType.storageName(type),
        content = content,
        rawDictation = rawDictation,
        createdAt = createdAt.toString(),
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        headerSnapshot = headerSnapshot?.toDto(),
        membreteNombre = membrete?.nombre,
        membreteEdad = membrete?.edad,
        membreteSexo = membrete?.sexo,
        membreteFechaNacimiento = membrete?.fechaNacimiento,
        membreteFecha = membrete?.fecha,
    )

    private fun ClinicalDocumentDto.toModel() = ClinicalDocument(
        id = id,
        patientId = patientId,
        patientNombre = patientNombre,
        patientCedula = patientCedula,
        type = DocumentType.fromName(type),
        content = content,
        rawDictation = rawDictation ?: "",
        createdAt = Instant.parse(createdAt),
        templateId = templateId,
        templateName = templateName,
        headerId = headerId,
        headerSnapshot = headerSnapshot?.toModel(),
        membrete = toMembrete(),
    )

    private fun ClinicalDocumentDto.toMembrete(): PatientMembrete? {
        val hasData = listOf(
            membreteNombre,
            membreteEdad,
            membreteSexo,
            membreteFechaNacimiento,
            membreteFecha,
        ).any { !it.isNullOrBlank() }
        if (!hasData) return null
        return PatientMembrete(
            nombre = membreteNombre.orEmpty(),
            edad = membreteEdad.orEmpty(),
            sexo = membreteSexo.orEmpty(),
            fechaNacimiento = membreteFechaNacimiento.orEmpty(),
            fecha = membreteFecha.orEmpty(),
        )
    }

    private fun DocumentHeader.toDto() = DocumentHeaderDto(
        id = id,
        name = name,
        logoPath = logoPath,
        logoBase64 = logoBase64,
        doctorName = doctorName,
        subtitle = subtitle,
        description = description,
        infoLines = infoLines.map { HeaderInfoLineDto(it.label, it.value) },
        isDefault = isDefault,
        headerType = headerType.name,
    )

    private fun DocumentHeaderDto.toModel(): DocumentHeader {
        val lines = infoLines?.map { HeaderInfoLine(it.label ?: "", it.value ?: "") }
            ?: DocumentHeader.emptyInfoLines()
        return DocumentHeader(
            id = id,
            name = name,
            logoPath = logoPath,
            logoBase64 = logoBase64,
            doctorName = doctorName ?: "",
            subtitle = subtitle ?: "",
            description = description ?: "",
            infoLines = lines,
            isDefault = isDefault ?: false,
            headerType = HeaderType.fromStorage(headerType),
        )
    }
}
