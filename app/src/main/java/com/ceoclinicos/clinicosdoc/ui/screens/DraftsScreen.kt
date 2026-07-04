package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.DraftStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDraft
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun DraftsScreen(
    onBack: () -> Unit,
    onOpenDraft: (ClinicalDraft) -> Unit,
) {
    val context = LocalContext.current
    var drafts by remember { mutableStateOf<List<ClinicalDraft>>(emptyList()) }
    var draftToDelete by remember { mutableStateOf<ClinicalDraft?>(null) }

    fun reload() {
        drafts = DraftStorage.loadAll(context)
    }

    LaunchedEffect(Unit) {
        reload()
    }

    AppScaffold(title = "Borradores", onBack = onBack) { padding ->
        if (drafts.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.EditNote, contentDescription = null, tint = TextSecondary)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Sin borradores guardados", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Guarda un caso en el paso de dictado para retomarlo después.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        modifier = Modifier.padding(top = 8.dp, start = 32.dp, end = 32.dp),
                    )
                }
            }
            return@AppScaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { Spacer(modifier = Modifier.height(8.dp)) }
            items(drafts, key = { it.id }) { draft ->
                DraftCard(
                    draft = draft,
                    onOpen = { onOpenDraft(draft) },
                    onDelete = { draftToDelete = draft },
                )
            }
            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }

    draftToDelete?.let { draft ->
        AlertDialog(
            onDismissRequest = { draftToDelete = null },
            title = { Text("Eliminar borrador") },
            text = { Text("¿Eliminar el borrador de ${draft.patientNombre}?") },
            confirmButton = {
                TextButton(onClick = {
                    DraftStorage.delete(context, draft.id)
                    draftToDelete = null
                    reload()
                }) {
                    Text("Eliminar")
                }
            },
            dismissButton = {
                TextButton(onClick = { draftToDelete = null }) {
                    Text("Cancelar")
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DraftCard(
    draft: ClinicalDraft,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
) {
    val dateFormatter = remember {
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault())
    }
    val preview = draft.dictation.trim().lineSequence().firstOrNull().orEmpty()
        .take(120) + if (draft.dictation.length > 120) "…" else ""

    Card(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(draft.patientNombre, style = MaterialTheme.typography.titleMedium)
                Text(
                    "${draft.documentType.label} · ${dateFormatter.format(draft.updatedAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 2.dp),
                )
                if (draft.templateName != null) {
                    Text(
                        "Plantilla: ${draft.templateName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                }
                if (preview.isNotBlank()) {
                    Text(
                        preview,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                if (draft.hasGeneratedContent) {
                    Text(
                        "Documento generado · puedes editar o volver al dictado",
                        style = MaterialTheme.typography.labelSmall,
                        color = Teal,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = TextSecondary)
            }
        }
    }
}
