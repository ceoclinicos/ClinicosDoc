package com.ceoclinicos.clinicosdoc.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplatesScreen(onBack: () -> Unit, onEditTemplate: (String, Boolean) -> Unit) {
    val context = LocalContext.current
    var templates by remember { mutableStateOf<List<DocumentTemplate>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    fun reload() {
        val all = TemplateStorage.loadAll(context)
        templates = DocumentType.entries.mapNotNull { type ->
            all.firstOrNull { it.documentType == type && it.isDefault }
                ?: all.firstOrNull { it.documentType == type }
        }
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

    AppScaffold(
        title = "Plantillas",
        onBack = onBack,
    ) { padding ->
        if (loading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Teal)
            }
        } else {
            Column(modifier = Modifier.padding(padding).padding(16.dp)) {
                Text(
                    "Una plantilla por tipo. Toca para personalizar (no se pueden crear extras).",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
                LazyColumn {
                    items(templates, key = { it.id }) { template ->
                        Card(
                            onClick = { onEditTemplate(template.id, false) },
                            modifier = Modifier.padding(bottom = 10.dp),
                        ) {
                            ListItem(
                                headlineContent = { Text(template.name) },
                                supportingContent = {
                                    Text(
                                        "${template.documentType.label} · ${template.sections.size} secciones",
                                    )
                                },
                                trailingContent = {
                                    Icon(Icons.Outlined.Edit, contentDescription = null)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
