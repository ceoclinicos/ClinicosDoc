package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary

/** Fecha del informe: esquina superior derecha, encima del encabezado. */
@Composable
fun DocumentReportDate(
    fecha: String,
    modifier: Modifier = Modifier,
) {
    val value = fecha.trim()
    if (value.isBlank()) return
    Box(modifier = modifier.fillMaxWidth()) {
        Text(
            text = value,
            modifier = Modifier.align(Alignment.CenterEnd),
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
fun DocumentReportDateEditor(
    fecha: String,
    onFechaChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxWidth()) {
        PremiumTextField(
            label = "Fecha del informe",
            value = fecha,
            onValueChange = onFechaChange,
            hint = "dd/MM/yyyy",
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .widthIn(max = 200.dp)
                .padding(bottom = 4.dp),
        )
    }
}
