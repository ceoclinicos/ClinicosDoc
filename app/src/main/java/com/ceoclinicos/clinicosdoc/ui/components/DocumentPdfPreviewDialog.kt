package com.ceoclinicos.clinicosdoc.ui.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Base64
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.service.DocumentPdfExporter
import com.ceoclinicos.clinicosdoc.ui.theme.SurfaceBg
import com.ceoclinicos.clinicosdoc.ui.theme.Teal
import java.io.File
import kotlin.math.roundToInt

/**
 * Vista previa del documento renderizado como PDF.
 * Si [onSelloPositionChanged] no es null y el documento incluye sello, este se
 * muestra flotante sobre la última página y se puede arrastrar; al soltarlo se
 * reporta la nueva posición (0..1). Pasar nulls resetea a la posición por defecto.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentPdfPreviewDialog(
    document: ClinicalDocument,
    onDismiss: () -> Unit,
    onSelloPositionChanged: ((Float?, Float?) -> Unit)? = null,
) {
    val context = LocalContext.current
    var pageBitmaps by remember { mutableStateOf<List<Bitmap>?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selloPageIndex by remember { mutableStateOf(-1) }
    var selloNorm by remember { mutableStateOf<Pair<Float, Float>?>(null) }

    val selloDraggable = onSelloPositionChanged != null &&
        document.incluirSello &&
        !document.selloBase64.isNullOrBlank() &&
        document.type != DocumentType.RECETA

    val selloBitmap = remember(document.selloBase64) {
        document.selloBase64?.let { b64 ->
            runCatching {
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }.getOrNull()
        }
    }

    LaunchedEffect(document, selloDraggable) {
        if (pageBitmaps == null) loading = true
        error = null
        try {
            // Con sello arrastrable no se dibuja en el PDF: se superpone en pantalla.
            val file = DocumentPdfExporter.generate(context, document, drawSello = !selloDraggable)
            pageBitmaps = renderPdfPages(file)
            if (selloDraggable) {
                selloPageIndex = DocumentPdfExporter.lastSelloPageIndex
                selloNorm = DocumentPdfExporter.lastSelloNorm()
            }
        } catch (e: Exception) {
            error = e.message ?: "No se pudo generar la vista previa"
        } finally {
            loading = false
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            if (selloDraggable) "Vista previa — arrastra el sello"
                            else "Vista previa — como PDF",
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Cerrar")
                        }
                    },
                )
            },
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(SurfaceBg),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    loading -> CircularProgressIndicator(color = Teal)
                    error != null -> Text(error!!, color = MaterialTheme.colorScheme.error)
                    pageBitmaps != null -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            pageBitmaps!!.forEachIndexed { index, bitmap ->
                                val isSelloPage = selloDraggable && index == selloPageIndex
                                ZoomablePdfPage(
                                    bitmap = bitmap,
                                    pageNumber = index + 1,
                                    modifier = Modifier.padding(bottom = 16.dp),
                                    stampBitmap = if (isSelloPage) selloBitmap else null,
                                    stampNorm = if (isSelloPage) selloNorm else null,
                                    onStampDragged = { fx, fy -> onSelloPositionChanged?.invoke(fx, fy) },
                                    onStampReset = { onSelloPositionChanged?.invoke(null, null) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ZoomablePdfPage(
    bitmap: Bitmap,
    pageNumber: Int,
    modifier: Modifier = Modifier,
    stampBitmap: Bitmap? = null,
    stampNorm: Pair<Float, Float>? = null,
    onStampDragged: ((Float, Float) -> Unit)? = null,
    onStampReset: (() -> Unit)? = null,
) {
    var scale by remember(bitmap) { mutableStateOf(1f) }
    var offset by remember(bitmap) { mutableStateOf(Offset.Zero) }
    var pageSize by remember(bitmap) { mutableStateOf(IntSize.Zero) }
    val transformState = rememberTransformableState { zoomChange, panChange, _ ->
        val newScale = (scale * zoomChange).coerceIn(1f, 5f)
        val maxX = pageSize.width * (newScale - 1f) / 2f
        val maxY = pageSize.height * (newScale - 1f) / 2f
        scale = newScale
        offset = if (newScale == 1f) {
            Offset.Zero
        } else {
            Offset(
                x = (offset.x + panChange.x).coerceIn(-maxX, maxX),
                y = (offset.y + panChange.y).coerceIn(-maxY, maxY),
            )
        }
    }

    Box(
        modifier = modifier
            .zIndex(if (scale > 1f) 1f else 0f)
            .fillMaxWidth()
            .aspectRatio(bitmap.width.toFloat() / bitmap.height.toFloat())
            .shadow(4.dp, RoundedCornerShape(4.dp))
            .background(Color.White)
            .onSizeChanged { pageSize = it }
            .transformable(
                state = transformState,
                canPan = { scale > 1f },
            ),
    ) {
        // Capa transformada: página + sello se mueven juntos al hacer zoom/pan.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
        ) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Página $pageNumber",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.FillBounds,
            )

            if (stampBitmap != null && stampNorm != null && pageSize.width > 0) {
                var dragNorm by remember(stampNorm) { mutableStateOf(stampNorm) }
                val density = LocalDensity.current
                val stampW = pageSize.width * DocumentPdfExporter.selloFractionW
                val stampH = pageSize.height * DocumentPdfExporter.selloFractionH
                val maxX = (pageSize.width - stampW).coerceAtLeast(1f)
                val maxY = (pageSize.height - stampH).coerceAtLeast(1f)
                Box(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                (dragNorm.first * maxX).roundToInt(),
                                (dragNorm.second * maxY).roundToInt(),
                            )
                        }
                        .size(with(density) { stampW.toDp() }, with(density) { stampH.toDp() })
                        .pointerInput(pageSize) {
                            detectDragGestures(
                                onDragEnd = {
                                    onStampDragged?.invoke(dragNorm.first, dragNorm.second)
                                },
                            ) { change, dragAmount ->
                                change.consume()
                                dragNorm = (
                                    (dragNorm.first + dragAmount.x / maxX).coerceIn(0f, 1f) to
                                        (dragNorm.second + dragAmount.y / maxY).coerceIn(0f, 1f)
                                    )
                            }
                        },
                ) {
                    Image(
                        bitmap = stampBitmap.asImageBitmap(),
                        contentDescription = "Sello médico",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit,
                    )
                    // Check sobre el sello: vuelve a la posición por defecto.
                    if (onStampReset != null) {
                        IconButton(
                            onClick = onStampReset,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(28.dp)
                                .background(Teal, CircleShape),
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "Restaurar posición del sello",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun renderPdfPages(file: File): List<Bitmap> {
    val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    val renderer = PdfRenderer(descriptor)
    val pages = mutableListOf<Bitmap>()
    val scale = 2
    try {
        for (i in 0 until renderer.pageCount) {
            renderer.openPage(i).use { page ->
                val width = page.width * scale
                val height = page.height * scale
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                bitmap.eraseColor(android.graphics.Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                pages.add(bitmap)
            }
        }
    } finally {
        renderer.close()
        descriptor.close()
    }
    return pages
}
