package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import com.ceoclinicos.clinicosdoc.data.EnfermedadActualStorage
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.PhysicalExamSystem
import com.ceoclinicos.clinicosdoc.ui.theme.CardWhite
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import kotlinx.coroutines.launch

private sealed class TutorialPhase {
    data object Intro : TutorialPhase()
    data object EnfermedadActual : TutorialPhase()
    data class ExamenSistema(val index: Int) : TutorialPhase()
    data object AnadirSistemas : TutorialPhase()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RedactarTutorialDialog(
    onDismiss: () -> Unit,
    onStartRedactar: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var systems by remember { mutableStateOf<List<PhysicalExamSystem>>(emptyList()) }
    var eaText by remember { mutableStateOf(EnfermedadActualStorage.load(context)) }
    var editingEa by remember { mutableStateOf(false) }
    var editingExam by remember { mutableStateOf(false) }
    var examDraft by remember { mutableStateOf("") }
    var phaseIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        PhysicalExamCatalogStorage.ensureDefaults(context)
        systems = PhysicalExamCatalogStorage.loadAll(context)
            .filter { it.id != "signos_vitales" && it.defaultText.isNotBlank() }
            .sortedBy { it.sortOrder }
        eaText = EnfermedadActualStorage.load(context)
    }

    val phases = remember(systems) {
        buildList {
            add(TutorialPhase.Intro)
            add(TutorialPhase.EnfermedadActual)
            systems.indices.forEach { add(TutorialPhase.ExamenSistema(it)) }
            add(TutorialPhase.AnadirSistemas)
        }
    }
    val phase = phases.getOrElse(phaseIndex) { TutorialPhase.Intro }
    val isLast = phaseIndex >= phases.lastIndex

