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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Card
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.ceoclinicos.clinicosdoc.data.RecipePresetStorage
import com.ceoclinicos.clinicosdoc.model.RecipePreset
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun RecipesScreen(
    refreshKey: Int = 0,
    onEdit: (recipeId: String) -> Unit,
    onUse: (recipeId: String) -> Unit,
    onCreate: () -> Unit,
) {
    val context = LocalContext.current
    var presets by remember { mutableStateOf(RecipePresetStorage.loadAll(context)) }

    fun reload() {
        presets = RecipePresetStorage.loadAll(context)
    }

    DisposableEffect(refreshKey) {
        reload()
        onDispose { }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) reload()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Recipes", style = MaterialTheme.typography.headlineSmall, color = Navy)
            FilledTonalButton(onClick = onCreate) {
                Icon(Icons.Outlined.Add, contentDescription = null)
                Text(" Nueva")
            }
        }
        Text(
            "Recetas predeterminadas. Créelas una vez y asígnelas al paciente.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        if (presets.isEmpty()) {
            Text(
                "Aún no tiene recipes. Ejemplos: Respiratorias, Analgésicos…",
                style = MaterialTheme.typography.bodyLarge,
                color = TextSecondary,
                modifier = Modifier.padding(top = 24.dp),
            )
            return
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(presets, key = { it.id }) { preset ->
                RecipePresetCard(
                    preset = preset,
                    onUse = { onUse(preset.id) },
                    onEdit = { onEdit(preset.id) },
                    onDelete = {
                        RecipePresetStorage.delete(context, preset.id)
                        Toast.makeText(context, "Eliminada", Toast.LENGTH_SHORT).show()
                        reload()
                    },
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun RecipePresetCard(
    preset: RecipePreset,
    onUse: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(preset.name, style = MaterialTheme.typography.titleMedium)
            Text(
                "${preset.farmacos.size} fármaco(s)",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                FilledTonalButton(onClick = onUse) { Text("Usar") }
                OutlinedButton(onClick = onEdit) { Text("Editar") }
                TextButton(onClick = onDelete) { Text("Eliminar") }
            }
        }
    }
}
