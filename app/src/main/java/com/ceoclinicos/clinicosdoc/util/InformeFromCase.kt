package com.ceoclinicos.clinicosdoc.util

import android.content.Context
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.data.SelloStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.model.SectionDefaults
import java.time.Instant
import java.util.UUID

private val IS_DX_TITLE = Regex("""(?i)diagn[oó]stico""")

/**
 * Crea un INFORME a partir de una historia clínica (u otro informe) ya redactada:
 * copia verbatim las secciones que coinciden con las de la plantilla de informe
 * (Motivo de consulta, Enfermedad actual, Examen físico, Diagnóstico, Plan…)
 * y usa el texto predeterminado de la plantilla para las que falten.
 */
object InformeFromCase {

    fun buildContent(context: Context, sourceContent: String): String {
        val srcSections = parseDocumentSections(sourceContent)
        val template = informeTemplate(context)
        val wanted = template?.normalizedSections()
            ?.filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
            ?: SectionCatalog.defaultsFor(DocumentType.INFORME)
                .filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
        val defaults = template?.sectionDefaultTexts.orEmpty()
        val sections = wanted.map { title ->
            val body = srcSections.firstOrNull { titlesMatch(it.title, title) }
                ?.body?.trim().orEmpty()
                .ifBlank { SectionDefaults.textFor(title, defaults) }
            DocumentSection(title = title, body = body)
        }
        return serializeDocumentSections(sections)
    }

    /** Crea y guarda el informe; devuelve el documento listo para abrir en detalle. */
    fun create(context: Context, source: ClinicalDocument): ClinicalDocument {
        val template = informeTemplate(context)
        val patient = PatientStorage.loadAll(context).firstOrNull { it.id == source.patientId }
        val doc = ClinicalDocument(
            id = UUID.randomUUID().toString(),
            patientId = source.patientId,
            patientNombre = source.patientNombre,
            patientCedula = source.patientCedula,
            type = DocumentType.INFORME,
            content = buildContent(context, source.content),
            rawDictation = "",
            createdAt = Instant.now(),
            templateId = template?.id,
            templateName = template?.name,
            headerId = source.headerId,
            headerSnapshot = source.headerSnapshot,
            membrete = patient?.let { PatientMembrete.fromPatient(it) }
                ?: source.membrete
                ?: PatientMembrete.forDocument(source),
            sourceDocumentId = source.id.takeIf { it != "preview" },
            clinicId = source.clinicId,
            clinicName = source.clinicName,
            doctorNombre = source.doctorNombre,
            incluirSello = source.incluirSello,
            selloBase64 = source.selloBase64
                ?: SelloStorage.load(context)?.base64,
        )
        DocumentStorage.add(context, doc)
        return doc
    }

    private fun informeTemplate(context: Context) =
        TemplateStorage.forType(context, DocumentType.INFORME).firstOrNull { it.isDefault }
            ?: TemplateStorage.forType(context, DocumentType.INFORME).firstOrNull()

    private fun titlesMatch(sourceTitle: String, wantedTitle: String): Boolean {
        val a = normalizeSectionTitle(sourceTitle)
        val b = normalizeSectionTitle(wantedTitle)
        if (a.equals(b, ignoreCase = true)) return true
        // "Diagnóstico" ↔ "Impresión diagnóstica"
        return IS_DX_TITLE.containsMatchIn(a) && IS_DX_TITLE.containsMatchIn(b)
    }
}
