package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
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
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "Signos vitales",
            style = MaterialTheme.typography.labelLarge,
            color = TextSecondary,
        )
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                "TA (mmHg)",
                style = MaterialTheme.typography.labelMedium,
                color = TextSecondary,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                VitalField(
                    label = "TAS",
                    suffix = "mmHg",
                    value = values.tas,
                    onValueChange = { onValuesChange(values.copy(tas = it)) },
                    modifier = Modifier.weight(1f),
                    allowSlash = false,
                )
                Text("/", style = MaterialTheme.typography.titleMedium)
                VitalField(
                    label = "TAD",
                    suffix = "mmHg",
                    value = values.tad,
                    onValueChange = { onValuesChange(values.copy(tad = it)) },
                    modifier = Modifier.weight(1f),
                    allowSlash = false,
                )
            }
        }
        VitalField(
            label = "FR",
            suffix = "rpm",
            value = values.fr,
            onValueChange = { onValuesChange(values.copy(fr = it)) },
            modifier = Modifier.fillMaxWidth(),
            allowSlash = false,
        )
        VitalField(
            label = "FC",
            suffix = "lpm",
            value = values.fc,
            onValueChange = { onValuesChange(values.copy(fc = it)) },
            modifier = Modifier.fillMaxWidth(),
            allowSlash = false,
        )
        VitalField(
            label = "SaTO2",
            suffix = "%",
            value = values.sato2,
            onValueChange = { onValuesChange(values.copy(sato2 = it)) },
            modifier = Modifier.fillMaxWidth(),
            allowSlash = false,
        )
    }
}

@Composable
private fun VitalField(
    label: String,
    suffix: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    allowSlash: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { raw ->
            onValueChange(
                raw.filter { c ->
                    c.isDigit() || c == '.' || (allowSlash && c == '/')
                }.take(8),
            )
        },
        modifier = modifier,
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
        suffix = { Text(suffix, style = MaterialTheme.typography.labelSmall) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = MaterialTheme.typography.bodyMedium,
    )
}
