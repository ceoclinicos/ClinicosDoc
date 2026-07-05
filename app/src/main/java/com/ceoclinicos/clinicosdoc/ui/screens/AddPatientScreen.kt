package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Cake
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
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
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.BirthDateSelector
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.components.keyboardCapitalizationWords
import com.ceoclinicos.clinicosdoc.ui.components.keyboardDigits
import com.ceoclinicos.clinicosdoc.ui.components.keyboardPhone
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.PatientUtils
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter
import com.ceoclinicos.clinicosdoc.util.PatientFirestoreId

@Composable
fun AddPatientScreen(onSaved: (Patient) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var nombre by remember { mutableStateOf("") }
    var cedula by remember { mutableStateOf("") }
    var edad by remember { mutableStateOf("") }
    var whatsapp by remember { mutableStateOf("") }
    var sexo by remember { mutableStateOf<String?>(null) }
    val sexos = listOf("Masculino", "Femenino", "Otro")
    var fechaNacimiento by remember { mutableStateOf<Instant?>(null) }
    var saving by remember { mutableStateOf(false) }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("dd/MM/yyyy") }

    fun validationError(): String? = when {
        nombre.isBlank() -> "Ingresa el nombre completo"
        cedula.isBlank() -> "Ingresa la cédula"
        fechaNacimiento == null -> "Selecciona la fecha de nacimiento"
        edad.isBlank() -> "Ingresa la edad"
        edad.toIntOrNull() == null -> "La edad debe ser un número válido"
        sexo == null -> "Selecciona el sexo"
        whatsapp.isBlank() -> "Ingresa el número de WhatsApp"
        whatsapp.length < 10 -> "El WhatsApp debe tener al menos 10 dígitos"
        else -> null
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
            Text("Todos los campos son obligatorios", style = MaterialTheme.typography.bodyMedium)
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
            PremiumTextField(
                label = "Cédula *",
                value = cedula,
                onValueChange = { cedula = it },
                hint = "Ej. V-12345678",
                prefixIcon = Icons.Outlined.Badge,
                isError = cedula.isBlank(),
                errorMessage = if (cedula.isBlank()) "Requerido" else null,
            )
            Spacer(modifier = Modifier.height(16.dp))
            PremiumTextField(
                label = "Edad *",
                value = edad,
                onValueChange = { edad = it.filter { c -> c.isDigit() } },
                hint = "Se calcula con la fecha de nacimiento",
                prefixIcon = Icons.Outlined.Cake,
                keyboardOptions = keyboardDigits(),
                isError = edad.isBlank(),
                errorMessage = if (edad.isBlank()) "Requerido" else null,
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
                    "Seleccionado: ${dateFormatter.format(PatientUtils.toLocalDate(birth))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("Sexo *", style = MaterialTheme.typography.labelLarge.copy(color = TextSecondary))
            if (sexo == null) {
                Text(
                    "Requerido",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            SexoSelector(sexos = sexos, sexo = sexo, onSexoChange = { sexo = it })
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
                        PatientStorage.add(context, patient)
                        saving = false
                        onSaved(patient)
                    }
                },
            )
        }
    }
}

@Composable
private fun SexoSelector(
    sexos: List<String>,
    sexo: String?,
    onSexoChange: (String) -> Unit,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(sexos) { option ->
            FilterChip(
                selected = sexo == option,
                onClick = { onSexoChange(option) },
                label = { Text(option) },
            )
        }
    }
}
