package com.ceoclinicos.clinicosdoc.service

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.print.PageRange
import androidx.core.content.FileProvider
import com.ceoclinicos.clinicosdoc.model.ClinicalDocument
import com.ceoclinicos.clinicosdoc.model.PatientMembrete
import com.ceoclinicos.clinicosdoc.util.normalizeSectionTitle
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections
import com.ceoclinicos.clinicosdoc.util.sanitizeDocumentContent
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

object DocumentPdfExporter {
    private const val PAGE_WIDTH = 595
    private const val PAGE_HEIGHT = 842
    private const val MARGIN = 48f
    private const val LINE_HEIGHT = 18f
    private const val LOGO_SIZE = 70f
    private const val LOGO_GAP = 14f

    fun generate(context: Context, document: ClinicalDocument): File {
        val dir = File(context.filesDir, "informes_pdf").apply { mkdirs() }
        val file = File(dir, "informe_${document.id.take(8)}.pdf")

        val pdf = PdfDocument()
        val bodyPaint = Paint().apply {
            textSize = 11f
            color = android.graphics.Color.BLACK
        }
        val boldPaint = Paint(bodyPaint).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
        val mainHeaderPaint = Paint().apply {
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            color = android.graphics.Color.BLACK
        }
        val secondaryHeaderPaint = Paint().apply {
            textSize = 11f
            color = android.graphics.Color.BLACK
        }
        val descHeaderPaint = Paint().apply {
            textSize = 10f
            color = android.graphics.Color.DKGRAY
        }
        val titlePaint = Paint().apply {
            textSize = 14f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            color = android.graphics.Color.BLACK
        }
        val metaPaint = Paint().apply {
            textSize = 10f
            color = android.graphics.Color.DKGRAY
        }

        var pageNumber = 1
        var pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
        var page = pdf.startPage(pageInfo)
        var canvas = page.canvas
        var y = MARGIN
        val membrete = document.membrete ?: PatientMembrete.forDocument(document)

        fun newPageIfNeeded(extra: Float = LINE_HEIGHT) {
            if (y + extra > PAGE_HEIGHT - MARGIN) {
                pdf.finishPage(page)
                pageNumber++
                pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
                page = pdf.startPage(pageInfo)
                canvas = page.canvas
                y = MARGIN
            }
        }

        fun drawReportDateTopRight() {
            val dateText = membrete.displayFecha()
            if (dateText == "—") return
            val paint = Paint(metaPaint).apply {
                textSize = 11f
                color = android.graphics.Color.BLACK
            }
            val width = paint.measureText(dateText)
            canvas.drawText(dateText, PAGE_WIDTH - MARGIN - width, y, paint)
            y += LINE_HEIGHT + 6f
        }

        fun drawLineAt(x: Float, text: String, paint: Paint = bodyPaint) {
            newPageIfNeeded()
            canvas.drawText(text, x, y, paint)
            y += LINE_HEIGHT
        }

        fun drawLine(text: String, paint: Paint = bodyPaint) = drawLineAt(MARGIN, text, paint)

        fun drawWrappedAt(x: Float, maxWidth: Float, text: String, paint: Paint = bodyPaint) {
            val words = text.split(" ")
            var line = StringBuilder()
            for (word in words) {
                val candidate = if (line.isEmpty()) word else "$line $word"
                if (paint.measureText(candidate) > maxWidth) {
                    drawLineAt(x, line.toString(), paint)
                    line = StringBuilder(word)
                } else {
                    line = StringBuilder(candidate)
                }
            }
            if (line.isNotEmpty()) drawLineAt(x, line.toString(), paint)
        }

        fun drawWrapped(text: String, paint: Paint = bodyPaint) {
            drawWrappedAt(MARGIN, PAGE_WIDTH - (MARGIN * 2), text, paint)
        }

        fun drawJustifiedWrappedAt(x: Float, maxWidth: Float, text: String, paint: Paint = bodyPaint) {
            val words = text.split(" ").filter { it.isNotEmpty() }
            if (words.isEmpty()) return

            val spaceWidth = paint.measureText(" ")
            val lines = mutableListOf<List<String>>()
            var currentLine = mutableListOf<String>()
            var currentWidth = 0f

            for (word in words) {
                val wordWidth = paint.measureText(word)
                val needed = if (currentLine.isEmpty()) wordWidth else currentWidth + spaceWidth + wordWidth
                if (currentLine.isNotEmpty() && needed > maxWidth) {
                    lines.add(currentLine.toList())
                    currentLine = mutableListOf(word)
                    currentWidth = wordWidth
                } else {
                    if (currentLine.isNotEmpty()) currentWidth += spaceWidth + wordWidth
                    else currentWidth = wordWidth
                    currentLine.add(word)
                }
            }
            if (currentLine.isNotEmpty()) lines.add(currentLine)

            lines.forEachIndexed { index, lineWords ->
                newPageIfNeeded()
                val isLastLine = index == lines.lastIndex
                if (isLastLine || lineWords.size <= 1) {
                    canvas.drawText(lineWords.joinToString(" "), x, y, paint)
                } else {
                    var wordsWidth = 0f
                    lineWords.forEachIndexed { wordIndex, word ->
                        wordsWidth += paint.measureText(word)
                        if (wordIndex < lineWords.lastIndex) wordsWidth += spaceWidth
                    }
                    val extraPerGap = (maxWidth - wordsWidth) / (lineWords.size - 1)
                    var drawX = x
                    lineWords.forEachIndexed { wordIndex, word ->
                        canvas.drawText(word, drawX, y, paint)
                        drawX += paint.measureText(word)
                        if (wordIndex < lineWords.lastIndex) {
                            drawX += spaceWidth + extraPerGap
                        }
                    }
                }
                y += LINE_HEIGHT
            }
        }

        fun drawJustifiedWrapped(text: String, paint: Paint = bodyPaint) {
            drawJustifiedWrappedAt(MARGIN, PAGE_WIDTH - (MARGIN * 2), text, paint)
        }

        fun drawCentered(text: String, paint: Paint) {
            val textWidth = paint.measureText(text)
            drawLineAt((PAGE_WIDTH - textWidth) / 2f, text, paint)
        }

        fun drawFullWidthSeparator() {
            newPageIfNeeded(12f)
            val linePaint = Paint().apply {
                color = android.graphics.Color.DKGRAY
                strokeWidth = 1.2f
            }
            canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, linePaint)
            y += 14f
        }

