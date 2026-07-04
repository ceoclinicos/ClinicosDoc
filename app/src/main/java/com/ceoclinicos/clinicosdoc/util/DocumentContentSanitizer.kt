package com.ceoclinicos.clinicosdoc.util

private val SECTION_START = Regex("""(?m)^\*\*(.+?)\*\*:?\s*$""")
private val PATIENT_LINE = Regex("""(?i)^(nombre|edad|sexo|fecha)\s*:""")
private val PATIENT_SECTION = Regex("""(?i)^datos del paciente$""")
private val DOCUMENT_TITLE_LINE = Regex(
    """(?i)^(\*\*)?\s*(informe\s+m[eé]dico|historia\s+cl[ií]nica|reposo\s+m[eé]dico)\s*(\*\*)?:?\s*$""",
)

fun sanitizeDocumentContent(content: String): String {
    val trimmed = content.trim()
    val withoutPatientSection = removePatientDataSection(trimmed)
    val withoutPatientLines = removeLeadingPatientLines(withoutPatientSection)
    val withoutTitles = removeDuplicateDocumentTitles(withoutPatientLines).trim()
    return normalizeSectionMarkdown(withoutTitles)
}

private val SECTION_MARKER = Regex("""^\[\[SECTION:(.+?)]]\s*$""")

private fun removePatientDataSection(content: String): String {
    if (content.contains("[[SECTION:")) {
        val chunks = content.split(Regex("""(?=\[\[SECTION:[^\]]+]])"""))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        return chunks.filterNot { chunk ->
            val firstLine = chunk.lineSequence().firstOrNull()?.trim().orEmpty()
            val title = SECTION_MARKER.matchEntire(firstLine)?.groupValues?.get(1)?.trim().orEmpty()
            PATIENT_SECTION.matches(title)
        }.joinToString("\n\n")
    }

    val chunks = content.split(Regex("(?=\\*\\*[^*]+\\*\\*)"))
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    if (chunks.isEmpty()) return content

    return chunks.filterNot { chunk ->
        val title = SECTION_START.find(chunk)?.groupValues?.get(1)?.trim().orEmpty()
        PATIENT_SECTION.matches(title)
    }.joinToString("\n\n")
}

private fun removeLeadingPatientLines(content: String): String {
    val lines = content.lines().toMutableList()
    while (lines.isNotEmpty()) {
        val line = lines.first().trim()
        when {
            line.isBlank() -> lines.removeAt(0)
            PATIENT_LINE.containsMatchIn(line) -> lines.removeAt(0)
            line.contains(Regex("""(?i)\*\*datos del paciente\*\*""")) -> lines.removeAt(0)
            DOCUMENT_TITLE_LINE.matches(line) -> lines.removeAt(0)
            else -> break
        }
    }
    return lines.joinToString("\n")
}

private fun removeDuplicateDocumentTitles(content: String): String =
    content.lines()
        .filterNot { line -> DOCUMENT_TITLE_LINE.matches(line.trim()) }
        .joinToString("\n")
        .replace(Regex("\n{3,}"), "\n\n")
