package com.ceoclinicos.clinicosdoc

import com.ceoclinicos.clinicosdoc.util.DocumentSection
import com.ceoclinicos.clinicosdoc.util.normalizeSectionMarkdown
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections
import com.ceoclinicos.clinicosdoc.util.serializeDocumentSections
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DocumentContentParserTest {

    @Test
    fun examenFisico_vaAlTitulo_noAlContenido() {
        val raw = """
            Se trata de paciente femenino de 31 años.

            [[SECTION:Examen físico]]
            TA: 110/75 mmHg
            Paciente en regulares condiciones generales.
        """.trimIndent()

        val sections = parseDocumentSections(normalizeSectionMarkdown(raw))
        val examen = sections.first { it.title.equals("Examen físico", ignoreCase = true) }

        assertEquals("Examen físico", examen.title)
        assertFalse(examen.body.contains("[[SECTION:"))
        assertFalse(examen.body.trimStart().startsWith("Examen", ignoreCase = true))
    }

    @Test
    fun legacyMarkdown_seConvierteSinAsteriscos() {
        val legacy = """
            Intro del paciente.

            **Examen físico:**
            Paciente eupneico.
        """.trimIndent()

        val normalized = normalizeSectionMarkdown(legacy)
        assertFalse(normalized.contains("**"))
        val sections = parseDocumentSections(normalized)
        assertEquals("Examen físico", sections.last().title)
        assertEquals("Paciente eupneico.", sections.last().body)
    }

    @Test
    fun textoPlano_examenFisico_sePromueveASeccion() {
        val raw = """
            Se trata de paciente masculino.

            examen fisico: Paciente en regulares condiciones.
        """.trimIndent()

        val sections = parseDocumentSections(normalizeSectionMarkdown(raw))
        assertTrue(sections.any { it.title == "Examen físico" })
        assertTrue(sections.any { it.body.contains("regulares condiciones") })
    }

    @Test
    fun roundTrip_tituloYContenido_seConservan() {
        val original = listOf(
            DocumentSection(title = "", body = "Párrafo inicial."),
            DocumentSection(title = "Examen físico", body = "TA: --- mmHg"),
            DocumentSection(title = "Diagnóstico", body = "1. Traumatismo."),
        )
        val serialized = serializeDocumentSections(original)
        val parsed = parseDocumentSections(serialized)

        assertEquals(3, parsed.size)
        assertEquals("", parsed[0].title)
        assertEquals("Párrafo inicial.", parsed[0].body)
        assertEquals("Examen físico", parsed[1].title)
        assertEquals("TA: --- mmHg", parsed[1].body)
        assertEquals("Diagnóstico", parsed[2].title)
    }

    @Test
    fun tituloConAsteriscos_seLimpianAlSerializar() {
        val sections = listOf(
            DocumentSection(title = "**Examen fisico", body = "Contenido limpio."),
        )
        val serialized = serializeDocumentSections(sections)
        assertFalse(serialized.contains("**"))
        assertTrue(serialized.contains("[[SECTION:Examen fisico]]"))
    }
}
