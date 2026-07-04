package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.SettingsTile

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, onTemplates: () -> Unit, onHeaders: () -> Unit) {
    AppScaffold(title = "Configuración", onBack = onBack) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            SettingsTile(Icons.Outlined.ViewList, "Plantillas de documento", "Elige qué secciones rellenar en cada informe", onTemplates)
            Spacer(modifier = Modifier.height(10.dp))
            SettingsTile(Icons.Outlined.Article, "Encabezados para PDF", "Logo, datos del médico y líneas personalizables", onHeaders)
        }
    }
}
