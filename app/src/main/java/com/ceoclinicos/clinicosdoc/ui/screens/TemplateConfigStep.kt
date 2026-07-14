package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.ui.components.ActiveSectionsEditor
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun TemplateConfigStep(
    patient: Patient,
    template: DocumentTemplate,
    documentType: DocumentType,
    layoutOrder: List<String>,
    activeSections: List<String>,
    onSectionsStateChange: (layoutOrder: List<String>, activeSections: List<String>) -> Unit,
    examCatalog: List<PhysicalExamSystem>,
    enabledExamIds: List<String>,
    onEnabledExamIdsChange: (List<String>) -> Unit,
    examTextOverrides: Map<String, String>,
    onExamTextOverridesChange: (Map<String, String>) -> Unit,
    enfermedadActualEjemplo: String,
    onEnfermedadActualEjemploChange: (String) -> Unit,
    canChangeTemplate: Boolean = false,
    onChangeTemplate: () -> Unit,
    onContinue: () -> Unit,
) {
    var editingSystem by remember { mutableStateOf<PhysicalExamSystem?>(null) }
    var editText by remember { mutableStateOf("") }

    val orderedCatalog = remember(examCatalog, enabledExamIds) {
        PhysicalExamCatalogStorage.displayOrderForConfig(examCatalog, enabledExamIds)
    }

    val showPhysicalExam = documentType == DocumentType.INFORME ||
        activeSections.any { it.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true) }
    val showSectionEditor = SectionCatalog.catalogFor(documentType).isNotEmpty()
    val showEnfermedadActual = documentType == DocumentType.HISTORIA_CLINICA ||
        documentType == DocumentType.INFORME

    Column(
        modifier = Modifier
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(patient.nombre, style = MaterialTheme.typography.labelLarge)
                Text(
                    "C.I. ${patient.cedula} · ${patient.edad} años",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        Text("Plantilla", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            "Configura qué incluir en este ${documentType.label.lowercase()} antes de dictar.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
        )

        Spacer(modifier = Modifier.height(16.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(template.name, style = MaterialTheme.typography.titleMedium)
                if (canChangeTemplate) {
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(onClick = onChangeTemplate) {
                        Text("Cambiar plantilla")
                    }
                }
            }
        }

        if (showSectionEditor) {
            Spacer(modifier = Modifier.height(24.dp))
            Text("Secciones activas (orden)", style = MaterialTheme.typography.titleMedium)
            Text(
                "Marca las secciones a incluir y ordénalas. «Datos del paciente» siempre va primero.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
            ActiveSectionsEditor(
                documentType = documentType,
                layoutOrder = layoutOrder,
                activeSections = activeSections,
                onStateChange = onSectionsStateChange,
            )
        }

        if (showEnfermedadActual) {
            Spacer(modifier = Modifier.height(24.dp))
            Text("Enfermedad actual", style = MaterialTheme.typography.titleMedium)
            Text(
                "Ejemplo de cómo te gusta redactar la narrativa clínica. La IA lo usará como referencia de estilo.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
            OutlinedTextField(
                value = enfermedadActualEjemplo,
                onValueChange = onEnfermedadActualEjemploChange,
                modifier = Modifier.fillMaxWidth().height(140.dp),
                placeholder = { Text("Escribe un ejemplo de enfermedad actual...") },
                maxLines = 8,
            )
        }

        if (showPhysicalExam) {
            Spacer(modifier = Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))
            Text("Examen físico", style = MaterialTheme.typography.titleMedium)
            Text(
                "Activa los sistemas a incluir. Orden: signos vitales → general → piel → cabeza/cuello → cardiopulmonar…",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )

            orderedCatalog.forEach { system ->
                val effectiveText = examTextOverrides[system.id] ?: system.defaultText
                val checked = system.id in enabledExamIds
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = checked,
                        onCheckedChange = { isChecked ->
                            onEnabledExamIdsChange(
                                PhysicalExamDefaults.orderEnabledIds(
                                    if (isChecked) {
                                        enabledExamIds + system.id
                                    } else {
                                        enabledExamIds.filterNot { it == system.id }
                                    },
                                ),
                            )
                        },
                        modifier = Modifier
                            .scale(0.78f)
                            .size(32.dp),
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 2.dp, end = 4.dp),
                    ) {
                        Text(system.name, style = MaterialTheme.typography.labelLarge)
                        Text(
                            effectiveText,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (checked) MaterialTheme.colorScheme.onSurface else TextSecondary,
                            maxLines = 3,
                        )
                    }
                    IconButton(
                        onClick = {
                            editingSystem = system
                            editText = effectiveText
                        },
                        modifier = Modifier.size(36.dp),
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
        }

        Spacer(modifier = Modifier.height(28.dp))
        PremiumPrimaryButton(
            label = "Continuar al dictado",
            onClick = {
                if (showPhysicalExam && enabledExamIds.isEmpty()) return@PremiumPrimaryButton
                onContinue()
            },
            enabled = !showPhysicalExam || enabledExamIds.isNotEmpty(),
        )
    }

    editingSystem?.let { system ->
        AlertDialog(
            onDismissRequest = { editingSystem = null },
            title = { Text("Texto de ${system.name}") },
            text = {
                OutlinedTextField(
                    value = editText,
                    onValueChange = { editText = it },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    maxLines = 6,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onExamTextOverridesChange(examTextOverrides + (system.id to editText.trim()))
                        editingSystem = null
                    },
                ) { Text("Guardar") }
            },
            dismissButton = {
                TextButton(onClick = { editingSystem = null }) { Text("Cancelar") }
            },
        )
    }
}

/** Inicializa los IDs de examen físico activos desde la plantilla. */
fun initialEnabledExamIds(template: DocumentTemplate): List<String> =
    template.enabledPhysicalExamSystemIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds }
