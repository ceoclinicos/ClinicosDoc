package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentHeaderSelector(
    headers: List<DocumentHeader>,
    selectedHeader: DocumentHeader?,
    onSelectHeader: (DocumentHeader?) -> Unit,
    onCreateNew: () -> Unit,
    onHeaderUpdated: (DocumentHeader) -> Unit,
    onHeadersRefresh: () -> Unit,
    openEditHeaderId: String? = null,
    onOpenEditConsumed: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var editingHeaderId by rememberSaveable { mutableStateOf<String?>(null) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    val chipLabels = remember(headers) {
        val nameCounts = headers.groupingBy { it.name }.eachCount()
        headers.associateWith { header ->
            if (nameCounts.getValue(header.name) > 1) {
                "${header.name} · ${header.displayTitle}"
            } else {
                header.name
            }
        }
    }

    val selectedLabel = remember(selectedHeader, chipLabels) {
        selectedHeader?.let { chipLabels.getValue(it) } ?: "Sin encabezado"
    }

    LaunchedEffect(openEditHeaderId) {
        if (openEditHeaderId != null) {
            editingHeaderId = openEditHeaderId
            onOpenEditConsumed()
        }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, DividerColor),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("1. Encabezado", style = MaterialTheme.typography.titleLarge)
            Text(
                "Despliega la lista y elige el encabezado para este informe.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
            )

            Text(
                if (headers.isEmpty()) {
                    "0 encabezados guardados"
                } else {
                    "${headers.size} encabezado${if (headers.size == 1) "" else "s"} disponible${if (headers.size == 1) "" else "s"}"
                },
                style = MaterialTheme.typography.labelLarge,
                color = if (headers.isEmpty()) TextSecondary else Teal,
                modifier = Modifier.padding(bottom = 8.dp),
            )

            ExposedDropdownMenuBox(
                expanded = dropdownExpanded,
                onExpandedChange = { dropdownExpanded = it },
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = selectedLabel,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Encabezado del informe") },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded)
                    },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = dropdownExpanded,
                    onDismissRequest = { dropdownExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text("Sin encabezado")
                                Text(
                                    "Documento sin membrete institucional",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                )
                            }
                        },
                        onClick = {
                            editingHeaderId = null
                            onSelectHeader(null)
                            dropdownExpanded = false
                        },
                        leadingIcon = {
                            if (selectedHeader == null) {
                                Icon(Icons.Outlined.ArrowDropDown, contentDescription = null, tint = Teal)
                            }
                        },
                    )
                    headers.forEach { header ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(chipLabels.getValue(header))
                                    Text(
                                        buildString {
                                            append(header.displayTitle)
                                            if (header.isDefault) append(" · Predeterminado")
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondary,
                                    )
                                }
                            },
                            onClick = {
                                editingHeaderId = null
                                onSelectHeader(header)
                                dropdownExpanded = false
                            },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(onClick = onCreateNew, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Add, contentDescription = null)
                Text("Crear nuevo encabezado", modifier = Modifier.padding(start = 8.dp))
            }

            selectedHeader?.let { header ->
                Spacer(modifier = Modifier.height(20.dp))
                HorizontalDivider(color = DividerColor)
                Spacer(modifier = Modifier.height(16.dp))

                Text("Vista previa del encabezado", style = MaterialTheme.typography.titleMedium)
                Text(
                    header.name,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 2.dp, bottom = 12.dp),
                )

                HeaderPreview(header = header, compact = false)

                if (editingHeaderId != header.id) {
                    TextButton(
                        onClick = { editingHeaderId = header.id },
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Icon(Icons.Outlined.Edit, contentDescription = null)
                        Text("Editar encabezado", modifier = Modifier.padding(start = 6.dp))
                    }
                } else {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Editar contenido", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(12.dp))
                    HeaderEditForm(
                        headerId = header.id,
                        onSaved = { saved ->
                            onHeaderUpdated(saved)
                            onHeadersRefresh()
                            editingHeaderId = null
                        },
                        onCancel = { editingHeaderId = null },
                    )
                }
            }
        }
    }
}
