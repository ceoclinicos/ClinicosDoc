package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.model.SectionDefaults
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun ActiveSectionsEditor(
    documentType: DocumentType,
    layoutOrder: List<String>,
    activeSections: List<String>,
    sectionDefaultTexts: Map<String, String>,
    onStateChange: (layoutOrder: List<String>, activeSections: List<String>) -> Unit,
    onSectionDefaultTextsChange: (Map<String, String>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val lockedSection = SectionCatalog.DATOS_PACIENTE
    val hasLocked = SectionCatalog.requiresLockedPatientSection(documentType)
    val activeSet = activeSections.toSet()
    var editingSection by remember { mutableStateOf<String?>(null) }
    var editText by remember { mutableStateOf("") }
    var showAdd by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newText by remember { mutableStateOf("") }

    fun emit(layout: List<String>, active: Set<String>) {
        val normalized = SectionCatalog.normalizeActive(
            documentType,
            SectionCatalog.activeFromLayout(layout, active.toList()),
        )
        onStateChange(layout, normalized)
    }

    fun moveItem(fromIndex: Int, toIndex: Int) {
        if (fromIndex == toIndex || fromIndex !in layoutOrder.indices || toIndex !in layoutOrder.indices) return
        if (hasLocked && (layoutOrder[fromIndex] == lockedSection || layoutOrder[toIndex] == lockedSection)) return
        val updated = layoutOrder.toMutableList()
        updated.add(toIndex, updated.removeAt(fromIndex))
        emit(updated, activeSet)
    }

    Column(modifier = modifier.fillMaxWidth()) {
        layoutOrder.forEachIndexed { index, section ->
            val isLocked = hasLocked && section == lockedSection
            val isExam = section.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true)
            val isChecked = isLocked || section in activeSet
            val canMoveUp = index > 0 && !isLocked &&
                !(hasLocked && index == 1 && layoutOrder.first() == lockedSection)
            val canMoveDown = index < layoutOrder.lastIndex && !isLocked &&
                !(hasLocked && layoutOrder.getOrNull(index + 1) == lockedSection)
            val preview = sectionDefaultTexts[section]
                ?: SectionDefaults.textFor(section)
            val canEditText = !isLocked && !isExam

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            ) {
                ListItem(
                    headlineContent = {
                        Column {
                            Text(
                                section,
                                color = if (isChecked) {
                                    MaterialTheme.colorScheme.onSurface
                                } else {
                                    TextSecondary
                                },
                            )
                            if (canEditText && isChecked) {
                                Text(
                                    preview,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                    maxLines = 2,
                                )
                            }
                        }
                    },
                    leadingContent = {
                        Checkbox(
                            checked = isChecked,
                            onCheckedChange = { checked ->
                                if (isLocked) return@Checkbox
                                val newActive = if (checked) activeSet + section else activeSet - section
                                emit(layoutOrder, newActive)
                            },
                            enabled = !isLocked,
                            modifier = Modifier
                                .scale(0.82f)
                                .size(32.dp),
                        )
                    },
                    trailingContent = {
                        if (!isLocked) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (canEditText) {
                                    IconButton(
                                        onClick = {
                                            editingSection = section
                                            editText = sectionDefaultTexts[section]
                                                ?: SectionDefaults.textFor(section)
                                        },
                                        modifier = Modifier.size(32.dp),
                                    ) {
                                        Icon(
                                            Icons.Outlined.Edit,
                                            contentDescription = "Editar texto ejemplo",
                                            modifier = Modifier.size(18.dp),
                                        )
                                    }
                                }
                                IconButton(
                                    onClick = { moveItem(index, index - 1) },
                                    enabled = canMoveUp,
                                    modifier = Modifier.size(32.dp),
                                ) {
                                    Icon(Icons.Default.ArrowUpward, contentDescription = "Subir")
                                }
                                IconButton(
                                    onClick = { moveItem(index, index + 1) },
                                    enabled = canMoveDown,
                                    modifier = Modifier.size(32.dp),
                                ) {
                                    Icon(Icons.Default.ArrowDownward, contentDescription = "Bajar")
                                }
                            }
                        }
                    },
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = {
                showAdd = true
                newName = ""
                newText = "Sin datos adicionales referidos."
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Outlined.Add, contentDescription = null)
            Spacer(modifier = Modifier.size(8.dp))
            Text("+ Nueva sección")
        }
    }

    editingSection?.let { section ->
        AlertDialog(
            onDismissRequest = { editingSection = null },
            title = { Text("Texto ejemplo — $section") },
            text = {
                Column {
                    Text(
                        "La IA usa este texto si el dictado no aporta datos para esta sección.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = editText,
                        onValueChange = { editText = it },
                        modifier = Modifier.fillMaxWidth().height(160.dp),
                        maxLines = 10,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val trimmed = editText.trim()
                        val next = sectionDefaultTexts.toMutableMap()
                        if (trimmed.isEmpty()) next.remove(section) else next[section] = trimmed
                        onSectionDefaultTextsChange(next)
                        editingSection = null
                    },
                ) { Text("Guardar") }
            },
            dismissButton = {
                TextButton(onClick = { editingSection = null }) { Text("Cancelar") }
            },
        )
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("Nueva sección") },
            text = {
                Column {
                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text("Título") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = newText,
                        onValueChange = { newText = it },
                        label = { Text("Texto ejemplo / predeterminado") },
                        modifier = Modifier.fillMaxWidth().height(120.dp),
                        maxLines = 8,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val title = newName.trim()
                        if (title.isEmpty() || title.equals(lockedSection, ignoreCase = true)) return@TextButton
                        if (layoutOrder.any { it.equals(title, ignoreCase = true) }) return@TextButton
                        val layout = layoutOrder + title
                        emit(layout, activeSet + title)
                        val text = newText.trim().ifBlank { "Sin datos adicionales referidos." }
                        onSectionDefaultTextsChange(sectionDefaultTexts + (title to text))
                        showAdd = false
                    },
                ) { Text("Agregar") }
            },
            dismissButton = {
                TextButton(onClick = { showAdd = false }) { Text("Cancelar") }
            },
        )
    }
}
