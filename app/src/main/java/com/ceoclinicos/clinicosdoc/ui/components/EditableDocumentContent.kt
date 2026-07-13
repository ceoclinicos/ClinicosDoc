package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import kotlinx.coroutines.launch
import com.ceoclinicos.clinicosdoc.util.DocumentSection
import com.ceoclinicos.clinicosdoc.util.VitalSignsParser
import com.ceoclinicos.clinicosdoc.util.normalizeSectionMarkdown
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections
import com.ceoclinicos.clinicosdoc.util.sanitizeTitleInput
import com.ceoclinicos.clinicosdoc.util.serializeDocumentSections

@Composable
fun EditableDocumentContent(
    content: String,
    onContentChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    onRegenerateSection: (suspend (index: Int, sections: List<DocumentSection>) -> String?)? = null,
) {
    val scope = rememberCoroutineScope()
    val normalizedInitial = remember(content) { normalizeSectionMarkdown(content) }
    var sections by remember(normalizedInitial) { mutableStateOf(parseDocumentSections(normalizedInitial)) }
    var lastSerialized by remember(normalizedInitial) { mutableStateOf(normalizedInitial) }
    var regeneratingIndex by remember { mutableStateOf<Int?>(null) }
    var regenerateError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(content) {
        val normalized = normalizeSectionMarkdown(content)
        if (normalized != lastSerialized) {
            sections = parseDocumentSections(normalized)
            lastSerialized = normalized
        }
        if (normalized != content) {
            onContentChange(normalized)
        }
    }

    fun updateSections(updated: List<DocumentSection>) {
        sections = updated
        val serialized = serializeDocumentSections(updated)
        lastSerialized = serialized
        onContentChange(serialized)
    }

    fun moveSection(index: Int, direction: Int) {
        val target = index + direction
        if (target !in sections.indices) return
        val updated = sections.toMutableList()
        val item = updated.removeAt(index)
        updated.add(target, item)
        updateSections(updated)
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Text("Contenido del informe", style = MaterialTheme.typography.titleMedium)
        Text(
            if (onRegenerateSection != null) {
                "Edita por secciones. Puedes regenerar una sección con IA sin rehacer todo el documento."
            } else {
                "Edita por secciones. Usa las flechas para cambiar el orden."
            },
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        regenerateError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            Spacer(modifier = Modifier.height(8.dp))
        }

        sections.forEachIndexed { index, section ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Sección ${index + 1}",
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(
                            onClick = { moveSection(index, -1) },
                            enabled = index > 0,
                        ) {
                            Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Subir sección")
                        }
                        IconButton(
                            onClick = { moveSection(index, 1) },
                            enabled = index < sections.lastIndex,
                        ) {
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Bajar sección")
                        }
                        if (sections.size > 1) {
                            IconButton(
                                onClick = {
                                    updateSections(sections.filterIndexed { i, _ -> i != index })
                                },
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Eliminar sección")
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    PremiumTextField(
                        label = "Título de sección (opcional)",
                        value = section.title,
                        onValueChange = { newTitle ->
                            updateSections(
                                sections.mapIndexed { i, s ->
                                    if (i == index) s.copy(title = sanitizeTitleInput(newTitle)) else s
                                },
                            )
                        },
                        hint = "Título sección:",
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    if (VitalSignsParser.isPhysicalExam(section.title)) {
                        val vitals = VitalSignsParser.parseFromBody(section.body)
                        VitalSignsFields(
                            values = vitals,
                            onValuesChange = { updatedVitals ->
                                updateSections(
                                    sections.mapIndexed { i, s ->
                                        if (i == index) {
                                            s.copy(body = VitalSignsParser.applyToBody(s.body, updatedVitals))
                                        } else {
                                            s
                                        }
                                    },
                                )
                            },
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        PremiumTextField(
                            label = "Resto del examen físico",
                            value = VitalSignsParser.bodyWithoutVitals(section.body),
                            onValueChange = { newRest ->
                                val currentVitals = VitalSignsParser.parseFromBody(section.body)
                                val rebuilt = VitalSignsParser.applyToBody(newRest.trim(), currentVitals)
                                updateSections(
                                    sections.mapIndexed { i, s ->
                                        if (i == index) s.copy(body = rebuilt) else s
                                    },
                                )
                            },
                            hint = "General, cardiopulmonar, abdomen…",
                            singleLine = false,
                            maxLines = 12,
                        )
                    } else {
                        PremiumTextField(
                            label = "Contenido",
                            value = section.body,
                            onValueChange = { newBody ->
                                updateSections(
                                    sections.mapIndexed { i, s ->
                                        if (i == index) s.copy(body = newBody) else s
                                    },
                                )
                            },
                            hint = "Contenido:",
                            singleLine = false,
                            maxLines = 12,
                        )
                    }
                    if (onRegenerateSection != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    regeneratingIndex = index
                                    regenerateError = null
                                    try {
                                        val newBody = onRegenerateSection(index, sections)
                                        if (!newBody.isNullOrBlank()) {
                                            updateSections(
                                                sections.mapIndexed { i, s ->
                                                    if (i == index) s.copy(body = newBody) else s
                                                },
                                            )
                                        }
                                    } catch (e: Exception) {
                                        regenerateError = e.message?.removePrefix("Exception: ")
                                            ?: "No se pudo regenerar la sección"
                                    } finally {
                                        regeneratingIndex = null
                                    }
                                }
                            },
                            enabled = regeneratingIndex == null,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (regeneratingIndex == index) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp).padding(end = 8.dp),
                                    color = Teal,
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Icon(
                                    Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    modifier = Modifier.padding(end = 8.dp),
                                )
                            }
                            Text(
                                if (regeneratingIndex == index) "Regenerando…" else "Regenerar esta sección",
                            )
                        }
                    }
                }
            }
        }

        TextButton(
            onClick = { updateSections(sections + DocumentSection(title = "", body = "")) },
            modifier = Modifier.align(Alignment.Start),
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Text("Agregar sección", modifier = Modifier.padding(start = 6.dp))
        }
    }
}
