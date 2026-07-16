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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Stop
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
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import com.ceoclinicos.clinicosdoc.model.AiProvider
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.model.PhysicalExamDefaults
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.model.ReportSessionConfig
import com.ceoclinicos.clinicosdoc.service.AiService
import com.ceoclinicos.clinicosdoc.service.DocumentAiService
import com.ceoclinicos.clinicosdoc.service.SpeechService
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.DocumentHeaderSelector
import com.ceoclinicos.clinicosdoc.ui.components.DocumentPdfActions
import com.ceoclinicos.clinicosdoc.ui.components.DocumentReportDateEditor
import com.ceoclinicos.clinicosdoc.ui.components.EditableDocumentContent
import com.ceoclinicos.clinicosdoc.ui.components.PatientMembreteEditor
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.NavyLight
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
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
    var membrete by rememberSaveable(stateSaver = PatientMembreteSaver) { mutableStateOf(PatientMembrete()) }
    var error by remember { mutableStateOf<String?>(null) }
    var showAiMenu by remember { mutableStateOf(false) }
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

    val sessionConfig = remember(
        enabledExamIds,
        examTextOverrides,
        enfermedadActualEjemplo,
        activeSections,
        sectionLayoutOrder,
    ) {
        ReportSessionConfig(
            enabledPhysicalExamSystemIds = enabledExamIds,
            physicalExamTextOverrides = examTextOverrides,
            enfermedadActualEjemplo = enfermedadActualEjemplo,
            activeSections = activeSections,
            sectionLayoutOrder = sectionLayoutOrder,
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
        availableTemplates = TemplateStorage.forType(context, documentType)
        template = availableTemplates.firstOrNull { it.id == selectedTemplateId }
            ?: availableTemplates.firstOrNull()
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
    }

    fun persistTemplateConfig(
        ids: List<String> = enabledExamIds,
        overrides: Map<String, String> = examTextOverrides,
        ejemplo: String = enfermedadActualEjemplo,
        sections: List<String> = activeSections,
        layout: List<String> = sectionLayoutOrder,
    ) {
        val tpl = template ?: return
        val updated = tpl.withSessionConfig(
            ReportSessionConfig(
                enabledPhysicalExamSystemIds = ids,
                physicalExamTextOverrides = overrides,
                enfermedadActualEjemplo = ejemplo,
                activeSections = sections,
                sectionLayoutOrder = layout,
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

    fun showMsg(msg: String) = Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()

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
                IconButton(onClick = { showAiMenu = true }) {
                    Icon(Icons.Default.SmartToy, contentDescription = "Proveedor IA")
                }
                DropdownMenu(expanded = showAiMenu, onDismissRequest = { showAiMenu = false }) {
                    AiProvider.entries.forEach { provider ->
                        DropdownMenuItem(
                            text = { Text(provider.label) },
                            onClick = {
                                AiService.setProvider(context, provider)
                                showMsg("IA: ${provider.label}")
                                showAiMenu = false
                            },
                        )
                    }
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
                Text("Dictado clínico", style = MaterialTheme.typography.titleLarge)
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = dictationField,
                    onValueChange = {
                        dictationField = it
                        dictation = it.text
                    },
                    modifier = Modifier.fillMaxWidth().height(200.dp),
                    placeholder = { Text("La transcripción aparecerá aquí...") },
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
                error?.let { Text(it, color = Color.Red, modifier = Modifier.padding(top = 16.dp)) }
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(
                    onClick = { saveDraft() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Guardar borrador")
                }
                Spacer(modifier = Modifier.height(12.dp))
                PremiumPrimaryButton(
                    label = "Procesar con IA",
                    icon = Icons.Default.AutoAwesome,
                    loading = processing,
                    onClick = {
                        if (dictation.isBlank()) {
                            showMsg("Dicta o escribe el contenido antes de procesar")
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
                                generatedContent = DocumentAiService.generateDocument(
                                    context = context,
                                    template = template!!,
                                    patient = selectedPatient!!,
                                    doctor = doc,
                                    dictation = dictation.trim(),
                                    header = header,
                                    sessionConfig = sessionConfig,
                                )
                                membrete = PatientMembrete.fromPatient(selectedPatient!!)
                                step = RedactarStep.RESULTADO
                                saveDraft(showToast = false)
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
                            if (dictation.isBlank()) {
                                showMsg("No hay dictado para regenerar esta sección")
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
                                dictation = dictation.trim(),
                                sectionTitle = sections[index].title,
                                currentSectionBody = sections[index].body,
                                otherSections = sections.filterIndexed { i, _ -> i != index },
                                header = header,
                                sessionConfig = sessionConfig,
                            )
                        },
                    )
                    val patient = selectedPatient
                    val content = generatedContent
                    if (patient != null && content != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        DocumentPdfActions(
                            document = ClinicalDocument(
                                id = "preview",
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
                            ),
                        )
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 12.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = { step = RedactarStep.DICTADO },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Editar dictado")
                    }
                    OutlinedButton(
                        onClick = { saveDraft() },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Guardar borrador")
                    }
                }
                PremiumPrimaryButton(
                    label = "Guardar documento",
                    icon = Icons.Default.Save,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 24.dp),
                    onClick = {
                        val patient = selectedPatient ?: return@PremiumPrimaryButton
                        val content = generatedContent ?: return@PremiumPrimaryButton
                        scope.launch {
                            DocumentStorage.add(
                                context,
                                ClinicalDocument(
                                    id = UUID.randomUUID().toString(),
                                    patientId = patient.id,
                                    patientNombre = patient.nombre,
                                    patientCedula = patient.cedula,
                                    type = documentType,
                                    content = content,
                                    rawDictation = dictation.trim(),
                                    createdAt = Instant.now(),
                                    templateId = template!!.id,
                                    templateName = template!!.name,
                                    headerId = header?.id,
                                    headerSnapshot = header,
                                    membrete = membrete,
                                ),
                            )
                            currentDraftId?.let { DraftStorage.delete(context, it) }
                            showMsg("Documento guardado")
                            onBack()
                        }
                    },
                )
            }
        }
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
