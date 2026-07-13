package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun ActiveSectionsEditor(
    documentType: DocumentType,
    layoutOrder: List<String>,
    activeSections: List<String>,
    onStateChange: (layoutOrder: List<String>, activeSections: List<String>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val lockedSection = SectionCatalog.DATOS_PACIENTE
    val hasLocked = SectionCatalog.requiresLockedPatientSection(documentType)
    val activeSet = activeSections.toSet()

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

    layoutOrder.forEachIndexed { index, section ->
        val isLocked = hasLocked && section == lockedSection
        val isChecked = isLocked || section in activeSet
        val canMoveUp = index > 0 && !isLocked &&
            !(hasLocked && index == 1 && layoutOrder.first() == lockedSection)
        val canMoveDown = index < layoutOrder.lastIndex && !isLocked &&
            !(hasLocked && layoutOrder.getOrNull(index + 1) == lockedSection)

        Card(
            modifier = modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        ) {
            ListItem(
                headlineContent = {
                    Text(
                        section,
                        color = if (isChecked) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            TextSecondary
                        },
                    )
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
                            IconButton(
                                onClick = { moveItem(index, index - 1) },
                                enabled = canMoveUp,
                            ) {
                                Icon(Icons.Default.ArrowUpward, contentDescription = "Subir")
                            }
                            IconButton(
                                onClick = { moveItem(index, index + 1) },
                                enabled = canMoveDown,
                            ) {
                                Icon(Icons.Default.ArrowDownward, contentDescription = "Bajar")
                            }
                        }
                    }
                },
            )
        }
    }
}
