package com.ceoclinicos.clinicosdoc.util

import java.util.UUID

data class DocumentSection(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val body: String,
)

private val SECTION_MARKER_LINE = Regex("""^\[\[SECTION:(.+?)]]\s*$""")
private val SECTION_SPLIT = Regex("""(?=\[\[SECTION:[^\]]+]])""")
private val LEGACY_SECTION_HEADER = Regex("""^\*\*(.+?)\*\*:?\s*""", RegexOption.MULTILINE)
private val LEGACY_SECTION_MULTILINE = Regex("""^\*\*(.+?)\s*\n\s*\*\*:?\s*""", RegexOption.MULTILINE)
private val LEGACY_SPLIT = Regex("""(?=\*\*[^*]+\*\*)""")

private const val EXAMEN_FISICO_LABEL = "Examen físico"
private const val DIAGNOSTICO_LABEL = "Diagnóstico"
private val IS_EXAMEN_FISICO = Regex("""(?i)examen\s+f[ií]sico""")
private val IS_DIAGNOSTICO = Regex("""(?i)diagn[oó]stico""")

fun normalizeSectionTitle(title: String): String =
    title.replace("*", "").replace("[[", "").replace("]]", "").trim().trimEnd(':').trim()

fun sanitizeTitleInput(input: String): String =
    input.replace("*", "").replace("[[", "").replace("]]", "").trimEnd(':')

fun cleanSectionBody(body: String, title: String): String {
    var cleaned = body.trim()
        .replace(Regex("""(?m)^\[\[SECTION:[^\]]+]]\s*$"""), "")
        .trim()

    if (title.isBlank()) {
        return cleaned.lines()
            .filterNot { line ->
                val t = line.trim()
                t in setOf("**", "*") || SECTION_MARKER_LINE.matches(t)
            }
            .joinToString("\n")
            .trim()
    }

    val escaped = Regex.escape(title.trim())
    val duplicatePatterns = listOf(
        Regex("""(?i)^\[\[SECTION:\s*$escaped\s*]]\s*$"""),
        Regex("""(?i)^\*\*\s*$escaped\s*\*\*:?\s*"""),
        Regex("""(?i)^\*\*\s*$escaped\s*:?\s*$"""),
        Regex("""(?i)^\*\*\s*$escaped\s*$"""),
        Regex("""(?i)^$escaped\s*:?\s*"""),
    )
    for (pattern in duplicatePatterns) {
        cleaned = pattern.replaceFirst(cleaned, "").trim()
    }

    when {
        IS_EXAMEN_FISICO.containsMatchIn(title) -> {
            cleaned = Regex("""(?i)^examen\s+f[ií]sico\s*:?\s*""").replaceFirst(cleaned, "").trim()
        }
        IS_DIAGNOSTICO.containsMatchIn(title) -> {
            cleaned = Regex("""(?i)^diagn[oó]stico\s*:?\s*""").replaceFirst(cleaned, "").trim()
        }
    }

    return cleaned.lines()
        .filterNot { line ->
            val t = line.trim()
            t in setOf("**", "*") || SECTION_MARKER_LINE.matches(t)
        }
        .joinToString("\n")
        .trim()
}

private fun promotePlainSectionHeaders(text: String): String {
    var result = text
    result = Regex("""(?im)(?<!\[\[)(?<=(?:\n\n|^))(examen\s+f[ií]sico)\s*:?\s*""")
        .replace(result) { "[[SECTION:$EXAMEN_FISICO_LABEL]]\n" }
    result = Regex("""(?im)(?<!\[\[)(?<=(?:\n\n|^))(diagn[oó]stico)\s*:?\s*""")
        .replace(result) { "[[SECTION:$DIAGNOSTICO_LABEL]]\n" }
    return result
}

private fun convertLegacyMarkdownToMarkers(text: String): String {
    var result = text
    result = Regex("""(?m)\*\*([^*\n]+?):\s*\n\s*\*\*""").replace(result) {
        "[[SECTION:${normalizeSectionTitle(it.groupValues[1])}]]\n"
    }
    result = Regex("""(?m)\*\*([^*\n]+?)\*\*:?\s*""").replace(result) {
        "[[SECTION:${normalizeSectionTitle(it.groupValues[1])}]]\n"
    }
    result = result.lines()
        .filterNot { it.trim() in setOf("**", "*") }
        .joinToString("\n")
    return result
}

