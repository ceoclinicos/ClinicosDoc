package com.ceoclinicos.clinicosdoc.ui.components

import androidx.compose.runtime.Composable
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument

@Composable
fun DocumentPreviewDialog(
    document: ClinicalDocument,
    onDismiss: () -> Unit,
    onSelloPositionChanged: ((Float?, Float?) -> Unit)? = null,
) {
    DocumentPdfPreviewDialog(
        document = document,
        onDismiss = onDismiss,
        onSelloPositionChanged = onSelloPositionChanged,
    )
}
