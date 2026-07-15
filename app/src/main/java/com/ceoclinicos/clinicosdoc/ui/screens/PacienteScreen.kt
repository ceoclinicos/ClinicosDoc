package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.PersonAddAlt1
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.CloudSyncService
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.model.EmergencyFicha
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun PacienteScreen(
    refreshKey: Int,
    onAddPatient: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var patients by remember { mutableStateOf<List<Patient>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var cedulaQuery by remember { mutableStateOf("") }
    var searchMessage by remember { mutableStateOf<String?>(null) }
    var searching by remember { mutableStateOf(false) }
    var fichaPatient by remember { mutableStateOf<Patient?>(null) }
    var ficha by remember { mutableStateOf<EmergencyFicha?>(null) }
    var fichaLoading by remember { mutableStateOf(false) }
    var fichaError by remember { mutableStateOf<String?>(null) }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.systemDefault()) }

    val displayedPatients = remember(patients, cedulaQuery) {
        val queryDigits = CedulaNormalizer.digitsOnly(cedulaQuery)
        when {
            queryDigits.isBlank() -> patients
            else -> {
                val exact = patients.firstOrNull {
                    CedulaNormalizer.digitsOnly(it.cedula) == queryDigits
                }
                exact?.let { listOf(it) }
                    ?: patients.filter { CedulaNormalizer.digitsOnly(it.cedula).contains(queryDigits) }
            }
        }
    }

    LaunchedEffect(refreshKey) {
        loading = true
        patients = PatientStorage.loadAll(context)
        loading = false
    }

    fun openFicha(patient: Patient) {
        fichaPatient = patient
        ficha = null
        fichaError = null
        fichaLoading = true
        scope.launch {
            ficha = try {
                CloudSyncService.findEmergencyFichaByCedula(patient.cedula)
            } catch (_: Exception) {
                null
            }
            fichaLoading = false
            if (ficha == null) {
                fichaError = "Este paciente aún no tiene ficha de emergencia."
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row {
            Text("Pacientes", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.weight(1f))
            IconButton(onClick = onAddPatient) {
                Icon(Icons.Outlined.PersonAddAlt1, contentDescription = "Registrar paciente")
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text("Administra el registro de tus pacientes", style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = cedulaQuery,
                onValueChange = {
                    cedulaQuery = it
                    searchMessage = null
                },
                modifier = Modifier.weight(1f),
                label = { Text("Cédula") },
                placeholder = { Text("Buscar por C.I.") },
                singleLine = true,
            )
            Spacer(modifier = Modifier.padding(horizontal = 4.dp))
            FilledTonalButton(
                enabled = !searching,
                onClick = {
                    val query = CedulaNormalizer.normalize(cedulaQuery)
                    if (query.isBlank()) {
                        searchMessage = null
                        return@FilledTonalButton
                    }
                    scope.launch {
                        searching = true
                        searchMessage = "Buscando…"
                        val local = PatientStorage.findByCedula(context, cedulaQuery)
                        val found = local ?: try {
                            CloudSyncService.findPatientByCedulaAnywhere(cedulaQuery)
                        } catch (_: Exception) {
                            null
                        }
                        searching = false
                        if (found != null) {
                            val saved = PatientStorage.ensureInDoctorList(context, found)
                            patients = PatientStorage.loadAll(context)
                            cedulaQuery = saved.cedula
                            searchMessage = "Encontrado: ${saved.nombre}"
                        } else {
                            searchMessage = "No hay paciente con esa cédula"
                        }
                    }
                },
            ) {
                if (searching) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Teal)
                } else {
                    Icon(Icons.Outlined.Search, contentDescription = null)
                }
                Text("Buscar", modifier = Modifier.padding(start = 4.dp))
            }
        }
        searchMessage?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = Teal, modifier = Modifier.padding(top = 6.dp))
        }
        Text(
            "Toca un paciente para ver su ficha de emergencia",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))

        when {
            loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
            patients.isEmpty() -> EmptyPatients(onAddPatient)
            displayedPatients.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No se encontró paciente con esa cédula", color = TextSecondary)
            }
            else -> {
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                    items(displayedPatients, key = { it.id }) { patient ->
                        Card(
                            colors = CardDefaults.cardColors(),
                            modifier = Modifier.clickable { openFicha(patient) },
                        ) {
                            ListItem(
                                leadingContent = {
                                    Box(
                                        modifier = Modifier.size(40.dp).background(Teal.copy(alpha = 0.1f), CircleShape),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(patient.nombre.firstOrNull()?.uppercaseChar()?.toString() ?: "?", color = Teal)
                                    }
                                },
                                headlineContent = { Text(patient.nombre) },
                                supportingContent = {
                                    Text(
                                        buildString {
                                            append("C.I. ${patient.cedula} · ${patient.edad} años")
                                            if (patient.whatsapp.isNotBlank()) append(" · WA ${patient.whatsapp}")
                                            append(" · Nac. ${dateFormatter.format(patient.fechaNacimiento)}")
                                        },
                                    )
                                },
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(onClick = onAddPatient, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Add, contentDescription = null)
                    Text("Registrar otro paciente")
                }
            }
        }
    }

    fichaPatient?.let { patient ->
        AlertDialog(
            onDismissRequest = { fichaPatient = null },
            title = { Text("Ficha de emergencia") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text(patient.nombre, style = MaterialTheme.typography.titleMedium)
                    Text("C.I. ${patient.cedula}", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    Spacer(modifier = Modifier.height(12.dp))
                    when {
                        fichaLoading -> CircularProgressIndicator(color = Teal, modifier = Modifier.size(28.dp))
                        ficha != null -> {
                            val f = ficha!!
                            Text("Tipo de sangre: ${f.tipoSangre}", style = MaterialTheme.typography.bodyMedium)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Alergias: ${f.alergias.ifBlank { "—" }}")
                            Text("Condiciones: ${f.condiciones.ifBlank { "—" }}")
                            Text("Medicamentos: ${f.medicamentos.ifBlank { "—" }}")
                            if (f.contactos.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Contactos", style = MaterialTheme.typography.labelLarge)
                                f.contactos.forEach { c ->
                                    Text("• ${c.nombre} (${c.parentesco}): ${c.telefono}")
                                }
                            }
                        }
                        else -> Text(fichaError ?: "Sin ficha de emergencia.", color = TextSecondary)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { fichaPatient = null }) { Text("Cerrar") }
            },
        )
    }
}

@Composable
private fun EmptyPatients(onAddPatient: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(96.dp).background(Teal.copy(alpha = 0.08f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.People, contentDescription = null, tint = Teal, modifier = Modifier.size(48.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Sin pacientes registrados", style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Registra pacientes con nombre, cédula, edad y fecha de nacimiento", style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(24.dp))
            FilledTonalButton(onClick = onAddPatient, modifier = Modifier.fillMaxWidth(), colors = androidx.compose.material3.ButtonDefaults.filledTonalButtonColors(containerColor = Navy, contentColor = androidx.compose.ui.graphics.Color.White)) {
                Icon(Icons.Outlined.PersonAddAlt1, contentDescription = null)
                Text("Registrar paciente")
            }
        }
    }
}
