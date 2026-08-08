package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.ceoclinicos.clinicosdoc.data.ClinicMembershipStorage
import com.ceoclinicos.clinicosdoc.data.ClinicService
import com.ceoclinicos.clinicosdoc.model.ClinicMembership
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Primer paso al pulsar Redactar: ¿plantillas personales o de una clínica?
 * No bloquea la UI con carga infinita: muestra opciones al instante.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoldOriginSheet(
    onDismiss: () -> Unit,
    onPersonal: () -> Unit,
    onClinic: (ClinicMembership) -> Unit,
) {
    val context = LocalContext.current
    var memberships by remember { mutableStateOf(ClinicMembershipStorage.load(context)) }
    var refreshing by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        memberships = ClinicMembershipStorage.load(context)
        // Refresco rápido; si falla o tarda, igual se ven las opciones locales
        val remote = withTimeoutOrNull(10_000L) {
            runCatching { ClinicService.refreshMemberships(context) }.getOrNull()
        }
        if (!remote.isNullOrEmpty()) {
            memberships = remote
        }
        refreshing = false
    }

    Column(modifier = Modifier.padding(24.dp)) {
        Text("Origen del molde", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "¿Con qué plantillas quieres redactar?",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(modifier = Modifier.height(20.dp))

        Card(
            onClick = onPersonal,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Mis plantillas personales", style = MaterialTheme.typography.titleMedium)
                Text("Consultorio propio", color = TextSecondary)
            }
        }
        Spacer(modifier = Modifier.height(10.dp))

        memberships.forEach { m ->
            Card(
                onClick = { onClinic(m) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(m.clinicName, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Moldes institucionales (femenina, masculina, pediatría…)",
                        color = TextSecondary,
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        if (refreshing && memberships.isEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    modifier = Modifier.size(28.dp),
                    color = Teal,
                    strokeWidth = 2.dp,
                )
            }
            Text(
                "Buscando centros afiliados…",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 8.dp),
            )
        } else if (!refreshing && memberships.isEmpty()) {
            Text(
                "No estás afiliado a ninguna clínica. Usa tus plantillas personales.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
            )
        }
    }
}
