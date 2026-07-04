package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.ui.theme.DividerColor
import com.ceoclinicos.clinicosdoc.ui.theme.TextSecondary
import com.ceoclinicos.clinicosdoc.util.sanitizeDocumentContent

@Composable
fun DocumentReportLayout(
    documentType: DocumentType,
    header: DocumentHeader?,
    membrete: PatientMembrete,
    content: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        header?.let {
            HeaderPreview(header = it, compact = true)
            Spacer(modifier = Modifier.height(12.dp))
        }
        HorizontalDivider(modifier = Modifier.fillMaxWidth(), color = DividerColor)
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = documentType.reportTitle,
            modifier = Modifier.fillMaxWidth(),
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(16.dp))
        PatientMembreteDisplay(membrete = membrete)
        Spacer(modifier = Modifier.height(16.dp))
        FormattedDocumentText(sanitizeDocumentContent(content))
    }
}

@Composable
fun DocumentReportEditBody(
    content: String,
    onContentChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            "Texto del informe",
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            "Un solo bloque editable con el contenido clínico",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        PremiumTextField(
            label = "Contenido",
            value = content,
            onValueChange = onContentChange,
            hint = "Redacta o corrige el informe completo",
            singleLine = false,
            maxLines = 24,
        )
    }
}
