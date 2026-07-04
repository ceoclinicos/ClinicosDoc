package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Whatsapp
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.AppointmentStorage
import com.ceoclinicos.clinicosdoc.model.Appointment
import com.ceoclinicos.clinicosdoc.ui.theme.Gold
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.util.WhatsAppHelper
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun CalendarioScreen(
    refreshKey: Int,
    onAddAppointment: () -> Unit,
) {
    val context = LocalContext.current
    var appointments by remember { mutableStateOf<List<Appointment>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val formatter = remember {
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault())
    }

    LaunchedEffect(refreshKey) {
        loading = true
        appointments = AppointmentStorage.loadAll(context)
            .filter { it.scheduledAt.isAfter(Instant.now().minusSeconds(3600)) }
        loading = false
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Calendario", style = MaterialTheme.typography.headlineLarge)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Próximas citas y recordatorios WhatsApp", style = MaterialTheme.typography.bodyMedium)
            }
            IconButton(onClick = onAddAppointment) {
                Icon(Icons.Outlined.Add, contentDescription = "Nueva cita")
            }
        }
        Spacer(modifier = Modifier.height(24.dp))

        when {
            loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
            appointments.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = Gold, modifier = Modifier.padding(24.dp))
                    Text("Sin citas programadas", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Programa la próxima cita con tu paciente", style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(20.dp))
                    FilledTonalButton(onClick = onAddAppointment) {
                        Icon(Icons.Outlined.Add, contentDescription = null)
                        Text("Agendar cita")
                    }
                }
            }
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(appointments, key = { it.id }) { appt ->
                    Card {
                        ListItem(
                            headlineContent = { Text(appt.patientNombre) },
                            supportingContent = {
                                Column {
                                    Text(formatter.format(appt.scheduledAt))
                                    if (appt.motivo.isNotBlank()) Text("Traer: ${appt.motivo}")
                                    if (appt.whatsappReminder) {
                                        Text("Recordatorio WhatsApp activo", color = Teal)
                                    }
                                }
                            },
                            trailingContent = {
                                if (appt.patientWhatsapp.isNotBlank()) {
                                    IconButton(onClick = {
                                        WhatsAppHelper.openChat(
                                            context,
                                            appt.patientWhatsapp,
                                            WhatsAppHelper.buildReminderMessage(context, appt),
                                        )
                                    }) {
                                        Icon(Icons.Outlined.Whatsapp, contentDescription = "WhatsApp", tint = Teal)
                                    }
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}
