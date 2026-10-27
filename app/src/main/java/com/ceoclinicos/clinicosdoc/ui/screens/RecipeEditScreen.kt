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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.ceoclinicos.clinicosdoc.data.RecipePresetStorage
import com.ceoclinicos.clinicosdoc.model.RecipePresetContent
import com.ceoclinicos.clinicosdoc.model.RecipePresetFarmaco
import com.ceoclinicos.clinicosdoc.ui.components.AddFarmacoSheet
import com.ceoclinicos.clinicosdoc.ui.components.AppScaffold
import com.ceoclinicos.clinicosdoc.ui.components.PremiumPrimaryButton
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeEditScreen(
    recipeId: String?,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val isNew = recipeId.isNullOrBlank() || recipeId == "_new_"
    var name by remember { mutableStateOf("") }
    var farmacos by remember { mutableStateOf(emptyList<RecipePresetFarmaco>()) }
    var showSheet by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(recipeId) {
        if (!isNew) {
            val id = recipeId ?: return@LaunchedEffect
            val found = RecipePresetStorage.findById(context, id)
            if (found != null) {
                name = found.name
                farmacos = found.farmacos
            } else {
                Toast.makeText(context, "Recipe no encontrada", Toast.LENGTH_SHORT).show()
                onBack()
            }
        }
    }

    AppScaffold(
        title = if (isNew) "Nueva recipe" else "Editar recipe",
        onBack = onBack,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Nombre") },
                placeholder = { Text("Ej. Respiratorias, Analgésicos") },
                singleLine = true,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Fármacos", style = MaterialTheme.typography.titleMedium)
            Text(
                "Toque «Agregar fármaco» para buscarlo y completar presentación, dosis e indicaciones.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (farmacos.isEmpty()) {
                Text(
                    "Aún no agregó fármacos.",
                    color = TextSecondary,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
            } else {
                farmacos.forEachIndexed { index, f ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                        ),
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                RecipePresetContent.formatFarmacoRecipeLine(f),
                                style = MaterialTheme.typography.bodyLarge,
                            )
                            if (f.indicaciones.isNotBlank()) {
                                Text(
                                    f.indicaciones,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                TextButton(
                                    onClick = {
                                        editingIndex = index
                                        showSheet = true
                                    },
                                ) { Text("Editar") }
                                TextButton(
                                    onClick = {
                                        farmacos = farmacos.filterIndexed { i, _ -> i != index }
                                    },
                                ) { Text("Quitar") }
                            }
                        }
                    }
                }
            }

            PremiumPrimaryButton(
                label = "+ Agregar fármaco",
                onClick = {
                    editingIndex = null
                    showSheet = true
                },
            )
            Spacer(modifier = Modifier.height(16.dp))
            PremiumPrimaryButton(
                label = "Guardar",
                onClick = {
                    try {
                        RecipePresetStorage.upsert(
                            context = context,
                            id = if (isNew) null else recipeId,
                            name = name,
                            farmacos = farmacos,
                        )
                        Toast.makeText(context, "Recipe guardada", Toast.LENGTH_SHORT).show()
                        onBack()
                    } catch (e: Exception) {
                        Toast.makeText(
                            context,
                            e.message ?: "No se pudo guardar",
                            Toast.LENGTH_LONG,
                        ).show()
                    }
                },
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showSheet) {
        val idx = editingIndex
        AddFarmacoSheet(
            initial = idx?.let { farmacos.getOrNull(it) },
            onDismiss = { showSheet = false },
            onSave = { saved ->
                farmacos = if (idx != null && idx in farmacos.indices) {
                    farmacos.toMutableList().also { it[idx] = saved }
                } else {
                    farmacos + saved
                }
                showSheet = false
            },
        )
    }
}