        fun drawMembreteLine(membrete: PatientMembrete) {
            newPageIfNeeded()
            var x = MARGIN
            fun drawField(label: String, value: String, addGap: Boolean = true) {
                val labelText = "$label: "
                canvas.drawText(labelText, x, y, boldPaint)
                x += boldPaint.measureText(labelText)
                canvas.drawText(value, x, y, bodyPaint)
                x += bodyPaint.measureText(value)
                if (addGap) {
                    val gap = "   "
                    canvas.drawText(gap, x, y, bodyPaint)
                    x += bodyPaint.measureText(gap)
                }
            }
            drawField("Nombre", membrete.displayNombre())
            drawField("Edad", membrete.displayEdad())
            drawField("Sexo", membrete.displaySexo())
            drawField("Fecha de nacimiento", membrete.displayFechaNacimiento(), addGap = false)
            y += LINE_HEIGHT
        }

        fun drawSectionTitleText(title: String) {
            drawLine("$title:", boldPaint)
        }

        fun drawSectionBody(text: String) {
            text.lines().forEach { line ->
                if (line.trim().isEmpty()) {
                    y += LINE_HEIGHT / 2
                    newPageIfNeeded(LINE_HEIGHT / 2)
                } else {
                    drawJustifiedWrapped(line.trim(), bodyPaint)
                }
            }
        }

        // Fecha del día: esquina superior derecha, encima del encabezado.
        drawReportDateTopRight()

