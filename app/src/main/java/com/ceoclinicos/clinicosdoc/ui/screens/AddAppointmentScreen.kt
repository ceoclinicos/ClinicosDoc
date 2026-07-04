package com.ceoclinicos.clinicosdoc.ui.screens

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import com.ceoclinicos.clinicosdoc.data.AppointmentStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.service.AppointmentReminderScheduler
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.components.keyboardDigits
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddAppointmentScreen(onSaved: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var patients by remember { mutableStateOf<List<Patient>>(emptyList()) }
    var selectedPatient by remember { mutableStateOf<Patient?>(null) }
    var appointmentDate by remember { mutableStateOf<LocalDate?>(null) }
    var hour by remember { mutableStateOf("09") }
    var minute by remember { mutableStateOf("00") }
    var motivo by remember { mutableStateOf("") }
    var whatsappReminder by remember { mutableStateOf(true) }
    var showDatePicker by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("dd/MM/yyyy") }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    LaunchedEffect(Unit) {
        patients = PatientStorage.loadAll(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    AppScaffold(title = "Agendar cita", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        ) {
            Text("Paciente")
            Spacer(modifier = Modifier.height(8.dp))
            if (patients.isEmpty()) {
                Text("Registra un paciente con WhatsApp primero")
            } else {
                patients.forEach { patient ->
                    FilterChip(
                        selected = selectedPatient?.id == patient.id,
                        onClick = { selectedPatient = patient },
                        label = { Text(patient.nombre) },
                        modifier = Modifier.padding(end = 8.dp, bottom = 8.dp),
                    )
                }
            }
            selectedPatient?.let { p ->
                if (p.whatsapp.isBlank()) {
                    Text("Este paciente no tiene WhatsApp. Agrégalo en su ficha.")
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            PremiumTextField(
                label = "Fecha de la cita",
                value = appointmentDate?.format(dateFormatter) ?: "",
                onValueChange = {},
                readOnly = true,
                hint = "Toca para elegir fecha",
                prefixIcon = Icons.Outlined.CalendarToday,
                modifier = Modifier.fillMaxWidth().clickable { showDatePicker = true },
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                PremiumTextField(
                    label = "Hora",
                    value = hour,
                    onValueChange = { hour = it.filter(Char::isDigit).take(2) },
                    modifier = Modifier.weight(1f),
                    prefixIcon = Icons.Outlined.AccessTime,
                    keyboardOptions = keyboardDigits(),
                )
                Spacer(modifier = Modifier.padding(horizontal = 8.dp))
                PremiumTextField(
                    label = "Minutos",
                    value = minute,
                    onValueChange = { minute = it.filter(Char::isDigit).take(2) },
                    modifier = Modifier.weight(1f),
                    keyboardOptions = keyboardDigits(),
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            PremiumTextField(
                label = "Qué debe traer / preparar",
                value = motivo,
                onValueChange = { motivo = it },
                hint = "Ej. estudios, ayuno, recetas anteriores",
                prefixIcon = Icons.Outlined.Notes,
                singleLine = false,
                maxLines = 4,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Recordatorio WhatsApp")
                    Text("El día de la cita recibirás un aviso para enviar el mensaje")
                }
                Switch(checked = whatsappReminder, onCheckedChange = { whatsappReminder = it })
            }
            Spacer(modifier = Modifier.height(24.dp))
            PremiumPrimaryButton(
                label = "Guardar cita",
                icon = Icons.Default.Check,
                loading = saving,
                onClick = {
                    val patient = selectedPatient
                    val date = appointmentDate
                    val h = hour.toIntOrNull()
                    val m = minute.toIntOrNull()
                    when {
                        patient == null -> Toast.makeText(context, "Selecciona un paciente", Toast.LENGTH_SHORT).show()
                        date == null -> Toast.makeText(context, "Selecciona la fecha", Toast.LENGTH_SHORT).show()
                        h == null || m == null || h !in 0..23 || m !in 0..59 ->
                            Toast.makeText(context, "Hora inválida", Toast.LENGTH_SHORT).show()
                        patient.whatsapp.isBlank() && whatsappReminder ->
                            Toast.makeText(context, "Agrega WhatsApp al paciente", Toast.LENGTH_SHORT).show()
                        else -> {
                            saving = true
                            scope.launch {
                                val scheduledAt = date.atTime(h, m)
                                    .atZone(ZoneId.systemDefault()).toInstant()
                                val appointment = Appointment(
                                    id = UUID.randomUUID().toString(),
                                    patientId = patient.id,
                                    patientNombre = patient.nombre,
                                    patientWhatsapp = patient.whatsapp,
                                    scheduledAt = scheduledAt,
                                    motivo = motivo.trim(),
                                    whatsappReminder = whatsappReminder,
                                    createdAt = Instant.now(),
                                )
                                AppointmentStorage.upsert(context, appointment)
                                AppointmentReminderScheduler.schedule(context, appointment)
                                saving = false
                                onSaved()
                            }
                        }
                    }
                },
            )
        }
    }

    if (showDatePicker) {
        val initialMillis = appointmentDate
            ?.atStartOfDay(ZoneOffset.UTC)
            ?.toInstant()
            ?.toEpochMilli()
            ?: System.currentTimeMillis()
        val state = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = state.selectedDateMillis
                    if (millis == null) {
                        Toast.makeText(context, "Selecciona un día en el calendario", Toast.LENGTH_SHORT).show()
                    } else {
                        appointmentDate = Instant.ofEpochMilli(millis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                        showDatePicker = false
                    }
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancelar") } },
        ) { DatePicker(state = state) }
    }
}
