package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.RecetaDefaults

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddFarmacoRecetaDialog(
    loading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (principioActivo: String, presentacion: String, concentracion: String) -> Unit,
) {
    var principio by remember { mutableStateOf("") }
    var concentracion by remember { mutableStateOf("") }
    var presentacion by remember { mutableStateOf(RecetaDefaults.PRESENTACIONES.first()) }
    var menuExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!loading) onDismiss() },
        title = { Text("Agregar fármaco") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
            ) {
                Text("Indica el principio activo y la presentación. La IA completará dosis y cantidad típicas.")
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = principio,
                    onValueChange = { principio = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Principio activo") },
                    placeholder = { Text("Ej. Amoxicilina + Ácido Clavulánico") },
                    singleLine = true,
                    enabled = !loading,
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = concentracion,
                    onValueChange = { concentracion = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Concentración (opcional)") },
                    placeholder = { Text("Ej. 875 mg / 125 mg") },
                    singleLine = true,
                    enabled = !loading,
                )
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(
                    expanded = menuExpanded,
                    onExpandedChange = { if (!loading) menuExpanded = !menuExpanded },
                ) {
                    OutlinedTextField(
                        value = presentacion,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Presentación") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = menuExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        enabled = !loading,
                    )
                    ExposedDropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                    ) {
                        RecetaDefaults.PRESENTACIONES.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    presentacion = option
                                    menuExpanded = false
                                },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (principio.isBlank()) return@TextButton
                    onConfirm(principio.trim(), presentacion, concentracion.trim())
                },
                enabled = !loading && principio.isNotBlank(),
            ) {
                Text(if (loading) "Agregando…" else "Agregar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !loading) {
                Text("Cancelar")
            }
        },
    )
}
