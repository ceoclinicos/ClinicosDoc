package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.ceoclinicos.clinicosdoc.ui.components.BottomNavItem
import com.ceoclinicos.clinicosdoc.ui.components.PremiumBottomBar
import com.ceoclinicos.clinicosdoc.ui.theme.SurfaceBg

@Composable
fun MainShell(
    onOpenSettings: () -> Unit,
    onRedactar: () -> Unit,
    onAddPatient: () -> Unit,
    onOpenPlantillas: () -> Unit,
    onOpenDrafts: () -> Unit,
    patientRefreshKey: Int,
    informeRefreshKey: Int,
    onPatientTabSelected: () -> Unit,
    onInformeTabSelected: () -> Unit,
    onOpenInformeTab: () -> Unit,
    onOpenInforme: (String) -> Unit,
) {
    var currentIndex by rememberSaveable { mutableIntStateOf(0) }
    val items = listOf(
        BottomNavItem("Home", Icons.Outlined.Home, Icons.Default.Home),
        BottomNavItem("Paciente", Icons.Outlined.Person, Icons.Default.Person),
        BottomNavItem("Informe", Icons.Outlined.Description, Icons.Default.Description),
    )

    Scaffold(
        modifier = Modifier.background(SurfaceBg),
        contentWindowInsets = WindowInsets.safeDrawing.only(
            WindowInsetsSides.Top + WindowInsetsSides.Horizontal,
        ),
        bottomBar = {
            PremiumBottomBar(
                modifier = Modifier.navigationBarsPadding(),
                currentIndex = currentIndex,
                onTap = { index ->
                    currentIndex = index
                    if (index == 1) onPatientTabSelected()
                    if (index == 2) onInformeTabSelected()
                },
                items = items,
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (currentIndex) {
                0 -> HomeScreen(
                    onOpenSettings = onOpenSettings,
                    onRedactar = onRedactar,
                    onAddPatient = onAddPatient,
                    onOpenInformes = {
                        currentIndex = 2
                        onOpenInformeTab()
                    },
                    onOpenPlantillas = onOpenPlantillas,
                    onOpenDrafts = onOpenDrafts,
                )
                1 -> PacienteScreen(refreshKey = patientRefreshKey, onAddPatient = onAddPatient)
                else -> InformeScreen(refreshKey = informeRefreshKey, onOpenInforme = onOpenInforme)
            }
        }
    }
}
