package com.ceoclinicos.clinicosdoc.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.data.HeaderStorage
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.HeaderEditForm

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeaderEditScreen(headerId: String, isNew: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    var showDelete by remember { mutableStateOf(false) }

    AppScaffold(
        title = if (isNew) "Nuevo encabezado" else "Editar encabezado",
        onBack = onBack,
        actions = {
            if (!isNew) IconButton(onClick = { showDelete = true }) {
                Icon(Icons.Default.Delete, contentDescription = "Eliminar")
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
        ) {
            HeaderEditForm(
                headerId = headerId,
                onSaved = { onBack() },
            )
            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("Eliminar encabezado") },
            text = { Text("¿Eliminar este encabezado?") },
            confirmButton = {
                TextButton(onClick = {
                    HeaderStorage.delete(context, headerId)
                    showDelete = false
                    onBack()
                }) { Text("Eliminar") }
            },
            dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Cancelar") } },
        )
    }
}
