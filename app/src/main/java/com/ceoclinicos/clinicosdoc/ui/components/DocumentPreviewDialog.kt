package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.runtime.Composable
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument

@Composable
fun DocumentPreviewDialog(
    document: ClinicalDocument,
    onDismiss: () -> Unit,
) {
    DocumentPdfPreviewDialog(document = document, onDismiss = onDismiss)
}
