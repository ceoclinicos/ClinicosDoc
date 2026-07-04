package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
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
import com.ceoclinicos.clinicosdoc.data.DocumentStorage
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.NavyLight
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun InformeScreen(
    refreshKey: Int,
    onOpenInforme: (String) -> Unit,
) {
    val context = LocalContext.current
    var docs by remember { mutableStateOf(DocumentStorage.loadAll(context)) }
    var loading by remember { mutableStateOf(true) }
    var docToDelete by remember { mutableStateOf<ClinicalDocument?>(null) }
    val dateFormatter = remember { DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.systemDefault()) }

    LaunchedEffect(refreshKey) {
        loading = true
        docs = DocumentStorage.loadAll(context)
        loading = false
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Informes", style = MaterialTheme.typography.headlineLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Documentos generados por IA", style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(24.dp))

        when {
            loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
            docs.isEmpty() -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(96.dp).background(Navy.copy(alpha = 0.06f), CircleShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Description, contentDescription = null, tint = NavyLight, modifier = Modifier.size(48.dp))
                    }
                    Spacer(modifier = Modifier.height(20.dp))
                    Text("No hay informes", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Usa Redactar en Home para crear uno", style = MaterialTheme.typography.bodyMedium)
                }
            }
            else -> LazyColumn(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                items(docs, key = { it.id }) { doc ->
                    Card(
                        modifier = Modifier.combinedClickable(
                            onClick = { onOpenInforme(doc.id) },
                            onLongClick = { docToDelete = doc },
                        ),
                        colors = CardDefaults.cardColors(),
                    ) {
                        ListItem(
                            leadingContent = {
                                Box(modifier = Modifier.background(Teal.copy(alpha = 0.1f), RoundedCornerShape(10.dp)).padding(10.dp)) {
                                    Icon(Icons.Outlined.Description, contentDescription = null, tint = Teal)
                                }
                            },
                            headlineContent = { Text(doc.typeLabel) },
                            supportingContent = {
                                Text(buildString {
                                    append(doc.patientNombre)
                                    doc.templateName?.let { append(" · $it") }
                                    append(" · ${dateFormatter.format(doc.createdAt)}")
                                })
                            },
                            trailingContent = { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null) },
                        )
                    }
                }
            }
        }
    }

    docToDelete?.let { doc ->
        AlertDialog(
            onDismissRequest = { docToDelete = null },
            title = { Text("Eliminar informe") },
            text = {
                Text("¿Deseas eliminar \"${doc.typeLabel}\" de ${doc.patientNombre}? Esta acción no se puede deshacer.")
            },
            confirmButton = {
                TextButton(onClick = {
                    DocumentStorage.delete(context, doc.id)
                    docs = DocumentStorage.loadAll(context)
                    docToDelete = null
                }) { Text("Eliminar") }
            },
            dismissButton = {
                TextButton(onClick = { docToDelete = null }) { Text("Cancelar") }
            },
        )
    }
}