private fun trySplitPlainSection(chunk: String): DocumentSection? {
    val trimmed = chunk.trim()
    val lines = trimmed.lines()
    val firstLine = lines.firstOrNull()?.trim().orEmpty()
    if (firstLine.isEmpty() || SECTION_MARKER_LINE.matches(firstLine)) return null

    fun fromFirstLine(pattern: Regex, canonical: String): DocumentSection? {
        val match = pattern.matchEntire(firstLine) ?: return null
        val inlineBody = match.groupValues[2].trim()
        val below = lines.drop(1).joinToString("\n").trim()
        val body = sequenceOf(inlineBody, below).filter { it.isNotEmpty() }.joinToString("\n")
        return DocumentSection(
            title = canonical,
            body = cleanSectionBody(body, canonical),
        )
    }

    return fromFirstLine(
        Regex("""(?i)^(examen\s+f[ií]sico)\s*:?\s*(.*)$"""),
        EXAMEN_FISICO_LABEL,
    ) ?: fromFirstLine(
        Regex("""(?i)^(diagn[oó]stico)\s*:?\s*(.*)$"""),
        DIAGNOSTICO_LABEL,
    )
}

private fun parseWithSectionMarkers(content: String): List<DocumentSection> {
    val chunks = content.split(SECTION_SPLIT)
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    return chunks.map { chunk ->
        val lines = chunk.lines()
        val firstLine = lines.firstOrNull().orEmpty().trim()
        val marker = SECTION_MARKER_LINE.matchEntire(firstLine)
        if (marker != null) {
            val title = normalizeSectionTitle(marker.groupValues[1])
            val body = lines.drop(1).joinToString("\n")
            DocumentSection(title = title, body = cleanSectionBody(body, title))
        } else {
            trySplitPlainSection(chunk)
                ?: DocumentSection(title = "", body = cleanSectionBody(chunk, ""))
        }
    }
}

private fun parseLegacyMarkdown(content: String): List<DocumentSection> {
    val converted = convertLegacyMarkdownToMarkers(content)
    if (converted.contains("[[SECTION:")) {
        return parseWithSectionMarkers(converted)
    }

    val chunks = content.split(LEGACY_SPLIT)
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    if (chunks.isEmpty()) {
        return listOf(
            trySplitPlainSection(content)
                ?: DocumentSection(title = "", body = cleanSectionBody(content, "")),
        )
    }

    return chunks.map { chunk ->
        val multilineMatch = LEGACY_SECTION_MULTILINE.find(chunk)
        val match = multilineMatch ?: LEGACY_SECTION_HEADER.find(chunk)
        if (match != null) {
            val title = normalizeSectionTitle(match.groupValues[1])
            val rawBody = chunk.removePrefix(match.value).trim()
            DocumentSection(title = title, body = cleanSectionBody(rawBody, title))
        } else {
            trySplitPlainSection(chunk)
                ?: DocumentSection(title = "", body = cleanSectionBody(chunk, ""))
        }
    }
}

fun parseDocumentSections(content: String): List<DocumentSection> {
    val trimmed = content.trim()
    if (trimmed.isEmpty()) {
        return listOf(DocumentSection(title = "", body = ""))
    }
    return when {
        trimmed.contains("[[SECTION:") -> parseWithSectionMarkers(trimmed)
        trimmed.contains("**") -> parseLegacyMarkdown(trimmed)
        else -> parseWithSectionMarkers(promotePlainSectionHeaders(trimmed))
    }
}

fun normalizeSectionMarkdown(content: String): String {
    val text = content.replace("\r\n", "\n").trim()
    val promoted = promotePlainSectionHeaders(text)
    val withoutLegacy = if (promoted.contains("**")) convertLegacyMarkdownToMarkers(promoted) else promoted
    val sections = parseDocumentSections(withoutLegacy)
    return if (sections.isEmpty()) withoutLegacy else serializeDocumentSections(sections)
}

fun serializeDocumentSections(sections: List<DocumentSection>): String =
    sections
        .mapNotNull { section ->
            val title = normalizeSectionTitle(section.title)
            val body = cleanSectionBody(section.body, title)
            when {
                title.isEmpty() && body.isEmpty() -> null
                title.isEmpty() -> body
                body.isEmpty() -> "[[SECTION:$title]]"
                else -> "[[SECTION:$title]]\n$body"
            }
        }
        .joinToString("\n\n")
