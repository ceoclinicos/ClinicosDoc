package com.ceoclinicos.clinicosdoc.ui.navigation

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.OrdenesFromCasePending
import com.ceoclinicos.clinicosdoc.ui.screens.AddAppointmentScreen
import com.ceoclinicos.clinicosdoc.ui.screens.AddPatientScreen
import com.ceoclinicos.clinicosdoc.ui.screens.AuthLoadingScreen
import com.ceoclinicos.clinicosdoc.ui.screens.DoctorLoginScreen
import com.ceoclinicos.clinicosdoc.ui.screens.DocumentTypeSheet
import com.ceoclinicos.clinicosdoc.ui.screens.DraftsScreen
import com.ceoclinicos.clinicosdoc.ui.screens.GenerarOrdenesFromCaseScreen
import com.ceoclinicos.clinicosdoc.ui.screens.HeaderEditScreen
import com.ceoclinicos.clinicosdoc.ui.screens.HeadersScreen
import com.ceoclinicos.clinicosdoc.ui.screens.InformeDetailScreen
import com.ceoclinicos.clinicosdoc.ui.screens.MainShell
import com.ceoclinicos.clinicosdoc.ui.screens.RedactarFlowScreen
import com.ceoclinicos.clinicosdoc.ui.screens.SettingsScreen
import com.ceoclinicos.clinicosdoc.ui.screens.PhysicalExamCatalogScreen
import com.ceoclinicos.clinicosdoc.ui.screens.PlantillasHubScreen
import com.ceoclinicos.clinicosdoc.ui.screens.TemplateEditScreen
import com.ceoclinicos.clinicosdoc.ui.screens.TemplatesScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClinicosDocNavHost() {
    val context = LocalContext.current
    val navController = rememberNavController()
    var checkingAuth by remember { mutableStateOf(true) }
    var isRegistered by remember { mutableStateOf(false) }
    var patientRefreshKey by remember { mutableIntStateOf(0) }
    var informeRefreshKey by remember { mutableIntStateOf(0) }
    var calendarRefreshKey by remember { mutableIntStateOf(0) }
    var showDocTypeSheet by remember { mutableStateOf(false) }
    var showExitDialog by remember { mutableStateOf(false) }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val activity = LocalContext.current as? Activity

    BackHandler(enabled = currentRoute == Routes.MAIN && !showExitDialog) {
        showExitDialog = true
    }

    LaunchedEffect(Unit) {
        isRegistered = DoctorStorage.isRegistered(context)
        checkingAuth = false
    }

    if (checkingAuth) {
        AuthLoadingScreen()
        return
    }

    NavHost(
        navController = navController,
        startDestination = if (isRegistered) Routes.MAIN else Routes.AUTH,
        modifier = Modifier.fillMaxSize(),
    ) {
        composable(Routes.AUTH) {
            DoctorLoginScreen {
                isRegistered = true
                navController.navigate(Routes.MAIN) {
                    popUpTo(Routes.AUTH) { inclusive = true }
                }
            }
        }
        composable(Routes.MAIN) {
            MainShell(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                onRedactar = { showDocTypeSheet = true },
                onAddPatient = { navController.navigate(Routes.ADD_PATIENT) },
                onOpenPlantillas = { navController.navigate(Routes.PLANTILLAS_HUB) },
                onOpenDrafts = { navController.navigate(Routes.DRAFTS) },
                patientRefreshKey = patientRefreshKey,
                informeRefreshKey = informeRefreshKey,
                onPatientTabSelected = { patientRefreshKey++ },
                onInformeTabSelected = { informeRefreshKey++ },
                onOpenInforme = { docId -> navController.navigate(Routes.informeDetail(docId)) },
            )
        }
        composable(
            route = Routes.INFORME_DETAIL,
            arguments = listOf(navArgument("docId") { type = NavType.StringType }),
        ) { entry ->
            InformeDetailScreen(
                docId = entry.arguments?.getString("docId") ?: return@composable,
                onBack = {
                    informeRefreshKey++
                    navController.popBackStack()
                },
                onEditHeader = { id, isNew ->
                    navController.navigate(Routes.headerEdit(id, isNew))
                },
                onGenerarOrdenes = { patientId, content, sourceDocId, headerId, typeLabel ->
                    OrdenesFromCasePending.set(
                        OrdenesFromCasePending.Payload(
                            patientId = patientId,
                            caseContent = content,
                            sourceDocumentId = sourceDocId,
                            headerId = headerId,
                            sourceTypeLabel = typeLabel,
                        ),
                    )
                    navController.navigate(Routes.GENERAR_ORDENES)
                },
            )
        }
        composable(Routes.GENERAR_ORDENES) {
            GenerarOrdenesFromCaseScreen(
                onBack = { navController.popBackStack() },
                onSaved = { docId ->
                    informeRefreshKey++
                    navController.popBackStack()
                    navController.navigate(Routes.informeDetail(docId))
                },
            )
        }
        composable(Routes.PLANTILLAS_HUB) {
            PlantillasHubScreen(
                onOpenDocumentTemplates = { navController.navigate(Routes.TEMPLATES) },
                onOpenRecetasTemplates = { navController.navigate(Routes.TEMPLATES_RECETAS) },
                onOpenHeaders = { navController.navigate(Routes.HEADERS) },
                onOpenPhysicalExamCatalog = { navController.navigate(Routes.PHYSICAL_EXAM_CATALOG) },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.PHYSICAL_EXAM_CATALOG) {
            PhysicalExamCatalogScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onTemplates = { navController.navigate(Routes.TEMPLATES) },
                onHeaders = { navController.navigate(Routes.HEADERS) },
            )
        }
        composable(Routes.TEMPLATES) {
            TemplatesScreen(
                onBack = { navController.popBackStack() },
                onEditTemplate = { id, isNew ->
                    navController.navigate(Routes.templateEdit(id, isNew))
                },
                title = "Informes y historias",
                filterTypes = DocumentType.informesYHistorias,
            )
        }
        composable(Routes.TEMPLATES_RECETAS) {
            TemplatesScreen(
                onBack = { navController.popBackStack() },
                onEditTemplate = { id, isNew ->
                    navController.navigate(Routes.templateEdit(id, isNew))
                },
                title = "Recetas",
                filterTypes = DocumentType.recetasYOrdenes,
            )
        }
        composable(
            route = Routes.TEMPLATE_EDIT,
            arguments = listOf(
                navArgument("templateId") { type = NavType.StringType },
                navArgument("isNew") { type = NavType.BoolType },
            ),
        ) { entry ->
            TemplateEditScreen(
                templateId = entry.arguments?.getString("templateId") ?: return@composable,
                isNew = entry.arguments?.getBoolean("isNew") ?: false,
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.HEADERS) {
            HeadersScreen(
                onBack = { navController.popBackStack() },
                onEditHeader = { id, isNew ->
                    navController.navigate(Routes.headerEdit(id, isNew))
                },
            )
        }
        composable(
            route = Routes.HEADER_EDIT,
            arguments = listOf(
                navArgument("headerId") { type = NavType.StringType },
                navArgument("isNew") { type = NavType.BoolType },
            ),
        ) { entry ->
            HeaderEditScreen(
                headerId = entry.arguments?.getString("headerId") ?: return@composable,
                isNew = entry.arguments?.getBoolean("isNew") ?: false,
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.ADD_APPOINTMENT) {
            AddAppointmentScreen(
                onSaved = {
                    calendarRefreshKey++
                    navController.popBackStack()
                },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.ADD_PATIENT) {
            AddPatientScreen(
                onSaved = {
                    patientRefreshKey++
                    navController.popBackStack()
                },
                onBack = { navController.popBackStack() },
            )
        }
        composable(Routes.DRAFTS) {
            DraftsScreen(
                onBack = { navController.popBackStack() },
                onOpenDraft = { draft ->
                    val template = TemplateStorage.ensureTemplateForType(context, draft.documentType)
                    val templateId = draft.templateId
                        ?: template.id
                    navController.navigate(
                        Routes.redactar(
                            DocumentType.storageName(draft.documentType),
                            templateId,
                            draft.headerId ?: "_none_",
                            draft.id,
                        ),
                    )
                },
            )
        }
        composable(
            route = Routes.REDACTAR,
            arguments = listOf(
                navArgument("docType") { type = NavType.StringType },
                navArgument("templateId") { type = NavType.StringType },
                navArgument("headerId") { type = NavType.StringType },
                navArgument("draftId") { type = NavType.StringType },
            ),
        ) { entry ->
            val docTypeName = entry.arguments?.getString("docType") ?: return@composable
            val templateId = entry.arguments?.getString("templateId") ?: return@composable
            val headerIdRaw = entry.arguments?.getString("headerId") ?: "_none_"
            val draftIdRaw = entry.arguments?.getString("draftId") ?: "_none_"
            RedactarFlowScreen(
                documentType = DocumentType.fromName(docTypeName),
                templateId = templateId,
                headerId = headerIdRaw.takeIf { it != "_none_" },
                draftId = draftIdRaw.takeIf { it != "_none_" },
                onBack = {
                    informeRefreshKey++
                    navController.popBackStack()
                },
                onAddPatient = { navController.navigate(Routes.ADD_PATIENT) },
                onEditHeader = { id, isNew ->
                    navController.navigate(Routes.headerEdit(id, isNew))
                },
                onEditTemplate = { id, isNew ->
                    navController.navigate(Routes.templateEdit(id, isNew))
                },
                onGenerarOrdenes = { patientId, content, headerId, typeLabel ->
                    OrdenesFromCasePending.set(
                        OrdenesFromCasePending.Payload(
                            patientId = patientId,
                            caseContent = content,
                            sourceDocumentId = null,
                            headerId = headerId,
                            sourceTypeLabel = typeLabel,
                        ),
                    )
                    navController.navigate(Routes.GENERAR_ORDENES)
                },
            )
        }
    }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = { Text("Salir") },
            text = { Text("¿Estás seguro que quieres salir?") },
            confirmButton = {
                TextButton(onClick = {
                    showExitDialog = false
                    activity?.finish()
                }) {
                    Text("Salir")
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitDialog = false }) {
                    Text("Cancelar")
                }
            },
        )
    }

    if (showDocTypeSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { showDocTypeSheet = false }, sheetState = sheetState) {
            DocumentTypeSheet(
                onDismiss = { showDocTypeSheet = false },
                onSelect = { type ->
                    showDocTypeSheet = false
                    val template = try {
                        TemplateStorage.ensureTemplateForType(context, type)
                    } catch (e: Exception) {
                        android.widget.Toast.makeText(
                            context,
                            e.message ?: "No se pudo abrir la plantilla",
                            android.widget.Toast.LENGTH_SHORT,
                        ).show()
                        return@DocumentTypeSheet
                    }
                    val headers = HeaderStorage.loadAll(context)
                    val header = headers.firstOrNull { it.isDefault } ?: headers.firstOrNull()
                    navController.navigate(
                        Routes.redactar(
                            DocumentType.storageName(type),
                            template.id,
                            header?.id ?: "_none_",
                        ),
                    )
                },
            )
        }
    }
}
