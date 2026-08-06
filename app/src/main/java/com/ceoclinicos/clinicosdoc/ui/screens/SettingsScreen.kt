package com.ceoclinicos.clinicosdoc.ui.screens

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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.OnboardingStorage
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.RedactarTutorialDialog
import com.ceoclinicos.clinicosdoc.ui.components.SettingsTile

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onTemplates: () -> Unit,
    onHeaders: () -> Unit,
    onJoinClinic: () -> Unit,
) {
    val context = LocalContext.current
    var showTutorial by remember { mutableStateOf(false) }

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
                "Unirme con código · moldes institucionales",
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
