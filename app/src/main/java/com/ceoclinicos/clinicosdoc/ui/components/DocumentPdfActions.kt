package com.ceoclinicos.clinicosdoc.ui.components

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.service.DocumentPdfExporter
import com.ceoclinicos.clinicosdoc.ui.theme.Navy
import com.ceoclinicos.clinicosdoc.ui.theme.Teal

private data class PdfAction(
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val onClick: () -> Unit,
)

@Composable
fun DocumentPdfActions(document: ClinicalDocument, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var showPreview by remember { mutableStateOf(false) }

    val actions = listOf(
        PdfAction("Vista previa", Icons.Outlined.Visibility) { showPreview = true },
        PdfAction("PDF", Icons.Outlined.Share) {
            try {
                val file = DocumentPdfExporter.generate(context, document)
                DocumentPdfExporter.sharePdf(context, file)
            } catch (e: Exception) {
                Toast.makeText(context, "Error al generar PDF", Toast.LENGTH_SHORT).show()
            }
        },
        PdfAction("Imprimir", Icons.Outlined.Print) {
            try {
                val file = DocumentPdfExporter.generate(context, document)
                DocumentPdfExporter.printPdf(context, file, document.typeLabel)
            } catch (e: Exception) {
                Toast.makeText(context, "Error al imprimir", Toast.LENGTH_SHORT).show()
            }
        },
    )

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(actions) { action ->
            FilledTonalButton(
                onClick = action.onClick,
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = if (action.label == "Vista previa") Navy.copy(alpha = 0.1f) else Teal.copy(alpha = 0.15f),
                    contentColor = Navy,
                ),
            ) {
                Icon(action.icon, contentDescription = null)
                Text(action.label, modifier = Modifier.padding(start = 6.dp))
            }
        }
    }

    if (showPreview) {
        DocumentPreviewDialog(
            document = document,
            onDismiss = { showPreview = false },
        )
    }
}
