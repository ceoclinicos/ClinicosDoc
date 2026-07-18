package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Label
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.ui.components.ActiveSectionsEditor
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PhysicalExamSystemsEditor
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplateEditScreen(templateId: String, isNew: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    var template by remember { mutableStateOf<DocumentTemplate?>(null) }
    var name by remember { mutableStateOf("") }
    var sections by remember { mutableStateOf<List<String>>(emptyList()) }
    var layoutOrder by remember { mutableStateOf<List<String>>(emptyList()) }
    var enabledExamIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var examCatalog by remember { mutableStateOf<List<PhysicalExamSystem>>(emptyList()) }
    var sectionDefaultTexts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    LaunchedEffect(templateId) {
        examCatalog = PhysicalExamCatalogStorage.loadAll(context)
        TemplateStorage.ensureAllTypesPresent(context)
        val found = TemplateStorage.loadAll(context).firstOrNull { it.id == templateId }
        if (found == null) {
            Toast.makeText(context, "No se encontró la plantilla", Toast.LENGTH_SHORT).show()
            onBack()
            return@LaunchedEffect
        }
        template = found
        name = found.name
        sections = found.normalizedSections()
        layoutOrder = found.resolvedLayoutOrder()
        enabledExamIds = found.enabledPhysicalExamSystemIds.ifEmpty {
            PhysicalExamDefaults.defaultEnabledIds
        }
        sectionDefaultTexts = found.sectionDefaultTexts
    }

    if (template == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Teal)
        }
        return
    }

    val docType = template!!.documentType

    AppScaffold(
        title = "Personalizar plantilla",
        onBack = onBack,
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
        ) {
            PremiumTextField("Nombre de la plantilla", name, { name = it }, prefixIcon = Icons.Outlined.Label)
            Spacer(modifier = Modifier.height(12.dp))
            Text("Tipo: ${template!!.documentType.label}")
            Text(
                "Esta es la única plantilla de este tipo. Los cambios se aplican al redactar.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text("Secciones activas (orden)", style = MaterialTheme.typography.titleMedium)
            Text(
                "Marca las secciones a incluir y ordénalas. «Datos del paciente» siempre va primero.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
            ActiveSectionsEditor(
                documentType = docType,
                layoutOrder = layoutOrder,
                activeSections = sections,
                sectionDefaultTexts = sectionDefaultTexts,
                onStateChange = { order, active ->
                    layoutOrder = order
                    sections = active
                },
                onSectionDefaultTextsChange = { sectionDefaultTexts = it },
            )
            if (docType == DocumentType.INFORME ||
                sections.any { it.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true) }
            ) {
                Spacer(modifier = Modifier.height(24.dp))
                Text("Sistemas de examen físico (IA)", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                PhysicalExamSystemsEditor(
                    systems = examCatalog,
                    enabledIds = enabledExamIds,
                    onEnabledIdsChange = { enabledExamIds = it },
                    onCatalogChanged = { examCatalog = it },
                )
            }
            Spacer(modifier = Modifier.height(28.dp))
            PremiumPrimaryButton(
                label = "Guardar plantilla",
                onClick = {
                    if (name.isBlank() || sections.isEmpty()) return@PremiumPrimaryButton
                    TemplateStorage.upsert(
                        context,
                        template!!.copy(
                            name = name.trim(),
                            sections = sections,
                            sectionLayoutOrder = layoutOrder,
                            isDefault = true,
                            enabledPhysicalExamSystemIds = PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(
                                enabledExamIds,
                                examCatalog,
                            ),
                            sectionDefaultTexts = sectionDefaultTexts,
                        ),
                    )
                    Toast.makeText(context, "Plantilla guardada", Toast.LENGTH_SHORT).show()
                    onBack()
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeadersScreen(onBack: () -> Unit, onEditHeader: (String, Boolean) -> Unit) {
    val context = LocalContext.current
    var headers by remember { mutableStateOf(HeaderStorage.loadAll(context)) }
    var loading by remember { mutableStateOf(true) }
    var showAddSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    fun reload() {
        headers = HeaderStorage.loadAll(context)
        loading = false
    }

    LaunchedEffect(Unit) { reload() }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) reload()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val canAdd = headers.size < HeaderStorage.MAX_HEADERS

    AppScaffold(
        title = "Encabezados",
        onBack = onBack,
        floatingActionButton = {
            if (canAdd) {
                FloatingActionButton(
                    onClick = { showAddSheet = true },
                    containerColor = Navy,
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                }
            }
        },
    ) { padding ->
        if (loading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
        } else {
            LazyColumn(modifier = Modifier.padding(padding).padding(16.dp)) {
                item {
                    Text(
                        "Máximo ${HeaderStorage.MAX_HEADERS} encabezados (${headers.size}/${HeaderStorage.MAX_HEADERS}).",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        modifier = Modifier.padding(bottom = 12.dp),
                    )
                }
                items(headers, key = { it.id }) { header ->
                    Card(onClick = { onEditHeader(header.id, false) }, modifier = Modifier.padding(bottom = 10.dp)) {
                        ListItem(
                            headlineContent = { Text(header.name) },
                            supportingContent = {
                                Text(
                                    "${header.headerType.label} · ${header.displayTitle}" +
                                        if (header.isDefault) " · Predeterminado" else "",
                                )
                            },
                            trailingContent = { Icon(Icons.Outlined.Edit, contentDescription = null) },
                        )
                    }
                }
            }
        }
    }

    if (showAddSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAddSheet = false },
            sheetState = sheetState,
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("Nuevo encabezado", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Elige el tipo de encabezado para tus documentos", style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.height(20.dp))
                Card(
                    onClick = {
                        if (!HeaderStorage.canAdd(context)) {
                            Toast.makeText(
                                context,
                                "Máximo ${HeaderStorage.MAX_HEADERS} encabezados",
                                Toast.LENGTH_SHORT,
                            ).show()
                            showAddSheet = false
                            return@Card
                        }
                        val doctor = DoctorStorage.loadProfile(context)
                        val header = if (doctor != null) {
                            HeaderStorage.createFromDoctor(doctor)
                        } else {
                            HeaderStorage.createClinic().copy(
                                headerType = HeaderType.MEDICO,
                                name = "Encabezado médico",
                            )
                        }
                        HeaderStorage.upsert(context, header)
                        showAddSheet = false
                        onEditHeader(header.id, true)
                    },
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                ) {
                    ListItem(
                        headlineContent = { Text("Encabezado de médico") },
                        supportingContent = { Text("Nombre, especialidad y datos del profesional") },
                    )
                }
                Card(
                    onClick = {
                        if (!HeaderStorage.canAdd(context)) {
                            Toast.makeText(
                                context,
                                "Máximo ${HeaderStorage.MAX_HEADERS} encabezados",
                                Toast.LENGTH_SHORT,
                            ).show()
                            showAddSheet = false
                            return@Card
                        }
                        val header = HeaderStorage.createClinic()
                        HeaderStorage.upsert(context, header)
                        showAddSheet = false
                        onEditHeader(header.id, true)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    ListItem(
                        headlineContent = { Text("Encabezado de clínica") },
                        supportingContent = { Text("Nombre, logo y datos de la institución") },
                    )
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}