    fun goNext() {
        editingEa = false
        editingExam = false
        if (phaseIndex < phases.lastIndex) phaseIndex++ else onDismiss()
    }

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = CardWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
        ) {
            Column(
                modifier = Modifier
                    .padding(22.dp)
                    .heightIn(max = 560.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                Text("Personaliza tu estilo", style = MaterialTheme.typography.headlineSmall, color = Navy)
                if (phase is TutorialPhase.Intro) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Enfermedad actual y examen físico",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                TutorialStepDots(current = phaseIndex, total = phases.size)
                Spacer(modifier = Modifier.height(20.dp))

                when (val p = phase) {
                    TutorialPhase.Intro -> TutorialIntroBlock()
                    TutorialPhase.EnfermedadActual -> TutorialEaBlock(
                        text = eaText,
                        editing = editingEa,
                        onEditingChange = { editingEa = it },
                        onTextChange = { eaText = it },
                        onSave = {
                            EnfermedadActualStorage.save(context, eaText)
                            editingEa = false
                            goNext()
                        },
                        onLike = {
                            EnfermedadActualStorage.save(context, eaText)
                            goNext()
                        },
                    )
                    is TutorialPhase.ExamenSistema -> {
                        val system = systems.getOrNull(p.index)
                        LaunchedEffect(system?.id, p.index) {
                            if (system == null) {
                                goNext()
                                return@LaunchedEffect
                            }
                            examDraft = system.defaultText
                            editingExam = false
                        }
                        if (system != null) {
                            TutorialExamBlock(
                                system = system,
                                index = p.index + 1,
                                total = systems.size,
                                draft = examDraft,
                                editing = editingExam,
                                onEditingChange = { editingExam = it },
                                onDraftChange = { examDraft = it },
                                onSave = {
                                    scope.launch {
                                        PhysicalExamCatalogStorage.upsert(
                                            context,
                                            system.copy(defaultText = examDraft.trim()),
                                        )
                                        systems = PhysicalExamCatalogStorage.loadAll(context)
                                            .filter { it.id != "signos_vitales" && it.defaultText.isNotBlank() }
                                            .sortedBy { it.sortOrder }
                                        editingExam = false
                                        goNext()
                                    }
                                },
                                onLike = { goNext() },
                            )
                        }
                    }
                    TutorialPhase.AnadirSistemas -> TutorialAddSystemsBlock()
                }

                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onDismiss) { Text("Omitir") }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (phaseIndex > 0 && !editingEa && !editingExam) {
                            TextButton(onClick = {
                                editingEa = false
                                editingExam = false
                                phaseIndex--
                            }) { Text("Anterior") }
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                        if (!editingEa && !editingExam) {
                            when {
                                phase is TutorialPhase.Intro -> PremiumPrimaryButton(
                                    label = "Empezar revisión",
                                    onClick = { goNext() },
                                    fillMaxWidth = false,
                                )
                                phase is TutorialPhase.AnadirSistemas && isLast && onStartRedactar != null ->
                                    PremiumPrimaryButton(
                                        label = "Redactar",
                                        onClick = onStartRedactar,
                                        fillMaxWidth = false,
                                    )
                                phase is TutorialPhase.AnadirSistemas -> PremiumPrimaryButton(
                                    label = "Entendido",
                                    onClick = onDismiss,
                                    fillMaxWidth = false,
                                )
                                else -> Unit
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TutorialIntroBlock() {
    Text(
        "Nuestra IA entiende cómo te gustan las cosas, pero debes aclarar tus preferencias en las plantillas. " +
            "Comenzaremos a personalizar.",
        style = MaterialTheme.typography.bodyLarge,
        color = TextSecondary,
    )
}

@Composable
private fun TutorialEaBlock(
    text: String,
    editing: Boolean,
    onEditingChange: (Boolean) -> Unit,
    onTextChange: (String) -> Unit,
    onSave: () -> Unit,
    onLike: () -> Unit,
) {
    Text("Enfermedad actual", style = MaterialTheme.typography.titleLarge, color = Navy)
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        "¿Te gusta esta forma de redacción? Si no, cambia el ejemplo a tu gusto.",
        style = MaterialTheme.typography.bodyMedium,
        color = TextSecondary,
    )
    Spacer(modifier = Modifier.height(12.dp))
    if (editing) {
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp),
            minLines = 5,
            maxLines = 10,
        )
        Spacer(modifier = Modifier.height(12.dp))
        PremiumPrimaryButton(label = "Guardar mi estilo", onClick = onSave)
        TextButton(onClick = { onEditingChange(false) }) { Text("Cancelar") }
    } else {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Teal.copy(alpha = 0.06f),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyMedium,
                color = Navy,
                modifier = Modifier.padding(14.dp),
            )
        }
        Spacer(modifier = Modifier.height(14.dp))
        PremiumPrimaryButton(
            label = "Me gusta así",
            icon = Icons.Default.Favorite,
            onClick = onLike,
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(onClick = { onEditingChange(true) }, modifier = Modifier.fillMaxWidth()) {
            Text("Personalizar redacción")
        }
    }
}

@Composable
private fun TutorialExamBlock(
    system: PhysicalExamSystem,
    index: Int,
    total: Int,
    draft: String,
    editing: Boolean,
    onEditingChange: (Boolean) -> Unit,
    onDraftChange: (String) -> Unit,
    onSave: () -> Unit,
    onLike: () -> Unit,
) {
    Text(
        "Examen físico · $index/$total",
        style = MaterialTheme.typography.titleLarge,
        color = Navy,
    )
    Spacer(modifier = Modifier.height(4.dp))
    Text(
        system.name,
        style = MaterialTheme.typography.titleMedium,
        color = Navy,
    )
    Spacer(modifier = Modifier.height(4.dp))
    Text(
        "Texto base cuando no dictas hallazgos en este sistema. ¿Lo dejas así o lo modificas?",
        style = MaterialTheme.typography.bodyMedium,
        color = TextSecondary,
    )
    Spacer(modifier = Modifier.height(12.dp))
    if (editing) {
        OutlinedTextField(
            value = draft,
            onValueChange = onDraftChange,
            modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp),
            minLines = 3,
            maxLines = 8,
        )
        Spacer(modifier = Modifier.height(12.dp))
        PremiumPrimaryButton(label = "Guardar este sistema", onClick = onSave)
        TextButton(onClick = { onEditingChange(false) }) { Text("Cancelar") }
    } else {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Teal.copy(alpha = 0.06f),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "${system.name}: ${system.defaultText}",
                style = MaterialTheme.typography.bodyMedium,
                color = Navy,
                modifier = Modifier.padding(14.dp),
            )
        }
        Spacer(modifier = Modifier.height(14.dp))
        PremiumPrimaryButton(label = "Me gusta así", onClick = onLike)
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(onClick = {
            onDraftChange(system.defaultText)
            onEditingChange(true)
        }, modifier = Modifier.fillMaxWidth()) {
            Text("Modificar este sistema")
        }
    }
}

@Composable
private fun TutorialAddSystemsBlock() {
    Text("¿Falta algún sistema?", style = MaterialTheme.typography.titleLarge, color = Navy)
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        "Si usas un sistema que no está en el modelo (por ejemplo Genitourinario u Oídos), puedes añadirlo en " +
            "Plantillas → Catálogo examen físico. Quedará disponible para tus próximos informes.\n\n" +
            "Nota: los signos vitales solo aparecen si los dictas; si no los mencionas, no se escriben.",
        style = MaterialTheme.typography.bodyLarge,
        color = TextSecondary,
    )
}

@Composable
private fun TutorialStepDots(current: Int, total: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val visible = minOf(total, 8)
        val mapped = if (total <= 8) current else ((current.toFloat() / (total - 1)) * (visible - 1)).toInt()
        repeat(visible) { index ->
            if (index > 0) {
                Box(
                    modifier = Modifier
                        .width(16.dp)
                        .height(2.dp)
                        .background(if (index <= mapped) Teal else DividerColor),
                )
            }
            Box(
                modifier = Modifier
                    .size(if (index == mapped) 9.dp else 7.dp)
                    .background(
                        when {
                            index == mapped -> Teal
                            index < mapped -> Teal.copy(alpha = 0.5f)
                            else -> DividerColor
                        },
                        CircleShape,
                    ),
            )
        }
    }
}
