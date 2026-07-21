package com.ceoclinicos.clinicosdoc.ui.screens

import android.Manifest
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.semantics.Role
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.CloudSyncService
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.DraftStorage
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.data.EnfermedadActualStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.OrdenesMedicasDefaults
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.model.RecetaDefaults
import com.ceoclinicos.clinicosdoc.model.ReportSessionConfig
import com.ceoclinicos.clinicosdoc.service.DocumentAiService
import com.ceoclinicos.clinicosdoc.service.DocumentPdfExporter
import com.ceoclinicos.clinicosdoc.service.SpeechService
import com.ceoclinicos.clinicosdoc.ui.components.AddFarmacoRecetaDialog
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.DocumentHeaderSelector
import com.ceoclinicos.clinicosdoc.ui.components.DocumentPreviewDialog
import com.ceoclinicos.clinicosdoc.ui.components.DocumentReportDateEditor
import com.ceoclinicos.clinicosdoc.ui.components.EditableDocumentContent
import com.ceoclinicos.clinicosdoc.ui.components.PatientMembreteEditor
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.NavyLight
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.CedulaNormalizer
import com.ceoclinicos.clinicosdoc.util.PermissionHelper
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

private enum class RedactarStep { PACIENTE, PLANTILLA, DICTADO, RESULTADO }

private val RedactarStepSaver = Saver<RedactarStep, String>(
    save = { it.name },
    restore = { name -> RedactarStep.valueOf(name) },
)

