package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

@Composable
fun PatientMembreteEditor(
    membrete: PatientMembrete,
    onMembreteChange: (PatientMembrete) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            "Identificación del paciente",
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            "La fecha del informe va arriba a la derecha, encima del encabezado.",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PremiumTextField(
                        label = "Nombre",
                        value = membrete.nombre,
                        onValueChange = { onMembreteChange(membrete.copy(nombre = it)) },
                        modifier = Modifier.weight(1.2f),
                    )
                    PremiumTextField(
                        label = "Edad",
                        value = membrete.edad,
                        onValueChange = { onMembreteChange(membrete.copy(edad = it)) },
                        modifier = Modifier.weight(0.6f),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PremiumTextField(
                        label = "Sexo",
                        value = membrete.sexo,
                        onValueChange = { onMembreteChange(membrete.copy(sexo = it)) },
                        modifier = Modifier.weight(0.8f),
                    )
                    PremiumTextField(
                        label = "F. nacimiento",
                        value = membrete.fechaNacimiento,
                        onValueChange = { onMembreteChange(membrete.copy(fechaNacimiento = it)) },
                        hint = "dd/MM/yyyy",
                        modifier = Modifier.weight(1f),
                    )
                }
                Text(
                    text = buildMembreteAnnotated(membrete),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
    }
}

@Composable
fun PatientMembreteDisplay(
    membrete: PatientMembrete,
    modifier: Modifier = Modifier,
) {
    Text(
        text = buildMembreteAnnotated(membrete),
        style = MaterialTheme.typography.bodyLarge,
        modifier = modifier.fillMaxWidth(),
    )
}

fun buildMembreteAnnotated(membrete: PatientMembrete): AnnotatedString = buildAnnotatedString {
    fun field(label: String, value: String) {
        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
            append("$label: ")
        }
        append(value)
    }
    field("Nombre", membrete.displayNombre())
    append("   ")
    field("Edad", membrete.displayEdad())
    append("   ")
    field("Sexo", membrete.displaySexo())
    append("   ")
    field("Fecha de nacimiento", membrete.displayFechaNacimiento())
}
