package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File

/**
 * OCR local con ML Kit: extrae texto de una foto o de un PDF (cada página
 * se rasteriza con PdfRenderer y se reconoce página por página).
 * Todo corre en el dispositivo; el texto resultante se usa como dictado.
 */
object DocumentOcrService {

    private const val TAG = "DocumentOcr"
    private const val MAX_BITMAP_SIDE = 2400
    private const val MAX_PDF_PAGES = 10
    private const val PDF_RENDER_WIDTH = 1240

    /**
     * Extrae texto de un URI (imagen o application/pdf).
     * [filePath] opcional: para fotos de cámara propias se lee el archivo
     * directamente, sin depender del ContentProvider.
     */
    suspend fun extractText(context: Context, uri: Uri, filePath: String? = null): String =
        withContext(Dispatchers.IO) {
            val isPdf = uri.toString().endsWith(".pdf", true) ||
                context.contentResolver.getType(uri).orEmpty() == "application/pdf" ||
                filePath?.endsWith(".pdf", true) == true
            val bitmaps: List<Pair<Bitmap, Int>> = when {
                isPdf -> pdfPagesToBitmaps(context, uri).map { it to 0 }
                else -> {
                    val bmp = decodeImageOrThrow(context, uri, filePath)
                    val rot = filePath?.let { exifRotationFromFile(it) }?.takeIf { it != 0 }
                        ?: exifRotation(context, uri)
                    listOf(bmp to rot)
                }
            }
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            try {
                val pages = bitmaps.mapIndexed { i, (bmp, rotation) ->
                    val text = recognize(recognizer, bmp, rotation)
                    bmp.recycle()
                    text.trim()
                }
                val joined = pages.filter { it.isNotEmpty() }.joinToString("\n\n").trim()
                if (joined.isEmpty()) {
                    throw IllegalStateException(
                        "No se detectó texto legible. Prueba con más luz o un documento más nítido.",
                    )
                }
                joined
            } finally {
                recognizer.close()
            }
        }

    /**
     * Reconoce texto en un bitmap. Si el modelo de ML Kit aún se está
     * descargando (primera vez), reintenta una vez tras unos segundos.
     */
    /** Rotación EXIF de la imagen (las fotos de cámara suelen venir a 90°). */
    private fun exifRotation(context: Context, uri: Uri): Int =
        runCatching {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                when (
                    ExifInterface(stream).getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL,
                    )
                ) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270
                    else -> 0
                }
            } ?: 0
        }.getOrDefault(0)

    /** Rotación EXIF leyendo el archivo directamente (fotos de cámara propias). */
    private fun exifRotationFromFile(path: String): Int =
        runCatching {
            when (
                ExifInterface(path).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            ) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
        }.getOrDefault(0)

    /** Decodifica un archivo de imagen por ruta directa (sin ContentProvider). */
    private fun decodeFile(path: String): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        val maxSide = maxOf(bounds.outWidth, bounds.outHeight)
        while (maxSide / (sample * 2) > MAX_BITMAP_SIDE) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeFile(path, opts)
    }

    private suspend fun recognize(recognizer: TextRecognizer, bitmap: Bitmap, rotation: Int): String {
        var attempt = 0
        while (true) {
            try {
                return recognizer.process(InputImage.fromBitmap(bitmap, rotation)).await().text
            } catch (e: MlKitException) {
                attempt++
                if (e.errorCode == MlKitException.UNAVAILABLE && attempt < 2) {
                    delay(4000)
                    continue
                }
                throw e
            }
        }
    }

    /**
     * Decodifica la imagen probando todas las vías disponibles. Si ninguna
     * funciona, lanza un error que indica en qué etapa falló cada intento
     * (para diagnosticar en campo).
     */
    private fun decodeImageOrThrow(context: Context, uri: Uri, filePath: String?): Bitmap {
        val reasons = mutableListOf<String>()

        // 1) Ruta directa del archivo (fotos de cámara propias).
        filePath?.let { path ->
            val file = File(path)
            if (!file.exists()) {
                reasons += "archivo-no-existe"
            } else if (file.length() == 0L) {
                reasons += "archivo-0bytes"
            } else {
                decodeFile(path)?.let { return it }
                reasons += "decodeFile-falló(${file.length()}b)"
            }
        }

        // 2) BitmapFactory vía ContentProvider.
        runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, bounds)
            } ?: run {
                reasons += "stream=null"
                return@runCatching
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                reasons += "bounds=${bounds.outWidth}x${bounds.outHeight}"
                return@runCatching
            }
            var sample = 1
            val maxSide = maxOf(bounds.outWidth, bounds.outHeight)
            while (maxSide / (sample * 2) > MAX_BITMAP_SIDE) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            val decoded = context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, opts)
            }
            if (decoded != null) return decoded
            reasons += "decode=null"
        }.onFailure { reasons += "stream:${it.javaClass.simpleName}" }

        // 3) ImageDecoder (API 28+): lee HEIC y formatos que BitmapFactory no.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            runCatching {
                ImageDecoder.decodeBitmap(
                    ImageDecoder.createSource(context.contentResolver, uri),
                ) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    val w = info.size.width
                    val h = info.size.height
                    if (maxOf(w, h) > MAX_BITMAP_SIDE) {
                        val scale = MAX_BITMAP_SIDE.toFloat() / maxOf(w, h)
                        decoder.setTargetSize(
                            (w * scale).toInt().coerceAtLeast(1),
                            (h * scale).toInt().coerceAtLeast(1),
                        )
                    }
                }
            }.onSuccess { return it }
                .onFailure { reasons += "imgdec:${it.javaClass.simpleName}" }
        }

        Log.w(TAG, "decodeImageOrThrow falló: ${reasons.joinToString()} uri=$uri path=$filePath")
        throw IllegalStateException(
            "No se pudo leer la imagen (${reasons.joinToString(", ").ifBlank { "sin detalle" }}).",
        )
    }

    private fun pdfPagesToBitmaps(context: Context, uri: Uri): List<Bitmap> {
        val pfd: ParcelFileDescriptor =
            context.contentResolver.openFileDescriptor(uri, "r") ?: return emptyList()
        return pfd.use { fd ->
            val renderer = PdfRenderer(fd)
            try {
                val count = minOf(renderer.pageCount, MAX_PDF_PAGES)
                (0 until count).mapNotNull { i ->
                    val page = renderer.openPage(i)
                    try {
                        val scale = PDF_RENDER_WIDTH.toFloat() / page.width
                        val bmp = Bitmap.createBitmap(
                            PDF_RENDER_WIDTH,
                            (page.height * scale).toInt().coerceAtLeast(1),
                            Bitmap.Config.ARGB_8888,
                        )
                        bmp.eraseColor(android.graphics.Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                        bmp
                    } finally {
                        page.close()
                    }
                }
            } finally {
                renderer.close()
            }
        }
    }
}