private val PatientMembreteSaver = Saver<PatientMembrete, List<String>>(
    save = { listOf(it.nombre, it.edad, it.sexo, it.fechaNacimiento, it.fecha) },
    restore = {
        when (it.size) {
            5 -> PatientMembrete(it[0], it[1], it[2], it[3], it[4])
            4 -> PatientMembrete(
                nombre = it[0],
                edad = it[1],
                sexo = it[2],
                fechaNacimiento = "",
                fecha = it[3],
            )
            else -> PatientMembrete()
        }
    },
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RedactarFlowScreen(
    documentType: DocumentType,
    templateId: String,
    headerId: String?,
    draftId: String? = null,
    onBack: () -> Unit,
    onAddPatient: () -> Unit,
    onEditHeader: (headerId: String, isNew: Boolean) -> Unit,
    onEditTemplate: (templateId: String, isNew: Boolean) -> Unit,
    onGenerarOrdenes: (
        patientId: String,
        caseContent: String,
        headerId: String?,
        typeLabel: String,
    ) -> Unit = { _, _, _, _ -> },
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val speechService = remember { SpeechService(context) }

    var step by rememberSaveable(stateSaver = RedactarStepSaver) { mutableStateOf(RedactarStep.PACIENTE) }
    var selectedPatientId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedHeaderId by rememberSaveable { mutableStateOf(headerId) }
    var patients by remember { mutableStateOf<List<Patient>>(emptyList()) }
    var selectedPatient by remember { mutableStateOf<Patient?>(null) }
    var doctor by remember { mutableStateOf<DoctorProfile?>(null) }
    var template by remember { mutableStateOf<DocumentTemplate?>(null) }
    var header by remember { mutableStateOf<DocumentHeader?>(null) }
    var availableHeaders by remember { mutableStateOf<List<DocumentHeader>>(emptyList()) }
    var loading by rememberSaveable { mutableStateOf(true) }

    var dictation by rememberSaveable { mutableStateOf("") }
    var dictationField by remember { mutableStateOf(TextFieldValue()) }
    var listening by remember { mutableStateOf(false) }
    var processing by remember { mutableStateOf(false) }
    var generatedContent by rememberSaveable { mutableStateOf<String?>(null) }
    /** Si ya se guardó el documento en esta sesión, regenerar/guardar actualiza el mismo (no crea otro). */
    var savedDocumentId by rememberSaveable { mutableStateOf<String?>(null) }
    var membrete by rememberSaveable(stateSaver = PatientMembreteSaver) { mutableStateOf(PatientMembrete()) }
    var error by remember { mutableStateOf<String?>(null) }
    var showToolsMenu by remember { mutableStateOf(false) }
    var showPreview by remember { mutableStateOf(false) }
    var openEditHeaderId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedTemplateId by rememberSaveable { mutableStateOf(templateId) }
    var showTemplatePicker by remember { mutableStateOf(false) }
    var availableTemplates by remember { mutableStateOf<List<DocumentTemplate>>(emptyList()) }
    var cedulaSearch by rememberSaveable { mutableStateOf("") }
    var patientSearchMessage by remember { mutableStateOf<String?>(null) }
    var currentDraftId by rememberSaveable { mutableStateOf(draftId) }
    var draftLoaded by rememberSaveable { mutableStateOf(false) }
    var examCatalog by remember { mutableStateOf<List<PhysicalExamSystem>>(emptyList()) }
    var enabledExamIds by rememberSaveable { mutableStateOf<List<String>>(emptyList()) }
    var examTextOverrides by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var enfermedadActualEjemplo by rememberSaveable { mutableStateOf("") }
    var activeSections by remember { mutableStateOf<List<String>>(emptyList()) }
    var sectionLayoutOrder by remember { mutableStateOf<List<String>>(emptyList()) }
    var sectionDefaultTexts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    /** Órdenes: dictar o pasar informe/HC del mismo paciente. */
    var ordenesUsarInforme by rememberSaveable { mutableStateOf(false) }
    var ordenesModoName by rememberSaveable { mutableStateOf(OrdenesMedicasDefaults.Modo.ORDENES.name) }
    var ordenesNotes by rememberSaveable { mutableStateOf("") }
    var selectedSourceDocId by rememberSaveable { mutableStateOf<String?>(null) }
    /** Receta: dictar, informe o diagnóstico. */
    var recetaFuenteName by rememberSaveable { mutableStateOf(RecetaDefaults.Fuente.DICTAR.name) }
    var diagnosticoText by rememberSaveable { mutableStateOf("") }
    var showAddFarmaco by remember { mutableStateOf(false) }
    var addingFarmaco by remember { mutableStateOf(false) }

    val sessionConfig = remember(
        enabledExamIds,
        examTextOverrides,
        enfermedadActualEjemplo,
        activeSections,
        sectionLayoutOrder,
        sectionDefaultTexts,
    ) {
        ReportSessionConfig(
            enabledPhysicalExamSystemIds = enabledExamIds,
            physicalExamTextOverrides = examTextOverrides,
            enfermedadActualEjemplo = enfermedadActualEjemplo,
            activeSections = activeSections,
            sectionLayoutOrder = sectionLayoutOrder,
            sectionDefaultTexts = sectionDefaultTexts,
        )
    }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            listening = speechService.startListening(existingText = dictation) { text, _ ->
                dictation = text
            }
        } else {
            Toast.makeText(context, "Activa el permiso de micrófono en ajustes del teléfono", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(dictation) {
        if (dictationField.text != dictation) {
            dictationField = TextFieldValue(dictation, TextRange(dictation.length))
        }
    }

    fun refreshHeaders() {
        availableHeaders = HeaderStorage.loadAll(context)
        header = selectedHeaderId?.let { id ->
            availableHeaders.firstOrNull { it.id == id }
        } ?: HeaderStorage.refreshSelection(header, availableHeaders)
    }

    fun reloadTemplate() {
        val ensured = TemplateStorage.ensureTemplateForType(context, documentType)
        availableTemplates = TemplateStorage.forType(context, documentType)
        template = availableTemplates.firstOrNull { it.id == selectedTemplateId }
            ?: availableTemplates.firstOrNull()
            ?: ensured
        template?.let { selectedTemplateId = it.id }
    }

    fun applyTemplateConfig(tpl: DocumentTemplate) {
        val config = tpl.toSessionConfig()
        enabledExamIds = PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(
            config.enabledPhysicalExamSystemIds.ifEmpty { PhysicalExamDefaults.defaultEnabledIds },
            PhysicalExamCatalogStorage.loadAll(context),
        )
        examTextOverrides = config.physicalExamTextOverrides
        enfermedadActualEjemplo = config.enfermedadActualEjemplo.ifBlank {
            EnfermedadActualStorage.load(context)
        }
        if (enfermedadActualEjemplo.isNotBlank()) {
            EnfermedadActualStorage.save(context, enfermedadActualEjemplo)
        }
        activeSections = config.activeSections
        sectionLayoutOrder = config.sectionLayoutOrder
        sectionDefaultTexts = config.sectionDefaultTexts
    }

    fun persistTemplateConfig(
        ids: List<String> = enabledExamIds,
        overrides: Map<String, String> = examTextOverrides,
        ejemplo: String = enfermedadActualEjemplo,
        sections: List<String> = activeSections,
        layout: List<String> = sectionLayoutOrder,
        sectionTexts: Map<String, String> = sectionDefaultTexts,
    ) {
        val tpl = template ?: return
        val updated = tpl.withSessionConfig(
            ReportSessionConfig(
                enabledPhysicalExamSystemIds = ids,
                physicalExamTextOverrides = overrides,
                enfermedadActualEjemplo = ejemplo,
                activeSections = sections,
                sectionLayoutOrder = layout,
                sectionDefaultTexts = sectionTexts,
            ),
        )
        EnfermedadActualStorage.save(context, ejemplo)
        if (updated == tpl) return
        template = TemplateStorage.upsert(context, updated)
    }

    fun refreshExamCatalog() {
        examCatalog = PhysicalExamCatalogStorage.loadAll(context)
    }

    fun applyDraft(draft: ClinicalDraft) {
        currentDraftId = draft.id
        selectedPatientId = draft.patientId
        dictation = draft.dictation
        generatedContent = draft.generatedContent
        draft.templateId?.let { selectedTemplateId = it }
        draft.headerId?.let { selectedHeaderId = it }
        draft.membrete?.let { membrete = it }
        step = when {
            draft.hasGeneratedContent -> RedactarStep.RESULTADO
            draft.dictation.isNotBlank() -> RedactarStep.DICTADO
            else -> RedactarStep.PLANTILLA
        }
    }

    fun previewDocumentOrNull(): ClinicalDocument? {
        val patient = selectedPatient ?: return null
        val content = generatedContent ?: return null
        return ClinicalDocument(
            id = savedDocumentId ?: "preview",
            patientId = patient.id,
            patientNombre = patient.nombre,
            patientCedula = patient.cedula,
            type = documentType,
            content = content,
            rawDictation = dictation.trim(),
            createdAt = Instant.now(),
            templateId = template?.id,
            templateName = template?.name,
            headerId = header?.id,
            headerSnapshot = header,
            membrete = membrete,
        )
    }

    fun showMsg(msg: String) = Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()

    fun persistGeneratedDocument(content: String, showToast: Boolean = true): Boolean {
        val patient = selectedPatient ?: return false
        val tpl = template ?: return false
        val id = savedDocumentId ?: UUID.randomUUID().toString()
        val existing = savedDocumentId?.let { sid ->
            DocumentStorage.loadAll(context).firstOrNull { it.id == sid }
        }
        val doc = ClinicalDocument(
            id = id,
            patientId = patient.id,
            patientNombre = patient.nombre,
            patientCedula = patient.cedula,
            type = documentType,
            content = content,
            rawDictation = dictation.trim(),
            createdAt = existing?.createdAt ?: Instant.now(),
            templateId = tpl.id,
            templateName = tpl.name,
            headerId = header?.id,
            headerSnapshot = header,
            membrete = membrete,
            sourceDocumentId = existing?.sourceDocumentId
                ?: selectedSourceDocId?.takeIf {
                    documentType == DocumentType.ORDENES_MEDICAS ||
                        (documentType == DocumentType.RECETA &&
                            recetaFuenteName == RecetaDefaults.Fuente.INFORME.name)
                },
        )
        if (existing != null) {
            DocumentStorage.update(context, doc)
        } else {
            DocumentStorage.add(context, doc)
        }
        savedDocumentId = id
        currentDraftId?.let { DraftStorage.delete(context, it) }
        currentDraftId = null
        if (showToast) {
            showMsg(if (existing != null) "Documento actualizado" else "Documento guardado")
        }
        return true
    }

    fun saveDraft(showToast: Boolean = true): Boolean {
        val patient = selectedPatient
        if (patient == null) {
            if (showToast) showMsg("Selecciona un paciente")
            return false
        }
        if (dictation.isBlank() && generatedContent.isNullOrBlank()) {
            if (showToast) showMsg("No hay contenido para guardar")
            return false
        }
        val now = Instant.now()
        val id = currentDraftId ?: UUID.randomUUID().toString()
        val existing = DraftStorage.findById(context, id)
        DraftStorage.upsert(
            context,
            ClinicalDraft(
                id = id,
                patientId = patient.id,
                patientNombre = patient.nombre,
                patientCedula = patient.cedula,
                documentType = documentType,
                dictation = dictation.trim(),
                templateId = template?.id,
                templateName = template?.name,
                headerId = header?.id,
                generatedContent = generatedContent,
                membrete = membrete.takeIf { step == RedactarStep.RESULTADO },
                createdAt = existing?.createdAt ?: now,
                updatedAt = now,
            ),
        )
        currentDraftId = id
        if (showToast) showMsg("Borrador guardado")
        return true
    }

    LaunchedEffect(selectedTemplateId, headerId, draftId) {
        patients = PatientStorage.loadAll(context)
        doctor = DoctorStorage.loadProfile(context)
        reloadTemplate()
        refreshExamCatalog()
        template?.let { applyTemplateConfig(it) }
        if (!draftLoaded && draftId != null) {
            DraftStorage.findById(context, draftId)?.let { draft ->
                applyDraft(draft)
                reloadTemplate()
            }
            draftLoaded = true
        }
        selectedPatient = selectedPatientId?.let { id ->
            patients.firstOrNull { it.id == id }
        }
        if (selectedHeaderId == null && headerId != null) {
            selectedHeaderId = headerId
        }
        refreshHeaders()
        loading = false
    }

    LaunchedEffect(selectedTemplateId) {
        template?.let { applyTemplateConfig(it) }
    }

    LaunchedEffect(step) {
        if (step == RedactarStep.RESULTADO) {
            refreshHeaders()
            if (selectedHeaderId == null && availableHeaders.isNotEmpty()) {
                val default = availableHeaders.firstOrNull { it.isDefault } ?: availableHeaders.first()
                selectedHeaderId = default.id
                header = default
            }
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, step) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (step == RedactarStep.RESULTADO) refreshHeaders()
                if (step == RedactarStep.DICTADO || step == RedactarStep.PLANTILLA) {
                    reloadTemplate()
                    template?.let { applyTemplateConfig(it) }
                }
                if (step == RedactarStep.PLANTILLA) refreshExamCatalog()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    DisposableEffect(Unit) {
        onDispose { speechService.stopListening() }
    }

    AppScaffold(
        title = "${documentType.label} · ${template?.name ?: ""}",
        onBack = onBack,
        actions = {
            Box {
                IconButton(onClick = { showToolsMenu = true }) {
                    Icon(Icons.Default.Build, contentDescription = "Herramientas")
                }
                DropdownMenu(expanded = showToolsMenu, onDismissRequest = { showToolsMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Vista previa") },
                        leadingIcon = { Icon(Icons.Outlined.Visibility, contentDescription = null) },
                        enabled = previewDocumentOrNull() != null,
                        onClick = {
                            showToolsMenu = false
                            showPreview = true
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("PDF") },
                        leadingIcon = { Icon(Icons.Outlined.Share, contentDescription = null) },
                        enabled = previewDocumentOrNull() != null,
                        onClick = {
                            showToolsMenu = false
                            val doc = previewDocumentOrNull() ?: return@DropdownMenuItem
                            try {
                                val file = DocumentPdfExporter.generate(context, doc)
                                DocumentPdfExporter.sharePdf(context, file)
                            } catch (_: Exception) {
                                showMsg("Error al generar PDF")
                            }
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Imprimir") },
                        leadingIcon = { Icon(Icons.Outlined.Print, contentDescription = null) },
                        enabled = previewDocumentOrNull() != null,
                        onClick = {
                            showToolsMenu = false
                            val doc = previewDocumentOrNull() ?: return@DropdownMenuItem
                            try {
                                val file = DocumentPdfExporter.generate(context, doc)
                                DocumentPdfExporter.printPdf(context, file, doc.typeLabel)
                            } catch (_: Exception) {
                                showMsg("Error al imprimir")
                            }
                        },
                    )
                }
            }
        },
    ) { padding ->
        if (loading || template == null) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
            return@AppScaffold
        }

        when (step) {
            RedactarStep.PACIENTE -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
            ) {
                Text("Paciente", style = MaterialTheme.typography.headlineMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text("¿Para qué paciente es este ${documentType.label.lowercase()}?", style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = cedulaSearch,
                        onValueChange = {
                            cedulaSearch = it
                            patientSearchMessage = null
                        },
                        modifier = Modifier.weight(1f),
                        label = { Text("Cédula") },
                        placeholder = { Text("Buscar paciente por C.I.") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                    OutlinedButton(
                        onClick = {
                            if (!CedulaNormalizer.isValid(cedulaSearch)) {
                                patientSearchMessage = "Ingresa una cédula válida"
                                return@OutlinedButton
                            }
                            scope.launch {
                                patientSearchMessage = "Buscando…"
                                val local = PatientStorage.findByCedula(context, cedulaSearch)
                                val found = local ?: try {
                                    CloudSyncService.findPatientByCedulaAnywhere(cedulaSearch)
                                } catch (_: Exception) {
                                    null
                                }
                                if (found != null) {
                                    val saved = PatientStorage.ensureInDoctorList(context, found)
                                    patients = PatientStorage.loadAll(context)
                                    selectedPatient = saved
                                    selectedPatientId = saved.id
                                    patientSearchMessage = "Seleccionado: ${saved.nombre}"
                                    step = RedactarStep.PLANTILLA
                                } else {
                                    patientSearchMessage = "No se encontró paciente con esa cédula"
                                }
                            }
                        },
                    ) {
                        Icon(Icons.Outlined.Search, contentDescription = null)
                        Text("Buscar", modifier = Modifier.padding(start = 4.dp))
                    }
                }
                patientSearchMessage?.let {
                    Text(
                        it,
                        color = if (it.startsWith("Seleccionado")) Teal else Color.Red,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                val filteredPatients = remember(patients, cedulaSearch) {
                    val query = CedulaNormalizer.normalize(cedulaSearch)
                    if (query.isBlank()) patients
                    else patients.filter { CedulaNormalizer.normalize(it.cedula).contains(query) }
                }
                if (patients.isNotEmpty()) {
                    LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
                        items(filteredPatients, key = { it.id }) { patient ->
                            PatientPickCard(patient) {
                                selectedPatient = patient
                                selectedPatientId = patient.id
                                step = RedactarStep.PLANTILLA
                            }
                        }
                    }
                } else {
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        Text("Aún no tienes pacientes registrados", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                PremiumPrimaryButton("Agregar paciente", onClick = onAddPatient, icon = Icons.Default.PersonAdd)
            }

            RedactarStep.PLANTILLA -> Box(modifier = Modifier.padding(padding)) {
                val patient = selectedPatient!!
                val tpl = template!!
                TemplateConfigStep(
                    patient = patient,
                    template = tpl,
                    documentType = documentType,
                    layoutOrder = sectionLayoutOrder,
                    activeSections = activeSections,
                    onSectionsStateChange = { order, sections ->
                        sectionLayoutOrder = order
                        activeSections = sections
                        persistTemplateConfig(layout = order, sections = sections)
                    },
                    sectionDefaultTexts = sectionDefaultTexts,
                    onSectionDefaultTextsChange = {
                        sectionDefaultTexts = it
                        persistTemplateConfig(sectionTexts = it)
                    },
                    examCatalog = examCatalog,
                    enabledExamIds = enabledExamIds,
                    onEnabledExamIdsChange = {
                        val ordered = PhysicalExamCatalogStorage.orderEnabledIdsByCatalog(it, examCatalog)
                        enabledExamIds = ordered
                        persistTemplateConfig(ids = ordered)
                    },
                    onExamCatalogChange = { examCatalog = it },
                    enfermedadActualEjemplo = enfermedadActualEjemplo,
                    onEnfermedadActualEjemploChange = {
                        enfermedadActualEjemplo = it
                        persistTemplateConfig(ejemplo = it)
                    },
                    canChangeTemplate = availableTemplates.size > 1,
                    onChangeTemplate = { showTemplatePicker = true },
                    onContinue = {
                        persistTemplateConfig()
                        step = RedactarStep.DICTADO
                    },
                )
            }

            RedactarStep.DICTADO -> Column(
                modifier = Modifier
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
            ) {
                val patient = selectedPatient!!
                val patientCaseDocs = remember(patient.id) {
                    DocumentStorage.loadAll(context).filter {
                        it.patientId == patient.id &&
                            (it.type == DocumentType.INFORME || it.type == DocumentType.HISTORIA_CLINICA)
                    }
                }
                val isOrdenes = documentType == DocumentType.ORDENES_MEDICAS
                val isReceta = documentType == DocumentType.RECETA
                val canUsarInforme = patientCaseDocs.isNotEmpty()
                val recetaFuente = RecetaDefaults.Fuente.entries
                    .firstOrNull { it.name == recetaFuenteName }
                    ?: RecetaDefaults.Fuente.DICTAR
                val showInformePicker = (isOrdenes && ordenesUsarInforme) ||
                    (isReceta && recetaFuente == RecetaDefaults.Fuente.INFORME)
                val showDiagnostico = isReceta && recetaFuente == RecetaDefaults.Fuente.DIAGNOSTICO
                val showDictadoMic = !showInformePicker && !showDiagnostico

                Box(modifier = Modifier.fillMaxWidth().background(Teal.copy(alpha = 0.08f), MaterialTheme.shapes.medium).padding(16.dp)) {
                    Column {
                        Text(patient.nombre, style = MaterialTheme.typography.labelLarge)
                        Text("C.I. ${patient.cedula} · ${patient.edad} años", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                OutlinedButton(
                    onClick = { step = RedactarStep.PLANTILLA },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Configurar plantilla")
                }
                Spacer(modifier = Modifier.height(20.dp))

                if (isOrdenes) {
                    Text("Fuente del caso", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = !ordenesUsarInforme,
                                onClick = { ordenesUsarInforme = false },
                                role = Role.RadioButton,
                            )
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = !ordenesUsarInforme, onClick = { ordenesUsarInforme = false })
                        Text("Dictar", modifier = Modifier.padding(start = 8.dp))
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = ordenesUsarInforme,
                                onClick = { if (canUsarInforme) ordenesUsarInforme = true },
                                enabled = canUsarInforme,
                                role = Role.RadioButton,
                            )
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = ordenesUsarInforme,
                            onClick = { if (canUsarInforme) ordenesUsarInforme = true },
                            enabled = canUsarInforme,
                        )
                        Text(
                            if (canUsarInforme) {
                                "Pasar informe / historia"
                            } else {
                                "Pasar informe / historia (sin documentos de este paciente)"
                            },
                            modifier = Modifier.padding(start = 8.dp),
                            color = if (canUsarInforme) Color.Unspecified else TextSecondary,
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                if (isReceta) {
                    Text("Cómo crear la receta", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    RecetaDefaults.Fuente.entries.forEach { option ->
                        val enabled = option != RecetaDefaults.Fuente.INFORME || canUsarInforme
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = recetaFuente == option,
                                    onClick = {
                                        if (enabled) recetaFuenteName = option.name
                                    },
                                    enabled = enabled,
                                    role = Role.RadioButton,
                                )
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = recetaFuente == option,
                                onClick = { if (enabled) recetaFuenteName = option.name },
                                enabled = enabled,
                            )
                            Text(
                                when {
                                    option == RecetaDefaults.Fuente.INFORME && !canUsarInforme ->
                                        "${option.label} (sin documentos de este paciente)"
                                    option == RecetaDefaults.Fuente.DIAGNOSTICO ->
                                        "${option.label} — la IA propone tratamiento según guías"
                                    else -> option.label
                                },
                                modifier = Modifier.padding(start = 8.dp),
                                color = if (enabled) Color.Unspecified else TextSecondary,
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                if (showInformePicker && canUsarInforme) {
                    Text("Informes de este paciente", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    patientCaseDocs.forEach { src ->
                        val selected = selectedSourceDocId == src.id
                        Card(
                            onClick = {
                                selectedSourceDocId = src.id
                                dictation = src.content
                                dictationField = TextFieldValue(src.content, TextRange(src.content.length))
                            },
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        ) {
                            Row(
                                Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = selected, onClick = {
                                    selectedSourceDocId = src.id
                                    dictation = src.content
                                    dictationField = TextFieldValue(src.content, TextRange(src.content.length))
                                })
                                Text(
                                    "${src.typeLabel} · ${src.createdAt.toString().take(19).replace('T', ' ')}",
                                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                                    style = MaterialTheme.typography.titleSmall,
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Contexto (editable)", style = MaterialTheme.typography.titleSmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = dictationField,
                        onValueChange = {
                            dictationField = it
                            dictation = it.text
                        },
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                        placeholder = { Text("Selecciona un informe arriba…") },
                        maxLines = 12,
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Notas / dictado adicional (opcional)", style = MaterialTheme.typography.titleSmall)
                    OutlinedTextField(
                        value = ordenesNotes,
                        onValueChange = { ordenesNotes = it },
                        modifier = Modifier.fillMaxWidth().height(90.dp),
                        placeholder = { Text("Ej. agregar ceftriaxona…") },
                        maxLines = 5,
                    )
                } else if (showDiagnostico) {
                    Text("Diagnóstico", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "La IA propondrá fármacos según protocolos y guías clínicas habituales.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = diagnosticoText,
                        onValueChange = { diagnosticoText = it },
                        modifier = Modifier.fillMaxWidth().height(140.dp),
                        placeholder = { Text("Ej. Faringoamigdalitis aguda bacteriana") },
                        maxLines = 8,
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Notas / restricciones (opcional)", style = MaterialTheme.typography.titleSmall)
                    OutlinedTextField(
                        value = ordenesNotes,
                        onValueChange = { ordenesNotes = it },
                        modifier = Modifier.fillMaxWidth().height(80.dp),
                        placeholder = { Text("Ej. alergia a penicilina, preferir jarabe…") },
                        maxLines = 4,
                    )
                } else if (showDictadoMic) {
                    Text(
                        if (isReceta) "Fármacos (dictar o escribir)" else "Dictado clínico",
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = dictationField,
                        onValueChange = {
                            dictationField = it
                            dictation = it.text
                        },
                        modifier = Modifier.fillMaxWidth().height(200.dp),
                        placeholder = {
                            Text(
                                if (isReceta) {
                                    "Ej. amoxicilina clavulánico tabletas 7 días…"
                                } else {
                                    "La transcripción aparecerá aquí..."
                                },
                            )
                        },
                        maxLines = 10,
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .background(
                                    if (listening) Brush.linearGradient(listOf(Color.Red.copy(alpha = 0.8f), Color.Red))
                                    else Brush.linearGradient(listOf(Teal, NavyLight)),
                                    CircleShape,
                                )
                                .clickable(enabled = !processing) {
                                    if (listening) {
                                        speechService.stopListening()
                                        listening = false
                                    } else if (PermissionHelper.hasMicrophone(context)) {
                                        listening = speechService.startListening(existingText = dictation) { text, _ ->
                                            dictation = text
                                            dictationField = TextFieldValue(text, TextRange(text.length))
                                        }
                                        if (!listening) {
                                            speechService.lastError?.let { error = it }
                                        }
                                    } else {
                                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                if (listening) Icons.Default.Stop else Icons.Default.Mic,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(36.dp),
                            )
                        }
                    }
                    Text(
                        if (listening) "Grabando... toca el botón para detener" else "Toca para dictar",
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                if (isOrdenes) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Tipo de hoja", style = MaterialTheme.typography.titleSmall)
                    OrdenesMedicasDefaults.Modo.entries.forEach { option ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = ordenesModoName == option.name,
                                    onClick = { ordenesModoName = option.name },
                                    role = Role.RadioButton,
                                )
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = ordenesModoName == option.name,
                                onClick = { ordenesModoName = option.name },
                            )
                            Text(option.label, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                }

                error?.let { Text(it, color = Color.Red, modifier = Modifier.padding(top = 16.dp)) }
                Spacer(modifier = Modifier.height(16.dp))
                PremiumPrimaryButton(
                    label = "Procesar con IA",
                    icon = Icons.Default.AutoAwesome,
                    loading = processing,
                    onClick = {
                        val inputBlank = when {
                            isReceta && recetaFuente == RecetaDefaults.Fuente.DIAGNOSTICO ->
                                diagnosticoText.isBlank()
                            else -> dictation.isBlank()
                        }
                        if (inputBlank) {
                            showMsg(
                                when {
                                    isReceta && recetaFuente == RecetaDefaults.Fuente.DIAGNOSTICO ->
                                        "Escribe el diagnóstico"
                                    (isOrdenes && ordenesUsarInforme) ||
                                        (isReceta && recetaFuente == RecetaDefaults.Fuente.INFORME) ->
                                        "Selecciona o pega el informe como contexto"
                                    isReceta -> "Dicta o escribe los fármacos"
                                    else -> "Dicta o escribe el contenido antes de procesar"
                                },
                            )
                            return@PremiumPrimaryButton
                        }
                        val doc = doctor
                        if (selectedPatient == null || doc == null) {
                            showMsg("Faltan datos del paciente o médico")
                            return@PremiumPrimaryButton
                        }
                        processing = true
                        error = null
                        scope.launch {
                            speechService.stopListening()
                            listening = false
                            try {
                                generatedContent = when {
                                    isOrdenes -> {
                                        val modo = OrdenesMedicasDefaults.Modo.entries
                                            .firstOrNull { it.name == ordenesModoName }
                                            ?: OrdenesMedicasDefaults.Modo.ORDENES
                                        DocumentAiService.generateOrdenesFromCase(
                                            context = context,
                                            patient = selectedPatient!!,
                                            doctor = doc,
                                            caseContent = dictation.trim(),
                                            notes = if (ordenesUsarInforme) ordenesNotes.trim() else "",
                                            modo = modo,
                                            header = header,
                                        )
                                    }
                                    isReceta -> {
                                        val fuente = RecetaDefaults.Fuente.entries
                                            .firstOrNull { it.name == recetaFuenteName }
                                            ?: RecetaDefaults.Fuente.DICTAR
                                        val input = if (fuente == RecetaDefaults.Fuente.DIAGNOSTICO) {
                                            diagnosticoText.trim()
                                        } else {
                                            dictation.trim()
                                        }
                                        DocumentAiService.generateReceta(
                                            context = context,
                                            patient = selectedPatient!!,
                                            doctor = doc,
                                            fuente = fuente,
                                            input = input,
                                            notes = when (fuente) {
                                                RecetaDefaults.Fuente.DICTAR -> ""
                                                else -> ordenesNotes.trim()
                                            },
                                            header = header,
                                        )
                                    }
                                    else -> DocumentAiService.generateDocument(
                                        context = context,
                                        template = template!!,
                                        patient = selectedPatient!!,
                                        doctor = doc,
                                        dictation = dictation.trim(),
                                        header = header,
                                        sessionConfig = sessionConfig,
                                    )
                                }
                                membrete = PatientMembrete.fromPatient(selectedPatient!!)
                                step = RedactarStep.RESULTADO
                                val newContent = generatedContent
                                if (savedDocumentId != null && !newContent.isNullOrBlank()) {
                                    persistGeneratedDocument(newContent, showToast = true)
                                } else {
                                    saveDraft(showToast = false)
                                }
                            } catch (e: Exception) {
                                error = e.message?.removePrefix("Exception: ")
                            } finally {
                                processing = false
                            }
                        }
                    },
                )
            }

            RedactarStep.RESULTADO -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                ) {
                    DocumentReportDateEditor(
                        fecha = membrete.fecha,
                        onFechaChange = { membrete = membrete.copy(fecha = it) },
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    DocumentHeaderSelector(
                        headers = availableHeaders,
                        selectedHeader = header,
                        onSelectHeader = { picked ->
                            selectedHeaderId = picked?.id
                            header = picked?.let { selected ->
                                availableHeaders.firstOrNull { it.id == selected.id } ?: selected
                            }
                        },
                        onCreateNew = {
                            if (!HeaderStorage.canAdd(context)) {
                                Toast.makeText(
                                    context,
                                    "Máximo ${HeaderStorage.MAX_HEADERS} encabezados",
                                    Toast.LENGTH_SHORT,
                                ).show()
                            } else {
                                val doctorProfile = doctor
                                val newHeader = if (doctorProfile != null) {
                                    HeaderStorage.createFromDoctor(doctorProfile)
                                } else {
                                    HeaderStorage.createClinic()
                                }
                                HeaderStorage.upsert(context, newHeader)
                                refreshHeaders()
                                selectedHeaderId = newHeader.id
                                header = newHeader
                                openEditHeaderId = newHeader.id
                            }
                        },
                        onHeaderUpdated = { saved ->
                            selectedHeaderId = saved.id
                            header = saved
                            refreshHeaders()
                        },
                        onHeadersRefresh = { refreshHeaders() },
                        openEditHeaderId = openEditHeaderId,
                        onOpenEditConsumed = { openEditHeaderId = null },
                        canCreateNew = HeaderStorage.canAdd(context),
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = documentType.reportTitle,
                        modifier = Modifier.fillMaxWidth(),
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    PatientMembreteEditor(
                        membrete = membrete,
                        onMembreteChange = { membrete = it },
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    EditableDocumentContent(
                        content = generatedContent.orEmpty(),
                        onContentChange = { generatedContent = it },
                        onRegenerateSection = { index, sections ->
                            if (dictation.isBlank() && diagnosticoText.isBlank()) {
                                showMsg("No hay dictado/diagnóstico para regenerar esta sección")
                                return@EditableDocumentContent null
                            }
                            val patient = selectedPatient
                            val doc = doctor
                            val tpl = template
                            if (patient == null || doc == null || tpl == null) return@EditableDocumentContent null
                            DocumentAiService.regenerateSection(
                                context = context,
                                template = tpl,
                                patient = patient,
                                doctor = doc,
                                dictation = dictation.trim().ifBlank { diagnosticoText.trim() },
                                sectionTitle = sections[index].title,
                                currentSectionBody = sections[index].body,
                                otherSections = sections.filterIndexed { i, _ -> i != index },
                                header = header,
                                sessionConfig = sessionConfig,
                            )
                        },
                    )
                    if (documentType == DocumentType.RECETA) {
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { showAddFarmaco = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !addingFarmaco,
                        ) {
                            Text(if (addingFarmaco) "Agregando fármaco…" else "Agregar fármaco")
                        }
                    }
                    val patient = selectedPatient
                    val content = generatedContent
                    if (patient != null && content != null) {
                        if (documentType == DocumentType.INFORME ||
                            documentType == DocumentType.HISTORIA_CLINICA
                        ) {
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = {
                                    onGenerarOrdenes(
                                        patient.id,
                                        content,
                                        header?.id,
                                        documentType.label,
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Generar órdenes médicas")
                            }
                        }
                    }
                }
                OutlinedButton(
                    onClick = { step = RedactarStep.DICTADO },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 12.dp),
                ) {
                    Text("Editar dictado")
                }
                PremiumPrimaryButton(
                    label = "Vista previa",
                    icon = Icons.Outlined.Visibility,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 12.dp),
                    onClick = { showPreview = true },
                )
                PremiumPrimaryButton(
                    label = if (savedDocumentId != null) "Actualizar documento" else "Guardar documento",
                    icon = Icons.Default.Save,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 24.dp),
                    onClick = {
                        val content = generatedContent ?: return@PremiumPrimaryButton
                        scope.launch {
                            persistGeneratedDocument(content, showToast = true)
                        }
                    },
                )
            }
        }
    }

    if (showPreview) {
        previewDocumentOrNull()?.let { doc ->
            DocumentPreviewDialog(
                document = doc,
                onDismiss = { showPreview = false },
            )
        }
    }

    if (showAddFarmaco) {
        AddFarmacoRecetaDialog(
            loading = addingFarmaco,
            onDismiss = { if (!addingFarmaco) showAddFarmaco = false },
            onConfirm = { principio, presentacion, concentracion ->
                val current = generatedContent.orEmpty()
                addingFarmaco = true
                scope.launch {
                    try {
                        generatedContent = DocumentAiService.appendFarmacoToReceta(
                            context = context,
                            currentContent = current,
                            principioActivo = principio,
                            presentacion = presentacion,
                            concentracion = concentracion,
                            patient = selectedPatient,
                        )
                        showMsg("Fármaco agregado")
                        showAddFarmaco = false
                        if (savedDocumentId != null) {
                            persistGeneratedDocument(generatedContent!!, showToast = false)
                        }
                    } catch (e: Exception) {
                        showMsg(e.message ?: "No se pudo agregar el fármaco")
                    } finally {
                        addingFarmaco = false
                    }
                }
            },
        )
    }

    if (showTemplatePicker) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showTemplatePicker = false },
            sheetState = sheetState,
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("Elegir plantilla", style = MaterialTheme.typography.headlineSmall)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Selecciona cómo quieres estructurar este ${documentType.label.lowercase()}.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(modifier = Modifier.height(16.dp))
                availableTemplates.forEach { item ->
                    Card(
                        onClick = {
                            selectedTemplateId = item.id
                            template = item
                            applyTemplateConfig(item)
                            showTemplatePicker = false
                        },
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${item.sections.size} secciones" +
                                        if (item.isDefault) " · Predeterminada" else "",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            if (item.id == selectedTemplateId) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Teal)
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun PatientPickCard(patient: Patient, onClick: () -> Unit) {
    Card(onClick = onClick) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).background(Navy.copy(alpha = 0.08f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(patient.nombre.firstOrNull()?.uppercaseChar()?.toString() ?: "?")
            }
            Column(modifier = Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text(patient.nombre, style = MaterialTheme.typography.labelLarge)
                Text("C.I. ${patient.cedula} · ${patient.edad} años", style = MaterialTheme.typography.bodyMedium)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentTypeSheet(
    onDismiss: () -> Unit,
    onSelect: (DocumentType) -> Unit,
) {
    Column(modifier = Modifier.padding(24.dp)) {
        Text("Redactar documento", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Selecciona el tipo de documento clínico", style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(24.dp))
        DocumentType.entries.forEach { type ->
            Card(
                onClick = { onSelect(type) },
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
            ) {
                Text(type.label, modifier = Modifier.padding(16.dp), style = MaterialTheme.typography.titleLarge)
            }
        }
    }
}
