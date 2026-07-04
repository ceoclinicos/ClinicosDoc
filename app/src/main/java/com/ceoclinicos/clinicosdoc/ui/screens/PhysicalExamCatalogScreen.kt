package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumTextField
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun PhysicalExamCatalogScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var systems by remember { mutableStateOf<List<PhysicalExamSystem>>(emptyList()) }
    var editing by remember { mutableStateOf<PhysicalExamSystem?>(null) }
    var isNew by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editText by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<PhysicalExamSystem?>(null) }

    fun reload() {
        systems = PhysicalExamCatalogStorage.loadAll(context)
    }

    fun openEdit(system: PhysicalExamSystem, asNew: Boolean = false) {
        isNew = asNew
        editing = system
        editName = system.name
        editText = system.defaultText
    }

    LaunchedEffect(Unit) { reload() }

    AppScaffold(
        title = "Examen físico",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { openEdit(PhysicalExamCatalogStorage.createNew("", ""), asNew = true) },
                containerColor = Navy,
            ) {
                Icon(Icons.Default.Add, contentDescription = "Agregar sistema", tint = Color.White)
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            Text(
                "Toca un sistema para editarlo. El texto base se usa cuando la IA redacta el examen físico.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                modifier = Modifier.padding(vertical = 12.dp),
            )
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(systems, key = { it.id }) { system ->
                    PhysicalExamSystemCard(
                        system = system,
                        onEdit = { openEdit(system) },
                        onDelete = { deleteTarget = system },
                    )
                }
                item { Spacer(modifier = Modifier.height(72.dp)) }
            }
        }
    }

    editing?.let { target ->
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text(if (isNew) "Nuevo sistema" else "Editar sistema") },
            text = {
                Column {
                    if (!isNew) {
                        Text(
                            "Variable: ${target.id}",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondary,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    PremiumTextField("Nombre del sistema", editName, { editName = it })
                    Spacer(modifier = Modifier.height(12.dp))
                    PremiumTextField(
                        "Texto base (condición normal)",
                        editText,
                        { editText = it },
                        singleLine = false,
                        maxLines = 8,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (editName.isBlank() || editText.isBlank()) {
                        Toast.makeText(context, "Completa nombre y texto", Toast.LENGTH_SHORT).show()
                        return@TextButton
                    }
                    val saved = PhysicalExamCatalogStorage.upsert(
                        context,
                        target.copy(name = editName.trim(), defaultText = editText.trim()),
                    )
                    reload()
                    editing = null
                    Toast.makeText(context, "Sistema guardado: ${saved.name}", Toast.LENGTH_SHORT).show()
                }) { Text("Guardar") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text("Cancelar") }
            },
        )
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Eliminar sistema") },
            text = { Text("¿Eliminar \"${target.name}\" del catálogo? Las plantillas que lo usen dejarán de incluirlo.") },
            confirmButton = {
                TextButton(onClick = {
                    PhysicalExamCatalogStorage.delete(context, target.id)
                    reload()
                    deleteTarget = null
                }) { Text("Eliminar") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancelar") }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PhysicalExamSystemCard(
    system: PhysicalExamSystem,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(onClick = onEdit, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(system.name, style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        system.defaultText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        maxLines = 4,
                    )
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = TextSecondary)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = onEdit, modifier = Modifier.align(Alignment.End)) {
                Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
                Text("Editar")
            }
        }
    }
}
