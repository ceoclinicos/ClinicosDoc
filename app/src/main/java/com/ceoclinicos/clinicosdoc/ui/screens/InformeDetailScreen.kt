package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.DoctorStorage
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.data.PatientStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.service.DocumentAiService
import com.ceoclinicos.clinicosdoc.service.DocumentPdfExporter
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.DocumentHeaderSelector
import com.ceoclinicos.clinicosdoc.ui.components.DocumentPreviewDialog
import com.ceoclinicos.clinicosdoc.ui.components.EditableDocumentContent
import com.ceoclinicos.clinicosdoc.ui.components.DocumentReportLayout
import com.ceoclinicos.clinicosdoc.ui.components.PatientMembreteEditor
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.util.sanitizeDocumentContent
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InformeDetailScreen(
    docId: String,
    onBack: () -> Unit,
    onEditHeader: (headerId: String, isNew: Boolean) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var doc by remember { mutableStateOf<ClinicalDocument?>(null) }
    var editableContent by remember(docId) { mutableStateOf("") }
    var editableMembrete by remember(docId) { mutableStateOf(PatientMembrete()) }
    var selectedHeaderId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedHeader by remember { mutableStateOf<DocumentHeader?>(null) }
    var availableHeaders by remember { mutableStateOf(emptyList<DocumentHeader>()) }
    var editing by rememberSaveable { mutableStateOf(false) }
    var menuExpanded by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var showPreview by remember { mutableStateOf(false) }
    var openEditHeaderId by rememberSaveable { mutableStateOf<String?>(null) }
    val dateTimeFormatter = remember {
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault())
    }

    fun refreshHeaders() {
        availableHeaders = HeaderStorage.loadAll(context)
        selectedHeader = selectedHeaderId?.let { id ->
            availableHeaders.firstOrNull { it.id == id }
        } ?: doc?.let { document ->
            HeaderStorage.resolveSelection(document.headerId, document.headerSnapshot, availableHeaders)
        }
    }

    fun applyDocumentToState(document: ClinicalDocument) {
        editableContent = sanitizeDocumentContent(document.content)
        val patient = PatientStorage.loadAll(context).firstOrNull { it.id == document.patientId }
        editableMembrete = PatientMembrete.forDocument(document, patient)
        selectedHeaderId = document.headerId ?: document.headerSnapshot?.id
        refreshHeaders()
    }

    fun reloadDocument() {
        val loaded = DocumentStorage.loadAll(context).firstOrNull { it.id == docId }
        doc = loaded
        availableHeaders = HeaderStorage.loadAll(context)
        loaded?.let { document ->
            if (!editing) {
                applyDocumentToState(document)
            } else {
                selectedHeaderId = document.headerId ?: document.headerSnapshot?.id
                refreshHeaders()
            }
        }
    }

    fun saveDocument(onSaved: () -> Unit = {}) {
        val document = doc ?: return
        saving = true
        scope.launch {
            val updated = document.copy(
                content = editableContent,
                headerId = selectedHeader?.id,
                headerSnapshot = selectedHeader,
                membrete = editableMembrete,
            )
            DocumentStorage.update(context, updated)
            doc = updated
            applyDocumentToState(updated)
            saving = false
            Toast.makeText(context, "Informe actualizado", Toast.LENGTH_SHORT).show()
            onSaved()
        }
    }

    LaunchedEffect(docId) {
        reloadDocument()
    }

    LaunchedEffect(editing) {
        if (editing) {
            refreshHeaders()
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, docId, editing) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && !editing) {
                reloadDocument()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    AppScaffold(
        title = doc?.typeLabel ?: "Informe",
        onBack = onBack,
        actions = {
            if (doc != null) {
                IconButton(
                    onClick = {
                        if (editing) {
                            saveDocument { editing = false }
                        } else {
                            editing = true
                        }
                    },
                ) {
                    Icon(
                        if (editing) Icons.Default.Save else Icons.Default.Edit,
                        contentDescription = if (editing) "Ver" else "Editar",
                    )
                }
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Outlined.MoreVert, contentDescription = "Opciones PDF")
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Vista previa") },
                        leadingIcon = { Icon(Icons.Outlined.Visibility, contentDescription = null) },
                        onClick = {
                            menuExpanded = false
                            showPreview = true
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Guardar PDF") },
                        leadingIcon = { Icon(Icons.Outlined.SaveAlt, contentDescription = null) },
                        onClick = {
                            menuExpanded = false
                            try {
                                val current = doc!!.copy(
                                    content = editableContent,
                                    headerId = selectedHeader?.id,
                                    headerSnapshot = selectedHeader,
                                    membrete = editableMembrete,
                                )
                                val path = DocumentPdfExporter.savePdfToDownloads(context, current)
                                Toast.makeText(context, "Guardado en $path", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error al guardar PDF", Toast.LENGTH_SHORT).show()
                            }
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Compartir PDF") },
                        leadingIcon = { Icon(Icons.Outlined.Share, contentDescription = null) },
                        onClick = {
                            menuExpanded = false
                            try {
                                val current = doc!!.copy(
                                    content = editableContent,
                                    headerId = selectedHeader?.id,
                                    headerSnapshot = selectedHeader,
                                    membrete = editableMembrete,
                                )
                                val file = DocumentPdfExporter.generate(context, current)
                                DocumentPdfExporter.sharePdf(context, file)
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error al compartir PDF", Toast.LENGTH_SHORT).show()
                            }
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Imprimir") },
                        leadingIcon = { Icon(Icons.Outlined.Print, contentDescription = null) },
                        onClick = {
                            menuExpanded = false
                            try {
                                val current = doc!!.copy(
                                    content = editableContent,
                                    headerId = selectedHeader?.id,
                                    headerSnapshot = selectedHeader,
                                    membrete = editableMembrete,
                                )
                                val file = DocumentPdfExporter.generate(context, current)
                                DocumentPdfExporter.printPdf(context, file, doc!!.typeLabel)
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error al imprimir PDF", Toast.LENGTH_SHORT).show()
                            }
                        },
                    )
                }
            }
        },
    ) { padding ->
        val document = doc
        if (document == null) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(color = Teal, modifier = Modifier.padding(top = 48.dp))
            }
            return@AppScaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
        ) {
            Text(
                "${document.patientNombre} · ${dateTimeFormatter.format(document.createdAt)}",
                style = MaterialTheme.typography.bodyMedium,
            )
            document.templateName?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (editing) {
                DocumentHeaderSelector(
                    headers = availableHeaders,
                    selectedHeader = selectedHeader,
                    onSelectHeader = { picked ->
                        selectedHeaderId = picked?.id
                        selectedHeader = picked?.let { header ->
                            availableHeaders.firstOrNull { it.id == header.id } ?: header
                        }
                    },
                    onCreateNew = {
                        val doctor = DoctorStorage.loadProfile(context)
                        val newHeader = if (doctor != null) {
                            HeaderStorage.createFromDoctor(doctor)
                        } else {
                            HeaderStorage.createClinic()
                        }
                        HeaderStorage.upsert(context, newHeader)
                        refreshHeaders()
                        selectedHeaderId = newHeader.id
                        selectedHeader = newHeader
                        openEditHeaderId = newHeader.id
                    },
                    onHeaderUpdated = { saved ->
                        selectedHeaderId = saved.id
                        selectedHeader = saved
                        refreshHeaders()
                    },
                    onHeadersRefresh = { refreshHeaders() },
                    openEditHeaderId = openEditHeaderId,
                    onOpenEditConsumed = { openEditHeaderId = null },
                )
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(modifier = Modifier.fillMaxWidth(), color = DividerColor)
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = document.type.reportTitle,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(16.dp))
                PatientMembreteEditor(
                    membrete = editableMembrete,
                    onMembreteChange = { editableMembrete = it },
                )
                Spacer(modifier = Modifier.height(20.dp))
                EditableDocumentContent(
                    content = editableContent,
                    onContentChange = { editableContent = it },
                    onRegenerateSection = { index, sections ->
                        val document = doc ?: return@EditableDocumentContent null
                        val dictation = document.rawDictation.trim()
                        if (dictation.isBlank()) {
                            Toast.makeText(
                                context,
                                "Este documento no tiene dictado original guardado",
                                Toast.LENGTH_SHORT,
                            ).show()
                            return@EditableDocumentContent null
                        }
                        val patient = PatientStorage.loadAll(context)
                            .firstOrNull { it.id == document.patientId }
                        val doctor = DoctorStorage.loadProfile(context)
                        val template = document.templateId?.let { id ->
                            TemplateStorage.loadAll(context).firstOrNull { it.id == id }
                        } ?: TemplateStorage.defaultForType(context, document.type)
                        if (patient == null || doctor == null || template == null) {
                            Toast.makeText(context, "Faltan datos para regenerar", Toast.LENGTH_SHORT).show()
                            return@EditableDocumentContent null
                        }
                        DocumentAiService.regenerateSection(
                            context = context,
                            template = template,
                            patient = patient,
                            doctor = doctor,
                            dictation = dictation,
                            sectionTitle = sections[index].title,
                            currentSectionBody = sections[index].body,
                            otherSections = sections.filterIndexed { i, _ -> i != index },
                            header = selectedHeader ?: document.headerSnapshot,
                        )
                    },
                )
                Spacer(modifier = Modifier.height(24.dp))
                PremiumPrimaryButton(
                    label = "Guardar cambios",
                    icon = Icons.Default.Save,
                    loading = saving,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { saveDocument { editing = false } },
                )
            } else {
                DocumentReportLayout(
                    documentType = document.type,
                    header = selectedHeader,
                    membrete = editableMembrete,
                    content = editableContent,
                )
            }
            Spacer(modifier = Modifier.height(32.dp))
        }

        if (showPreview) {
            val current = document.copy(
                content = editableContent,
                headerId = selectedHeader?.id,
                headerSnapshot = selectedHeader,
                membrete = editableMembrete,
            )
            DocumentPreviewDialog(
                document = current,
                onDismiss = { showPreview = false },
            )
        }
    }
}
