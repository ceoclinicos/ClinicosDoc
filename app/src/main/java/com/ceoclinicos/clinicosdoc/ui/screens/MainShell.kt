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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.ceoclinicos.clinicosdoc.data.ClinicMembershipStorage
import com.ceoclinicos.clinicosdoc.data.ClinicService
import com.ceoclinicos.clinicosdoc.model.ClinicDoctorInvitation
import com.ceoclinicos.clinicosdoc.ui.components.BottomNavItem
import com.ceoclinicos.clinicosdoc.ui.components.PremiumBottomBar
import com.ceoclinicos.clinicosdoc.ui.theme.SurfaceBg
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun MainShell(
    onOpenSettings: () -> Unit,
    onRedactar: () -> Unit,
    onAddPatient: () -> Unit,
    onEditPatient: (patientId: String) -> Unit,
    onOpenPlantillas: () -> Unit,
    onOpenDrafts: () -> Unit,
    patientRefreshKey: Int,
    informeRefreshKey: Int,
    onPatientTabSelected: () -> Unit,
    onInformeTabSelected: () -> Unit,
    onOpenInforme: (String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    var currentIndex by rememberSaveable { mutableIntStateOf(0) }
    var affiliationNotice by remember { mutableStateOf<String?>(null) }
    var pendingInvite by remember { mutableStateOf<ClinicDoctorInvitation?>(null) }
    var inviteBusy by remember { mutableStateOf(false) }
    var inviteRefreshJob by remember { mutableStateOf<Job?>(null) }
    val items = listOf(
        BottomNavItem("Home", Icons.Outlined.Home, Icons.Default.Home),
        BottomNavItem("Paciente", Icons.Outlined.Person, Icons.Default.Person),
        BottomNavItem("Informe", Icons.Outlined.Description, Icons.Default.Description),
    )

    fun applyPendingUi(invites: List<ClinicDoctorInvitation>? = null) {
        pendingInvite = invites?.firstOrNull()
            ?: ClinicMembershipStorage.loadPendingInvites(context).firstOrNull()
        if (pendingInvite == null) {
            affiliationNotice = ClinicMembershipStorage.loadPendingNotices(context).firstOrNull()
        }
    }

    fun scheduleInviteRefresh() {
        inviteRefreshJob?.cancel()
        inviteRefreshJob = scope.launch {
            applyPendingUi()
            suspend fun loadInvites(): List<ClinicDoctorInvitation> =
                withContext(Dispatchers.IO) {
                    runCatching { ClinicService.syncAffiliationsOnEnter(context, force = true) }
                    runCatching { ClinicService.listPendingInvitations(context) }
                        .getOrElse { ClinicMembershipStorage.loadPendingInvites(context) }
                }
            var invites = loadInvites()
            applyPendingUi(invites)
            if (invites.isEmpty()) {
                delay(2_500)
                invites = loadInvites()
                applyPendingUi(invites)
            }
        }
    }

    LaunchedEffect(Unit) {
        scheduleInviteRefresh()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                scheduleInviteRefresh()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            inviteRefreshJob?.cancel()
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    pendingInvite?.let { inv ->
        AlertDialog(
            onDismissRequest = { /* debe aceptar o rechazar */ },
            title = { Text("Nueva afiliación a un centro") },
            text = {
                Text(
                    "La clínica «${inv.clinicName}» te agregó a su equipo. " +
                        "Si aceptas, formarás parte de ese centro y se descargarán sus plantillas en tu app.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (inviteBusy) return@TextButton
                        inviteBusy = true
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    ClinicService.acceptInvitation(context, inv.clinicId)
                                }
                                val rest = withContext(Dispatchers.IO) {
                                    ClinicService.listPendingInvitations(context)
                                }
                                applyPendingUi(rest)
                            } catch (_: Exception) {
                                // se queda el diálogo; reintentar
                            } finally {
                                inviteBusy = false
                            }
                        }
                    },
                    enabled = !inviteBusy,
                ) {
                    Text(if (inviteBusy) "Descargando…" else "Aceptar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        if (inviteBusy) return@TextButton
                        inviteBusy = true
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    ClinicService.rejectInvitation(context, inv.clinicId)
                                    ClinicMembershipStorage.removePendingInvite(context, inv.clinicId)
                                }
                                pendingInvite =
                                    ClinicMembershipStorage.loadPendingInvites(context).firstOrNull()
                                if (pendingInvite == null) {
                                    affiliationNotice =
                                        ClinicMembershipStorage.loadPendingNotices(context).firstOrNull()
                                }
                            } catch (_: Exception) {
                                ClinicMembershipStorage.removePendingInvite(context, inv.clinicId)
                                pendingInvite =
                                    ClinicMembershipStorage.loadPendingInvites(context).firstOrNull()
                            } finally {
                                inviteBusy = false
                            }
                        }
                    },
                    enabled = !inviteBusy,
                ) {
                    Text("Rechazar")
                }
            },
        )
    }

    if (pendingInvite == null) {
        affiliationNotice?.let { msg ->
            AlertDialog(
                onDismissRequest = {
                    ClinicMembershipStorage.dismissCurrentNotice(context)
                    affiliationNotice = ClinicMembershipStorage.loadPendingNotices(context).firstOrNull()
                },
                title = { Text("Equipo clínico") },
                text = { Text(msg) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            ClinicMembershipStorage.dismissCurrentNotice(context)
                            affiliationNotice =
                                ClinicMembershipStorage.loadPendingNotices(context).firstOrNull()
                        },
                    ) {
                        Text("OK")
                    }
                },
            )
        }
    }

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
                    onOpenPlantillas = onOpenPlantillas,
                    onOpenDrafts = onOpenDrafts,
                )
                1 -> PacienteScreen(
                    refreshKey = patientRefreshKey,
                    onAddPatient = onAddPatient,
                    onEditPatient = onEditPatient,
                )
                else -> InformeScreen(refreshKey = informeRefreshKey, onOpenInforme = onOpenInforme)
            }
        }
    }
}
