package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ViewList
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.ui.theme.CardWhite
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.NavyLight
import com.ceoclinicos.clinicosdoc.ui.theme.SurfaceBg
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onRedactar: () -> Unit,
    onOpenPlantillas: () -> Unit,
    onOpenDrafts: () -> Unit,
) {
    val context = LocalContext.current
    var doctor by remember { mutableStateOf<DoctorProfile?>(null) }

    LaunchedEffect(Unit) {
        doctor = DoctorStorage.loadProfile(context)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Clínicos Doc",
                style = MaterialTheme.typography.bodyMedium,
                color = Teal,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Outlined.Settings, contentDescription = "Configuración")
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Buenos días, ${doctor?.saludo ?: "Doctor"}",
            style = MaterialTheme.typography.headlineLarge,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Gestiona tus historias clínicas con elegancia",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(modifier = Modifier.height(32.dp))
        RedactarHero(onTap = onRedactar)
        Spacer(modifier = Modifier.height(28.dp))
        Text("Accesos rápidos", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            QuickActionCard(
                icon = Icons.Outlined.ViewList,
                label = "Plantillas",
                color = Navy,
                modifier = Modifier.weight(1f),
                onClick = onOpenPlantillas,
            )
            Spacer(modifier = Modifier.width(12.dp))
            QuickActionCard(
                icon = Icons.Default.EditNote,
                label = "Borradores",
                color = Teal,
                modifier = Modifier.weight(1f),
                onClick = onOpenDrafts,
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        RecentActivityCard()
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun RedactarHero(onTap: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(
                Brush.linearGradient(listOf(Navy, NavyLight, Teal)),
            )
            .clickable(onClick = onTap)
            .padding(24.dp),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.15f))
                    .padding(12.dp),
            ) {
                Icon(Icons.Default.EditNote, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Redactar", style = MaterialTheme.typography.headlineMedium.copy(color = Color.White))
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Historia clínica, informe o reposo con dictado por voz",
                style = MaterialTheme.typography.bodyMedium.copy(color = Color.White.copy(alpha = 0.85f)),
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Redactar", style = MaterialTheme.typography.labelLarge.copy(color = Navy))
                Spacer(modifier = Modifier.width(6.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Navy, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickActionCard(
    icon: ImageVector,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = CardWhite),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.1f))
                    .padding(10.dp),
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun RecentActivityCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardWhite),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row {
                Text("Actividad reciente", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                Icon(Icons.Default.History, contentDescription = null, tint = TextSecondary.copy(alpha = 0.6f), modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceBg)
                        .padding(10.dp),
                ) {
                    Icon(Icons.Outlined.Description, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column {
                    Text("Sin informes aún", style = MaterialTheme.typography.labelLarge)
                    Text("Crea tu primer informe clínico", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
fun AuthLoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Teal)
    }
}
