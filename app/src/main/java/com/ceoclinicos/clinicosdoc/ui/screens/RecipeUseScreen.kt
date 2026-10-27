package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.data.RecipePresetStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.RecipePreset
import com.ceoclinicos.clinicosdoc.model.RecipePresetContent
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import java.time.Instant
import java.util.UUID

@Composable
fun RecipeUseScreen(
    recipeId: String,
    onBack: () -> Unit,
    onAddPatient: () -> Unit,
    onEmitted: (docId: String) -> Unit,
) {
    val context = LocalContext.current
    var preset by remember { mutableStateOf<RecipePreset?>(null) }
    var selected by remember { mutableStateOf<Patient?>(null) }
    var query by remember { mutableStateOf("") }
    var patients by remember { mutableStateOf(PatientStorage.loadAll(context)) }

    LaunchedEffect(recipeId) {
        preset = RecipePresetStorage.findById(context, recipeId)
        if (preset == null) {
            Toast.makeText(context, "Recipe no encontrada", Toast.LENGTH_SHORT).show()
            onBack()
        }
    }

    LaunchedEffect(Unit) {
        patients = PatientStorage.loadAll(context)
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                patients = PatientStorage.loadAll(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val filtered = remember(patients, query) {
        val q = query.trim()
        if (q.isBlank()) patients.take(20)
        else {
            val qNorm = CedulaNormalizer.normalize(q)
            patients.filter {
                it.nombre.contains(q, ignoreCase = true) ||
                    CedulaNormalizer.normalize(it.cedula).contains(qNorm) ||
                    it.cedula.contains(q, ignoreCase = true)
            }.take(30)
        }
    }

    AppScaffold(
        title = preset?.name ?: "Usar recipe",
        onBack = onBack,
    ) { padding ->
        val p = preset ?: return@AppScaffold
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
        ) {
            Column(
                modifier = Modifier
                    .weight(1f, fill = true)
                    .verticalScroll(rememberScrollState()),
            ) {
                Text("Vista previa", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(6.dp))
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        RecipePresetContent.previewText(p),
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Paciente", style = MaterialTheme.typography.titleMedium)
                selected?.let { s ->
                    Text(
                        "${s.nombre} · C.I. ${s.cedula}",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(vertical = 6.dp),
                    )
                } ?: Text(
                    "Ninguno seleccionado.",
                    color = TextSecondary,
                    modifier = Modifier.padding(vertical = 6.dp),
                )
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Buscar por cédula o nombre") },
                    singleLine = true,
                )
                Spacer(modifier = Modifier.height(8.dp))
                filtered.forEach { patient ->
                    ListItem(
                        headlineContent = { Text(patient.nombre) },
                        supportingContent = { Text("C.I. ${patient.cedula}", color = TextSecondary) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selected = patient },
                    )
                }
                TextButton(onClick = onAddPatient) {
                    Text("+ Agregar paciente")
                }
            }
            PremiumPrimaryButton(
                label = "Emitir receta",
                enabled = selected != null,
                onClick = {
                    val patient = selected ?: return@PremiumPrimaryButton
                    val header = HeaderStorage.defaultHeader(context)
                    val tpl = TemplateStorage.ensureTemplateForType(context, DocumentType.RECETA)
                    val doctor = DoctorStorage.loadProfile(context)
                    val doc = ClinicalDocument(
                        id = UUID.randomUUID().toString(),
                        patientId = patient.id,
                        patientNombre = patient.nombre,
                        patientCedula = patient.cedula,
                        type = DocumentType.RECETA,
                        content = RecipePresetContent.buildContent(p.farmacos),
                        rawDictation = "Recipe predeterminada: ${p.name}",
                        createdAt = Instant.now(),
                        templateId = tpl.id,
                        templateName = p.name,
                        headerId = header?.id,
                        headerSnapshot = header,
                        membrete = PatientMembrete.fromPatient(patient),
                        doctorNombre = doctor?.nombre,
                    )
                    DocumentStorage.add(context, doc)
                    Toast.makeText(context, "Receta emitida", Toast.LENGTH_SHORT).show()
                    onEmitted(doc.id)
                },
            )
        }
    }
}
