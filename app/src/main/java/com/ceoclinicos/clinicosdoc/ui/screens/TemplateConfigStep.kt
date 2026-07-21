package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.EnfermedadActualStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.ui.components.ActiveSectionsEditor
import com.ceoclinicos.clinicosdoc.ui.components.PhysicalExamSystemsEditor
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun TemplateConfigStep(
    patient: Patient,
    template: DocumentTemplate,
    documentType: DocumentType,
    layoutOrder: List<String>,
    activeSections: List<String>,
    onSectionsStateChange: (layoutOrder: List<String>, activeSections: List<String>) -> Unit,
    sectionDefaultTexts: Map<String, String>,
    onSectionDefaultTextsChange: (Map<String, String>) -> Unit,
    examCatalog: List<PhysicalExamSystem>,
    enabledExamIds: List<String>,
    onEnabledExamIdsChange: (List<String>) -> Unit,
    onExamCatalogChange: (List<PhysicalExamSystem>) -> Unit,
    enfermedadActualEjemplo: String,
    onEnfermedadActualEjemploChange: (String) -> Unit,
    canChangeTemplate: Boolean = false,
    onChangeTemplate: () -> Unit,
    onContinue: () -> Unit,
) {
    val showPhysicalExam = documentType == DocumentType.INFORME ||
        documentType == DocumentType.REPOSO ||
        activeSections.any { it.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true) }
    val showSectionEditor = SectionCatalog.catalogFor(documentType).isNotEmpty()
    val showEnfermedadActual = documentType == DocumentType.HISTORIA_CLINICA ||
        documentType == DocumentType.INFORME ||
        documentType == DocumentType.REPOSO

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
                sectionDefaultTexts = sectionDefaultTexts,
                onStateChange = onSectionsStateChange,
                onSectionDefaultTextsChange = onSectionDefaultTextsChange,
            )
        }

        if (showEnfermedadActual) {
            Spacer(modifier = Modifier.height(24.dp))
            Text("Enfermedad actual", style = MaterialTheme.typography.titleMedium)
            Text(
                "Ejemplo de cómo redactar la enfermedad actual. La IA lo usa como estilo. " +
                    "Puede editarlo a su gusto (natural/procedente, diagnósticos de base, fecha de inicio, etc.).",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
            OutlinedTextField(
                value = enfermedadActualEjemplo,
                onValueChange = onEnfermedadActualEjemploChange,
                modifier = Modifier.fillMaxWidth().height(160.dp),
                placeholder = {
                    Text(EnfermedadActualStorage.DEFAULT_EJEMPLO, maxLines = 6)
                },
                maxLines = 10,
            )
        }

        if (showPhysicalExam) {
            Spacer(modifier = Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))
            Text("Examen físico", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            PhysicalExamSystemsEditor(
                systems = examCatalog,
                enabledIds = enabledExamIds,
                onEnabledIdsChange = onEnabledExamIdsChange,
                onCatalogChanged = onExamCatalogChange,
            )
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
}

/** Inicializa los IDs de examen físico activos desde la plantilla. */
fun initialEnabledExamIds(template: DocumentTemplate): List<String> =
    template.enabledPhysicalExamSystemIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds }
