package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.VitalSigns

@Composable
fun VitalSignsFields(
    values: VitalSigns,
    onValuesChange: (VitalSigns) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            "Signos vitales",
            style = MaterialTheme.typography.labelLarge,
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            VitalField(
                label = "TA",
                suffix = "mmHg",
                value = values.ta,
                onValueChange = { onValuesChange(values.copy(ta = it)) },
                modifier = Modifier.weight(1f),
            )
            VitalField(
                label = "FR",
                suffix = "rpm",
                value = values.fr,
                onValueChange = { onValuesChange(values.copy(fr = it)) },
                modifier = Modifier.weight(1f),
            )
            VitalField(
                label = "FC",
                suffix = "lpm",
                value = values.fc,
                onValueChange = { onValuesChange(values.copy(fc = it)) },
                modifier = Modifier.weight(1f),
            )
            VitalField(
                label = "SaTO2",
                suffix = "%",
                value = values.sato2,
                onValueChange = { onValuesChange(values.copy(sato2 = it)) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun VitalField(
    label: String,
    suffix: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { raw ->
            onValueChange(raw.filter { it.isDigit() || it == '/' || it == '.' }.take(8))
        },
        modifier = modifier,
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
        suffix = { Text(suffix, style = MaterialTheme.typography.labelSmall) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = MaterialTheme.typography.bodySmall,
    )
}
