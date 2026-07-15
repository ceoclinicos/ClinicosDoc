package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

/**
 * Lista de sistemas de examen físico: check, lápiz, subir/bajar y crear nuevo.
 */
@Composable
fun PhysicalExamSystemsEditor(
    systems: List<PhysicalExamSystem>,
    enabledIds: List<String>,
    onEnabledIdsChange: (List<String>) -> Unit,
    onCatalogChanged: (List<PhysicalExamSystem>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var editing by remember { mutableStateOf<PhysicalExamSystem?>(null) }
    var editName by remember { mutableStateOf("") }
    var editText by remember { mutableStateOf("") }
    var isNew by remember { mutableStateOf(false) }

    val ordered = remember(systems) {
        PhysicalExamCatalogStorage.reportDisplayOrder(systems)
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            "Activa, ordena y edita los sistemas. El lápiz cambia el texto base para la IA.",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        ordered.forEachIndexed { index, system ->
            val checked = system.id in enabledIds
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = { isChecked ->
                        val next = if (isChecked) {
                            enabledIds + system.id
                        } else {
                            enabledIds.filterNot { it == system.id }
                        }
                        onEnabledIdsChange(
                            PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(next, ordered),
                        )
                    },
                    modifier = Modifier
                        .scale(0.546f) // ~30% más pequeño que 0.78
                        .size(28.dp),
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 2.dp, end = 2.dp),
                ) {
                    Text(system.name, style = MaterialTheme.typography.labelLarge)
                    Text(
                        system.defaultText.ifBlank { "(sin texto base)" },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (checked) MaterialTheme.colorScheme.onSurface else TextSecondary,
                        maxLines = 2,
                    )
                }
                IconButton(
                    onClick = {
                        PhysicalExamCatalogStorage.moveSystem(context, system.id, -1)?.let {
                            onCatalogChanged(it)
                            onEnabledIdsChange(
                                PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(enabledIds, it),
                            )
                        }
                    },
                    enabled = index > 0,
                    modifier = Modifier.size(28.dp),
                ) {
                    Icon(Icons.Outlined.KeyboardArrowUp, contentDescription = "Subir", modifier = Modifier.size(18.dp))
                }
                IconButton(
                    onClick = {
                        PhysicalExamCatalogStorage.moveSystem(context, system.id, +1)?.let {
                            onCatalogChanged(it)
                            onEnabledIdsChange(
                                PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(enabledIds, it),
                            )
                        }
                    },
                    enabled = index < ordered.lastIndex,
                    modifier = Modifier.size(28.dp),
                ) {
                    Icon(Icons.Outlined.KeyboardArrowDown, contentDescription = "Bajar", modifier = Modifier.size(18.dp))
                }
                IconButton(
                    onClick = {
                        isNew = false
                        editing = system
                        editName = system.name
                        editText = system.defaultText
                    },
                    modifier = Modifier.size(32.dp),
                ) {
                    Icon(
                        Icons.Outlined.Edit,
                        contentDescription = "Editar texto",
                        modifier = Modifier.size(18.dp),
                        tint = Teal,
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = {
                isNew = true
                editing = PhysicalExamCatalogStorage.createNew("", "")
                editName = ""
                editText = ""
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("Nuevo sistema")
        }
    }

    editing?.let { system ->
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text(if (isNew) "Nuevo sistema" else "Editar ${system.name}") },
            text = {
                Column {
                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text("Nombre") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = editText,
                        onValueChange = { editText = it },
                        label = { Text("Texto base (ejemplo)") },
                        modifier = Modifier.fillMaxWidth().height(140.dp),
                        maxLines = 8,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = editName.trim()
                        if (name.isBlank()) return@TextButton
                        val saved = if (isNew) {
                            PhysicalExamCatalogStorage.upsert(
                                context,
                                system.copy(
                                    name = name,
                                    defaultText = editText.trim(),
                                    sortOrder = (ordered.maxOfOrNull { it.sortOrder } ?: 0) + 1,
                                ),
                            )
                        } else {
                            PhysicalExamCatalogStorage.upsert(
                                context,
                                system.copy(name = name, defaultText = editText.trim()),
                            )
                        }
                        val refreshed = PhysicalExamCatalogStorage.loadAll(context)
                        onCatalogChanged(refreshed)
                        if (isNew) {
                            onEnabledIdsChange(
                                PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(
                                    enabledIds + saved.id,
                                    refreshed,
                                ),
                            )
                        }
                        editing = null
                    },
                ) { Text("Guardar") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text("Cancelar") }
            },
        )
    }
}
