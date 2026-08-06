package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.ClinicMembershipStorage
import com.ceoclinicos.clinicosdoc.data.ClinicService
import com.ceoclinicos.clinicosdoc.model.ClinicMembership
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinClinicScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var memberships by remember { mutableStateOf(ClinicMembershipStorage.load(context)) }

    LaunchedEffect(Unit) {
        runCatching { ClinicService.refreshMemberships(context) }
            .onSuccess { memberships = it }
    }

    AppScaffold(title = "Centros de salud", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                "Unirme a un centro",
                style = MaterialTheme.typography.titleLarge,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Pide el código de invitación al administrador del centro (web → Equipo).",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
            )
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.uppercase() },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Código de invitación") },
                singleLine = true,
                enabled = !loading,
            )
            Spacer(modifier = Modifier.height(12.dp))
            PremiumPrimaryButton(
                if (loading) "Uniendo…" else "Unirme",
                onClick = {
                    if (code.isBlank()) {
                        Toast.makeText(context, "Ingresa el código", Toast.LENGTH_SHORT).show()
                        return@PremiumPrimaryButton
                    }
                    scope.launch {
                        loading = true
                        try {
                            val joined = ClinicService.joinByInvite(context, code)
                            memberships = ClinicMembershipStorage.load(context)
                            code = ""
                            Toast.makeText(
                                context,
                                "Te uniste a ${joined.clinicName}",
                                Toast.LENGTH_SHORT,
                            ).show()
                        } catch (e: Exception) {
                            Toast.makeText(
                                context,
                                e.message ?: "No se pudo unir",
                                Toast.LENGTH_LONG,
                            ).show()
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = !loading,
            )

            Spacer(modifier = Modifier.height(28.dp))
            Text("Mis centros", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            if (memberships.isEmpty()) {
                Text(
                    "Aún no estás vinculado a ningún centro.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                )
            } else {
                memberships.forEach { m: ClinicMembership ->
                    Text(
                        "• ${m.clinicName}",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
        }
    }
}
