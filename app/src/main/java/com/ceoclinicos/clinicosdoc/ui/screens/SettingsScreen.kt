package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
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
import com.ceoclinicos.clinicosdoc.data.OnboardingStorage
import com.ceoclinicos.clinicosdoc.service.EntitlementStatus
import com.ceoclinicos.clinicosdoc.service.SubscriptionService
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.RedactarTutorialDialog
import com.ceoclinicos.clinicosdoc.ui.components.SettingsTile
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onTemplates: () -> Unit,
    onHeaders: () -> Unit,
    onJoinClinic: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showTutorial by remember { mutableStateOf(false) }
    var plan by remember { mutableStateOf<EntitlementStatus?>(null) }
    var planLoading by remember { mutableStateOf(true) }
    var activating by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        planLoading = true
        plan = SubscriptionService.fetchStatus().getOrNull()
        planLoading = false
    }

    if (showTutorial) {
        RedactarTutorialDialog(
            onDismiss = {
                OnboardingStorage.markRedactarTutorialSeen(context)
                showTutorial = false
            },
        )
    }

    AppScaffold(title = "Configuración", onBack = onBack) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Plan y prueba IA", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        when {
                            planLoading -> "Cargando…"
                            plan == null -> "No se pudo cargar el plan"
                            plan!!.message.isNotBlank() -> plan!!.message
                            plan!!.plan == "trial" ->
                                "Prueba: ${plan!!.trialDaysLeft} día(s) o ${plan!!.trialUsesLeft} consulta(s) IA"
                            plan!!.plan == "subscribed" || plan!!.plan == "courtesy" ->
                                "Activo: ${plan!!.periodRemaining} procesamientos restantes"
                            else -> "Suscríbase para usar la IA"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                    )
                    val showSubscribe = plan != null &&
                        plan!!.plan != "subscribed" &&
                        plan!!.plan != "courtesy" &&
                        (
                            !plan!!.canUseAi ||
                                plan!!.plan == "trial" ||
                                plan!!.plan == "expired" ||
                                plan!!.plan == "blocked_trial"
                            )
                    if (showSubscribe) {
                        Spacer(modifier = Modifier.height(12.dp))
                        PremiumPrimaryButton(
                            label = "Suscribirse (30 días)",
                            icon = Icons.Outlined.WorkspacePremium,
                            modifier = Modifier.fillMaxWidth(),
                            loading = activating,
                            onClick = {
                                scope.launch {
                                    activating = true
                                    val result = SubscriptionService.activateSubscription()
                                    activating = false
                                    result.onSuccess {
                                        plan = it
                                        Toast.makeText(context, "Suscripción activada", Toast.LENGTH_SHORT).show()
                                    }.onFailure {
                                        Toast.makeText(
                                            context,
                                            it.message ?: "No se pudo suscribir",
                                            Toast.LENGTH_LONG,
                                        ).show()
                                    }
                                }
                            },
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            SettingsTile(
                Icons.Outlined.School,
                "Tutorial de redacción",
                "Cómo redactar, elegir paciente y plantilla",
                onClick = { showTutorial = true },
            )
            Spacer(modifier = Modifier.height(10.dp))
            SettingsTile(
                Icons.Outlined.LocalHospital,
                "Centros de salud",
                "Invitaciones pendientes · moldes institucionales",
                onClick = onJoinClinic,
            )
            Spacer(modifier = Modifier.height(10.dp))
            SettingsTile(
                Icons.Outlined.ViewList,
                "Plantillas de documento",
                "Elige qué secciones rellenar en cada informe",
                onClick = onTemplates,
            )
            Spacer(modifier = Modifier.height(10.dp))
            SettingsTile(
                Icons.Outlined.Article,
                "Encabezados para PDF",
                "Logo, datos del médico y líneas personalizables",
                onClick = onHeaders,
            )
        }
    }
}