        document.headerSnapshot?.let { header ->
            val headerStartY = y
            val pageCenterX = PAGE_WIDTH / 2f
            var logoBottom = headerStartY
            val hasLogo = header.logoPath?.let { path ->
                val logoFile = File(path)
                logoFile.exists() && BitmapFactory.decodeFile(path) != null
            } == true

            if (hasLogo) {
                BitmapFactory.decodeFile(header.logoPath!!)?.let { bitmap ->
                    val scaled = Bitmap.createScaledBitmap(
                        bitmap,
                        LOGO_SIZE.toInt(),
                        LOGO_SIZE.toInt(),
                        true,
                    )
                    canvas.drawBitmap(scaled, MARGIN, headerStartY, null)
                    logoBottom = headerStartY + LOGO_SIZE
                }
            }

            val sideReserve = if (hasLogo) MARGIN + LOGO_SIZE + LOGO_GAP else MARGIN
            val maxLineWidth = PAGE_WIDTH - (sideReserve * 2f)
            var textY = headerStartY + 18f

            fun drawHeaderText(text: String, paint: Paint) {
                val words = text.split(" ")
                var line = StringBuilder()
                fun flushLine() {
                    if (line.isEmpty()) return
                    val lineText = line.toString()
                    val lineWidth = paint.measureText(lineText)
                    val x = pageCenterX - (lineWidth / 2f)
                    newPageIfNeeded()
                    canvas.drawText(lineText, x, textY, paint)
                    textY += LINE_HEIGHT
                    line = StringBuilder()
                }
                for (word in words) {
                    val candidate = if (line.isEmpty()) word else "$line $word"
                    if (paint.measureText(candidate) > maxLineWidth) {
                        flushLine()
                        line = StringBuilder(word)
                    } else {
                        line = StringBuilder(candidate)
                    }
                }
                flushLine()
            }

            header.doctorName.takeIf { it.isNotBlank() }?.let { drawHeaderText(it, mainHeaderPaint) }
            header.subtitle.takeIf { it.isNotBlank() }?.let { drawHeaderText(it, secondaryHeaderPaint) }
            header.description.takeIf { it.isNotBlank() }?.let { drawHeaderText(it, descHeaderPaint) }

            y = maxOf(textY, logoBottom) + 8f
        }

        drawFullWidthSeparator()
        y += 10f

        drawCentered(document.type.reportTitle, titlePaint)
        y += 6f

        drawMembreteLine(membrete)
        y += 8f

        val sections = parseDocumentSections(sanitizeDocumentContent(document.content))
        sections.forEachIndexed { index, section ->
            if (index > 0) {
                y += LINE_HEIGHT / 2
                newPageIfNeeded(LINE_HEIGHT / 2)
            }
            val title = normalizeSectionTitle(section.title)
            if (title.isNotBlank()) {
                drawSectionTitleText(title)
            }
            if (section.body.isNotBlank()) {
                drawSectionBody(section.body)
            }
        }

        pdf.finishPage(page)
        FileOutputStream(file).use { pdf.writeTo(it) }
        pdf.close()
        return file
    }

    fun savePdfToDownloads(context: Context, document: ClinicalDocument): String {
        val source = generate(context, document)
        val displayName = buildString {
            append(document.typeLabel.replace(" ", "_"))
            append("_")
            append(document.patientNombre.replace(" ", "_").take(20))
            append(".pdf")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, displayName)
                put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("No se pudo guardar el PDF")
            resolver.openOutputStream(uri)?.use { out ->
                source.inputStream().use { it.copyTo(out) }
            }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return "Descargas/$displayName"
        }
        val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val dest = File(downloads, displayName)
        source.copyTo(dest, overwrite = true)
        return dest.absolutePath
    }

    fun sharePdf(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Compartir PDF"))
    }

    fun printPdf(context: Context, file: File, jobName: String = "Informe clínico") {
        val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
        val adapter = object : PrintDocumentAdapter() {
            override fun onLayout(
                oldAttributes: PrintAttributes?,
                newAttributes: PrintAttributes?,
                cancellationSignal: android.os.CancellationSignal?,
                callback: LayoutResultCallback?,
                extras: android.os.Bundle?,
            ) {
                callback?.onLayoutFinished(
                    PrintDocumentInfo.Builder(jobName)
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                        .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                        .build(),
                    true,
                )
            }

            override fun onWrite(
                pages: Array<out PageRange>?,
                destination: android.os.ParcelFileDescriptor?,
                cancellationSignal: android.os.CancellationSignal?,
                callback: WriteResultCallback?,
            ) {
                try {
                    FileInputStream(file).use { input ->
                        FileOutputStream(destination?.fileDescriptor).use { output ->
                            input.copyTo(output)
                        }
                    }
                    callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                } catch (e: Exception) {
                    callback?.onWriteFailed(e.message)
                }
            }
        }
        printManager.print(jobName, adapter, null)
    }
}
