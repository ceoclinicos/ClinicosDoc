package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.FarmacoCatalog
import com.ceoclinicos.clinicosdoc.model.RecetaDefaults
import com.ceoclinicos.clinicosdoc.model.RecipePresetFarmaco
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

private enum class FarmacoSheetStep {
    BUSCAR,
    NOMBRE,
    PRESENTACION,
    DOSIS,
    INDICACIONES,
}

/**
 * Panel inferior por pasos: buscar → presentación → dosis → indicaciones.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddFarmacoSheet(
    initial: RecipePresetFarmaco? = null,
    onDismiss: () -> Unit,
    onSave: (RecipePresetFarmaco) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var step by remember {
        mutableStateOf(
            if (initial?.principioActivo?.isNotBlank() == true) FarmacoSheetStep.PRESENTACION
            else FarmacoSheetStep.BUSCAR,
        )
    }
    var search by remember { mutableStateOf("") }
    var principio by remember { mutableStateOf(initial?.principioActivo.orEmpty()) }
    var presentacion by remember {
        mutableStateOf(initial?.presentacion?.ifBlank { RecetaDefaults.PRESENTACIONES.first() }
            ?: RecetaDefaults.PRESENTACIONES.first())
    }
    var concentracion by remember { mutableStateOf(initial?.concentracion.orEmpty()) }
    var disponase by remember { mutableStateOf(initial?.disponase.orEmpty()) }
    var indicaciones by remember { mutableStateOf(initial?.indicaciones.orEmpty()) }
    var presentacionMenu by remember { mutableStateOf(false) }

    val results = remember(search) { FarmacoCatalog.search(search, limit = 200) }

    fun goPresentacion() {
        step = FarmacoSheetStep.PRESENTACION
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            Text(
                when (step) {
                    FarmacoSheetStep.BUSCAR -> "Buscar fármaco"
                    FarmacoSheetStep.NOMBRE -> "Nombre del fármaco"
                    FarmacoSheetStep.PRESENTACION -> "Presentación"
                    FarmacoSheetStep.DOSIS -> "Dosis / concentración"
                    FarmacoSheetStep.INDICACIONES -> "Indicaciones"
                },
                style = MaterialTheme.typography.titleLarge,
            )
            Text(
                when (step) {
                    FarmacoSheetStep.BUSCAR -> "1 de 4 · Elija de la lista o agregue uno nuevo"
                    FarmacoSheetStep.NOMBRE -> "1 de 4 · Escriba el principio activo"
                    FarmacoSheetStep.PRESENTACION -> "2 de 4 · Tabletas, ampollas, jarabe…"
                    FarmacoSheetStep.DOSIS -> "3 de 4 · Miligramos o cantidad"
                    FarmacoSheetStep.INDICACIONES -> "4 de 4 · Cómo tomarlo"
                },
                color = TextSecondary,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(modifier = Modifier.height(12.dp))

            when (step) {
                FarmacoSheetStep.BUSCAR -> {
                    OutlinedTextField(
                        value = search,
                        onValueChange = { search = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Buscar") },
                        placeholder = { Text("Ej. amoxicilina, ibuprofeno…") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ListItem(
                        headlineContent = { Text("No está en la lista…") },
                        supportingContent = { Text("Agregar fármaco nuevo", color = TextSecondary) },
                        modifier = Modifier.clickable {
                            principio = search.trim()
                            presentacion = RecetaDefaults.PRESENTACIONES.first()
                            concentracion = ""
                            step = FarmacoSheetStep.NOMBRE
                        },
                    )
                    HorizontalDivider()
                    LazyColumn(modifier = Modifier.weight(1f, fill = true)) {
                        items(
                            results,
                            key = { "${it.principioActivo}|${it.concentracion}|${it.presentacion}" },
                        ) { item ->
                            ListItem(
                                headlineContent = { Text(item.principioActivo) },
                                supportingContent = {
                                    Text(
                                        buildString {
                                            if (item.concentracion.isNotBlank()) append(item.concentracion)
                                            if (item.presentacion.isNotBlank()) {
                                                if (isNotEmpty()) append(" · ")
                                                append(item.presentacion)
                                            }
                                        },
                                        color = TextSecondary,
                                    )
                                },
                                modifier = Modifier.clickable {
                                    principio = item.principioActivo
                                    concentracion = item.concentracion
                                    presentacion = item.presentacion.ifBlank {
                                        RecetaDefaults.PRESENTACIONES.first()
                                    }
                                    goPresentacion()
                                },
                            )
                            HorizontalDivider()
                        }
                    }
                    TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                        Text("Cancelar")
                    }
                }

                FarmacoSheetStep.NOMBRE -> {
                    OutlinedTextField(
                        value = principio,
                        onValueChange = { principio = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Principio activo") },
                        placeholder = { Text("Ej. Ibuprofeno") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        TextButton(onClick = { step = FarmacoSheetStep.BUSCAR }) { Text("Atrás") }
                        Button(
                            onClick = { if (principio.isNotBlank()) goPresentacion() },
                            enabled = principio.isNotBlank(),
                        ) { Text("Siguiente") }
                    }
                }

                FarmacoSheetStep.PRESENTACION -> {
                    Text(
                        principio,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    ExposedDropdownMenuBox(
                        expanded = presentacionMenu,
                        onExpandedChange = { presentacionMenu = !presentacionMenu },
                    ) {
                        OutlinedTextField(
                            value = presentacion,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Forma farmacéutica") },
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = presentacionMenu)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        )
                        ExposedDropdownMenu(
                            expanded = presentacionMenu,
                            onDismissRequest = { presentacionMenu = false },
                        ) {
                            RecetaDefaults.PRESENTACIONES.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = {
                                        presentacion = option
                                        presentacionMenu = false
                                    },
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        TextButton(onClick = { step = FarmacoSheetStep.BUSCAR }) { Text("Atrás") }
                        Button(onClick = { step = FarmacoSheetStep.DOSIS }) { Text("Siguiente") }
                    }
                }

                FarmacoSheetStep.DOSIS -> {
                    Text(
                        "$principio · $presentacion",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    OutlinedTextField(
                        value = concentracion,
                        onValueChange = { concentracion = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Dosis / concentración") },
                        placeholder = { Text("Ej. 400 mg, 5 ml, 1 g…") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = disponase,
                        onValueChange = { disponase = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Cantidad a dispensar (opcional)") },
                        placeholder = { Text("Ej. 14 tabletas, 1 frasco") },
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        TextButton(onClick = { step = FarmacoSheetStep.PRESENTACION }) {
                            Text("Atrás")
                        }
                        Button(onClick = { step = FarmacoSheetStep.INDICACIONES }) {
                            Text("Siguiente")
                        }
                    }
                }

                FarmacoSheetStep.INDICACIONES -> {
                    Text(
                        buildString {
                            append(principio)
                            if (concentracion.isNotBlank()) append(" $concentracion")
                            append(" ($presentacion)")
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    OutlinedTextField(
                        value = indicaciones,
                        onValueChange = { indicaciones = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Indicaciones") },
                        placeholder = { Text("Tomar 1 tableta vía oral cada 8 horas…") },
                        minLines = 3,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        TextButton(onClick = { step = FarmacoSheetStep.DOSIS }) { Text("Atrás") }
                        Button(
                            onClick = {
                                if (principio.isBlank()) return@Button
                                onSave(
                                    RecipePresetFarmaco(
                                        principioActivo = principio.trim(),
                                        presentacion = presentacion.trim()
                                            .ifBlank { RecetaDefaults.PRESENTACIONES.first() },
                                        concentracion = concentracion.trim(),
                                        disponase = disponase.trim(),
                                        indicaciones = indicaciones.trim(),
                                    ),
                                )
                            },
                            enabled = principio.isNotBlank(),
                        ) { Text("Agregar") }
                    }
                }
            }
        }
    }
}
