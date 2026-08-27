package com.ceoclinicos.clinicosdoc.util

import android.content.Context
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.util.ClinicalDateTimeFormat.formatDocumentDateTime

data class PatientActivityRow(
    val key: String,
    val patientId: String,
    val patientCedula: String,
    val patientNombre: String,
    val edad: String,
    val diagnostico: String,
    val lastAtEpochMs: Long,
    val lastAtLabel: String,
    val docCount: Int,
)

object PatientActivity {
    private fun keyOf(doc: ClinicalDocument): String {
        val ced = CedulaNormalizer.normalize(doc.patientCedula)
        if (ced.isNotBlank()) return "c:$ced"
        if (doc.patientId.isNotBlank()) return "id:${doc.patientId}"
        return "n:${doc.patientNombre.trim().lowercase()}"
    }

    fun buildRows(context: Context): List<PatientActivityRow> {
        val docs = DocumentStorage.loadAll(context).filter {
            it.type == DocumentType.INFORME || it.type == DocumentType.HISTORIA_CLINICA
        }
        val patients = PatientStorage.loadAll(context)
        val byCedula = patients.associateBy { CedulaNormalizer.normalize(it.cedula) }
        val byId = patients.associateBy { it.id }
        val map = linkedMapOf<String, PatientActivityRow>()

        for (doc in docs) {
            val key = keyOf(doc)
            val ced = CedulaNormalizer.normalize(doc.patientCedula)
            val patient: Patient? = byCedula[ced] ?: byId[doc.patientId]
            val edad = when {
                patient != null && patient.edad > 0 -> patient.edad.toString()
                !doc.membrete?.edad.isNullOrBlank() -> doc.membrete!!.edad.trim()
                else -> "—"
            }
            val dx = extractDiagnosticoPreview(doc.content)
            val existing = map[key]
            if (existing == null) {
                map[key] = PatientActivityRow(
                    key = key,
                    patientId = patient?.id ?: doc.patientId,
                    patientCedula = ced.ifBlank { doc.patientCedula },
                    patientNombre = patient?.nombre ?: doc.patientNombre.ifBlank { "Paciente" },
                    edad = edad,
                    diagnostico = dx,
                    lastAtEpochMs = doc.createdAt.toEpochMilli(),
                    lastAtLabel = formatDocumentDateTime(doc.createdAt),
                    docCount = 1,
                )
            } else {
                val newer = doc.createdAt.toEpochMilli() > existing.lastAtEpochMs
                map[key] = existing.copy(
                    docCount = existing.docCount + 1,
                    lastAtEpochMs = if (newer) doc.createdAt.toEpochMilli() else existing.lastAtEpochMs,
                    lastAtLabel = if (newer) formatDocumentDateTime(doc.createdAt) else existing.lastAtLabel,
                    diagnostico = if (newer) dx else existing.diagnostico,
                    patientNombre = if (newer) {
                        patient?.nombre ?: doc.patientNombre.ifBlank { existing.patientNombre }
                    } else existing.patientNombre,
                    edad = if (newer && edad != "—") edad else existing.edad,
                )
            }
        }
        return map.values.sortedByDescending { it.lastAtEpochMs }
    }

    fun documentsForPatient(context: Context, cedula: String, patientId: String = ""): List<ClinicalDocument> {
        val ced = CedulaNormalizer.normalize(cedula)
        return DocumentStorage.loadAll(context).filter { doc ->
            (ced.isNotBlank() && CedulaNormalizer.normalize(doc.patientCedula) == ced) ||
                (patientId.isNotBlank() && doc.patientId == patientId)
        }
    }
}
