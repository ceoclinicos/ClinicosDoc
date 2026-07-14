package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.ViewHeadline
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.SettingsTile

@Composable
fun PlantillasHubScreen(
    onOpenDocumentTemplates: () -> Unit,
    onOpenHeaders: () -> Unit,
    onOpenPhysicalExamCatalog: () -> Unit,
    onBack: () -> Unit = {},
) {
    val context = LocalContext.current
    AppScaffold(title = "Plantillas", onBack = onBack) { padding ->
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        SettingsTile(
            icon = Icons.Outlined.FactCheck,
            title = "Catálogo examen físico",
            subtitle = "Sistemas y texto base para la IA",
            onClick = onOpenPhysicalExamCatalog,
        )
        Spacer(modifier = Modifier.height(12.dp))
        SettingsTile(
            icon = Icons.Outlined.ViewHeadline,
            title = "Encabezados",
            subtitle = "Hasta 4: logo, clínica o médico",
            onClick = onOpenHeaders,
        )
        Spacer(modifier = Modifier.height(12.dp))
        SettingsTile(
            icon = Icons.Outlined.Description,
            title = "Informes y historias",
            subtitle = "Una plantilla por tipo (personalizar)",
            onClick = onOpenDocumentTemplates,
        )
        Spacer(modifier = Modifier.height(12.dp))
        SettingsTile(
            icon = Icons.Outlined.MedicalServices,
            title = "Recetas",
            subtitle = "Próximamente: moldes de receta médica",
            onClick = {
                Toast.makeText(context, "Recetas: próximamente", Toast.LENGTH_SHORT).show()
            },
        )
    }
    }
}
