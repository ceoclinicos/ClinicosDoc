package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import com.ceoclinicos.clinicosdoc.util.normalizeSectionMarkdown
import com.ceoclinicos.clinicosdoc.util.normalizeSectionTitle
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections

@Composable
fun FormattedDocumentText(
    content: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
) {
    val normalized = remember(content) { normalizeSectionMarkdown(content) }
    val sections = remember(normalized) { parseDocumentSections(normalized) }
    val textStyle = remember(style) {
        val base = when {
            style.lineHeight.isSpecified -> style.lineHeight
            style.fontSize.isSpecified -> style.fontSize
            else -> 16.sp
        }
        style.copy(lineHeight = base * 1.5f)
    }

    Column(modifier = modifier) {
        sections.forEachIndexed { index, section ->
            if (index > 0) Spacer(modifier = Modifier.height(12.dp))
            val title = normalizeSectionTitle(section.title)
            if (title.isNotBlank()) {
                Text(
                    text = "$title:",
                    style = textStyle.copy(fontWeight = FontWeight.Bold),
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
            if (section.body.isNotBlank()) {
                Text(
                    text = section.body,
                    style = textStyle,
                )
            }
        }
    }
}

fun parseBoldMarkdown(text: String): AnnotatedString = buildAnnotatedString {
    val pattern = Regex("""\*\*(.+?)\*\*""", RegexOption.DOT_MATCHES_ALL)
    var cursor = 0
    pattern.findAll(text).forEach { match ->
        append(text.substring(cursor, match.range.first))
        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
            append(match.groupValues[1].trim().trimEnd(':'))
        }
        cursor = match.range.last + 1
    }
    append(text.substring(cursor))
}

fun stripMarkdownForPdf(text: String): String =
    normalizeSectionMarkdown(text)
        .let { parseDocumentSections(it) }
        .joinToString("\n\n") { section ->
            val title = normalizeSectionTitle(section.title)
            when {
                title.isBlank() -> section.body.trim()
                section.body.isBlank() -> "$title:"
                else -> "$title:\n${section.body.trim()}"
            }
        }
