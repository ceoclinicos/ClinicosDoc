package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.CloudSyncService
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.BirthDateSelector
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.components.keyboardCapitalizationWords
import com.ceoclinicos.clinicosdoc.ui.components.keyboardPhone
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.ceoclinicos.clinicosdoc.util.PatientFirestoreId
import com.ceoclinicos.clinicosdoc.util.PatientUtils
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

private enum class AddPatientStep { CEDULA, FORMULARIO }

@Composable
fun AddPatientScreen(onSaved: (Patient) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(AddPatientStep.CEDULA) }
    var nombre by remember { mutableStateOf("") }
    var cedula by remember { mutableStateOf("") }
    var edad by remember { mutableStateOf("") }
    var whatsapp by remember { mutableStateOf("") }
    var sexo by remember { mutableStateOf<String?>(null) }
    val sexos = listOf("Masculino", "Femenino")
    var fechaNacimiento by remember { mutableStateOf<Instant?>(null) }
    var saving by remember { mutableStateOf(false) }
    var searching by remember { mutableStateOf(false) }
    var searchMessage by remember { mutableStateOf<String?>(null) }
    var foundPatients by remember { mutableStateOf<List<Patient>>(emptyList()) }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("dd/MM/yyyy") }

    fun validationError(): String? = when {
        nombre.isBlank() -> "Ingresa el nombre completo"
        cedula.isBlank() -> "Ingresa la cédula"
        fechaNacimiento == null -> "Selecciona la fecha de nacimiento"
        sexo == null -> "Selecciona el sexo"
        whatsapp.isBlank() -> "Ingresa el número de WhatsApp"
        whatsapp.length < 10 -> "El WhatsApp debe tener al menos 10 dígitos"
        else -> null
    }

    fun adoptPatient(patient: Patient) {
        saving = true
        scope.launch {
            val saved = PatientStorage.ensureInDoctorList(context, patient)
            saving = false
            Toast.makeText(context, "Paciente agregado a tu lista", Toast.LENGTH_SHORT).show()
            onSaved(saved)
        }
    }

    fun searchByCedula() {
        if (!CedulaNormalizer.isValid(cedula)) {
            searchMessage = "Ingresa una cédula válida"
            return
        }
        searching = true
        searchMessage = null
        foundPatients = emptyList()
        scope.launch {
            val local = PatientStorage.findByCedula(context, cedula)
            val remote = try {
                CloudSyncService.findGlobalByCedula(cedula)
            } catch (_: Exception) {
                emptyList()
            }
            val merged = buildList {
                local?.let { add(it) }
                addAll(remote)
            }.distinctBy { CedulaNormalizer.normalize(it.cedula) + it.nombre.lowercase() }

            searching = false
            if (merged.isNotEmpty()) {
                foundPatients = merged
                searchMessage = "Paciente encontrado. Puedes usarlo o actualizar datos."
            } else {
                foundPatients = emptyList()
                searchMessage = "No existe. Completa los datos para registrarlo."
                step = AddPatientStep.FORMULARIO
            }
        }
    }

    AppScaffold(title = "Registrar paciente", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        ) {
            Text("Datos del paciente", style = MaterialTheme.typography.headlineMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (step == AddPatientStep.CEDULA) {
                    "Primero busca por cédula en la base de datos"
                } else {
                    "Completa los datos del paciente nuevo"
                },
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(modifier = Modifier.height(24.dp))

            PremiumTextField(
                label = "Cédula *",
                value = cedula,
                onValueChange = {
                    cedula = it
                    searchMessage = null
                    foundPatients = emptyList()
                    if (step == AddPatientStep.FORMULARIO) step = AddPatientStep.CEDULA
                },
                hint = "Ej. V-12345678",
                prefixIcon = Icons.Outlined.Badge,
                isError = cedula.isBlank(),
                errorMessage = if (cedula.isBlank()) "Requerido" else null,
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = { searchByCedula() },
                enabled = !searching && !saving,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (searching) {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(18.dp),
                        color = Teal,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Icon(
                        Icons.Outlined.Search,
                        contentDescription = null,
                        modifier = Modifier.padding(end = 6.dp),
                    )
                }
                Text(if (searching) "Buscando…" else "Buscar en base de datos")
            }
            searchMessage?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (foundPatients.isNotEmpty()) Teal else TextSecondary,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            foundPatients.forEach { patient ->
                Spacer(modifier = Modifier.height(12.dp))
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(patient.nombre, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "C.I. ${patient.cedula} · ${patient.edad} años · ${patient.sexo.ifBlank { "—" }}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        if (patient.whatsapp.isNotBlank()) {
                            Text("WhatsApp: ${patient.whatsapp}", style = MaterialTheme.typography.bodySmall)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        PremiumPrimaryButton(
                            label = "Usar este paciente",
                            icon = Icons.Default.Check,
                            loading = saving,
                            onClick = { adoptPatient(patient) },
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                nombre = patient.nombre
                                edad = patient.edad.toString()
                                fechaNacimiento = patient.fechaNacimiento
                                sexo = patient.sexo.takeIf { it == "Masculino" || it == "Femenino" }
                                whatsapp = patient.whatsapp
                                step = AddPatientStep.FORMULARIO
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("Editar / completar datos")
                        }
                    }
                }
            }

            if (step == AddPatientStep.FORMULARIO) {
                Spacer(modifier = Modifier.height(24.dp))
                PremiumTextField(
                    label = "Nombre completo *",
                    value = nombre,
                    onValueChange = { nombre = it },
                    prefixIcon = Icons.Outlined.Person,
                    keyboardOptions = keyboardCapitalizationWords(),
                    isError = nombre.isBlank(),
                    errorMessage = if (nombre.isBlank()) "Requerido" else null,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text("Fecha de nacimiento *", style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary))
                Spacer(modifier = Modifier.height(8.dp))
                BirthDateSelector(
                    selected = fechaNacimiento,
                    onDateChange = { instant ->
                        fechaNacimiento = instant
                        edad = PatientUtils.calcAge(instant).toString()
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                fechaNacimiento?.let { birth ->
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Seleccionado: ${dateFormatter.format(PatientUtils.toLocalDate(birth))} · ${edad.ifBlank { "—" }} años",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Sexo *", style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary))
                Spacer(modifier = Modifier.height(8.dp))
                SexoDropdown(
                    sexos = sexos,
                    sexo = sexo,
                    onSexoChange = { sexo = it },
                    isError = sexo == null,
                )
                Spacer(modifier = Modifier.height(16.dp))
                PremiumTextField(
                    label = "WhatsApp *",
                    value = whatsapp,
                    onValueChange = { whatsapp = it.filter { c -> c.isDigit() } },
                    hint = "Ej. 04141234567",
                    prefixIcon = Icons.Outlined.PhoneAndroid,
                    keyboardOptions = keyboardPhone(),
                    isError = whatsapp.isBlank() || whatsapp.length < 10,
                    errorMessage = when {
                        whatsapp.isBlank() -> "Requerido"
                        whatsapp.length < 10 -> "Mínimo 10 dígitos"
                        else -> null
                    },
                )
                Spacer(modifier = Modifier.height(32.dp))
                PremiumPrimaryButton(
                    label = "Guardar paciente",
                    icon = Icons.Default.Check,
                    loading = saving,
                    onClick = {
                        val error = validationError()
                        if (error != null) {
                            Toast.makeText(context, error, Toast.LENGTH_SHORT).show()
                            return@PremiumPrimaryButton
                        }
                        saving = true
                        scope.launch {
                            val birth = fechaNacimiento!!
                            val age = edad.toIntOrNull() ?: PatientUtils.calcAge(birth)
                            val patient = Patient(
                                id = PatientFirestoreId.from(cedula.trim(), nombre.trim()),
                                nombre = nombre.trim(),
                                cedula = cedula.trim(),
                                edad = age,
                                fechaNacimiento = birth,
                                createdAt = Instant.now(),
                                whatsapp = whatsapp.trim(),
                                sexo = sexo!!,
                            )
                            val saved = PatientStorage.upsert(context, patient)
                            saving = false
                            onSaved(saved)
                        }
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SexoDropdown(
    sexos: List<String>,
    sexo: String?,
    onSexoChange: (String) -> Unit,
    isError: Boolean,
) {
    var expanded by remember { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth()) {
        if (isError) {
            Text(
                "Requerido",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it },
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = sexo.orEmpty().ifBlank { "Seleccione…" },
                onValueChange = {},
                readOnly = true,
                singleLine = true,
                isError = isError,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Teal,
                    unfocusedBorderColor = DividerColor,
                    focusedTrailingIconColor = Teal,
                ),
            )
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                sexos.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onSexoChange(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
