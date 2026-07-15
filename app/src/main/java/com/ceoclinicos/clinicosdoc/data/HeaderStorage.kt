package com.ceoclinicos.clinicosdoc.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.HeaderInfoLine
import com.ceoclinicos.clinicosdoc.model.HeaderType
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

data class LogoPersistResult(
    val path: String,
    val base64: String,
)

object HeaderStorage {
    private const val PREFS = "clinicos_doc_prefs"
    private const val KEY = "document_headers_json"
    private const val INITIALIZED_KEY = "headers_initialized"
    const val MAX_HEADERS = 4
    /** Tamaños cuadrados permitidos para el logo de encabezado. */
    val ALLOWED_LOGO_SIZES = setOf(256, 512)
    private const val JPEG_QUALITY = 85
    private val gson = Gson()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun canAdd(context: Context): Boolean = loadAll(context).size < MAX_HEADERS

    fun count(context: Context): Int = loadAll(context).size

    suspend fun ensureDefaults(context: Context) {
        if (prefs(context).getBoolean(INITIALIZED_KEY, false)) return
        val doctor = DoctorStorage.loadProfile(context)
        val header = DocumentHeader(
            id = UUID.randomUUID().toString(),
            name = "Encabezado principal",
            doctorName = doctor?.nombre ?: "",
            subtitle = doctor?.especialidad ?: "",
            description = "",
            infoLines = emptyList(),
            isDefault = true,
            headerType = HeaderType.MEDICO,
        )
        saveAllLocal(context, listOf(header))
        prefs(context).edit().putBoolean(INITIALIZED_KEY, true).persist()
        SyncCoordinator.afterHeaderSaved(context, header)
    }

    fun findById(context: Context, id: String): DocumentHeader? =
        loadAll(context).firstOrNull { it.id == id }

    fun loadAll(context: Context): List<DocumentHeader> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        val type = object : TypeToken<List<DocumentHeaderDto>>() {}.type
        return gson.fromJson<List<DocumentHeaderDto>>(raw, type)?.map { it.toModel() } ?: emptyList()
    }

    fun defaultHeader(context: Context): DocumentHeader? {
        val all = loadAll(context)
        if (all.isEmpty()) return null
        return all.firstOrNull { it.isDefault } ?: all.first()
    }

    fun resolveSelection(
        headerId: String?,
        headerSnapshot: DocumentHeader?,
        available: List<DocumentHeader>,
    ): DocumentHeader? {
        headerId?.let { id ->
            available.firstOrNull { it.id == id }?.let { return it }
        }
        headerSnapshot?.let { snapshot ->
            available.firstOrNull { it.id == snapshot.id }?.let { return it }
            return snapshot
        }
        return null
    }

    fun refreshSelection(
        selected: DocumentHeader?,
        available: List<DocumentHeader>,
    ): DocumentHeader? {
        selected ?: return null
        return available.firstOrNull { it.id == selected.id } ?: selected
    }

    fun saveAllLocal(context: Context, headers: List<DocumentHeader>) {
        val json = gson.toJson(headers.map { it.toDto() })
        prefs(context).edit().putString(KEY, json).persist()
    }

    fun saveAll(context: Context, headers: List<DocumentHeader>) {
        saveAllLocal(context, headers)
    }

    fun upsert(context: Context, header: DocumentHeader): DocumentHeader {
        val all = loadAll(context).toMutableList()
        val idx = all.indexOfFirst { it.id == header.id }
        if (idx < 0 && all.size >= MAX_HEADERS) {
            return all.firstOrNull() ?: header
        }
        if (header.isDefault) {
            for (i in all.indices) {
                if (all[i].id != header.id) {
                    all[i] = all[i].copy(isDefault = false)
                }
            }
        }
        if (idx >= 0) all[idx] = header else all.add(header)
        saveAllLocal(context, all.take(MAX_HEADERS))
        SyncCoordinator.afterHeaderSaved(context, header)
        return header
    }

    fun delete(context: Context, id: String) {
        val all = loadAll(context)
        all.firstOrNull { it.id == id }?.logoPath?.let { path ->
            File(path).takeIf { it.exists() }?.delete()
        }
        saveAllLocal(context, all.filterNot { it.id == id })
        SyncCoordinator.afterHeaderDeleted(context, id)
    }

    /**
     * Valida tamaño 256×256 o 512×512, comprime a JPEG y guarda local + base64.
     */
    fun persistLogo(context: Context, uri: Uri, headerId: String): LogoPersistResult {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { input ->
            BitmapFactory.decodeStream(input, null, bounds)
        } ?: error("No se pudo leer la imagen")
        val w = bounds.outWidth
        val h = bounds.outHeight
        if (w != h || w !in ALLOWED_LOGO_SIZES) {
            error("El logo debe ser cuadrado de 256×256 o 512×512 píxeles (recibido ${w}×${h})")
        }
        val bitmap = context.contentResolver.openInputStream(uri)?.use { input ->
            BitmapFactory.decodeStream(input)
        } ?: error("No se pudo decodificar la imagen")
        val bytes = ByteArrayOutputStream().use { out ->
            if (!bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)) {
                bitmap.recycle()
                error("No se pudo comprimir el logo")
            }
            bitmap.recycle()
            out.toByteArray()
        }
        val logosDir = File(context.filesDir, "header_logos").apply { mkdirs() }
        val dest = File(logosDir, "$headerId.jpg")
        dest.writeBytes(bytes)
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        return LogoPersistResult(path = dest.absolutePath, base64 = base64)
    }

    /** Escribe logo desde base64 de Firestore a archivo local. */
    fun materializeLogo(context: Context, headerId: String, base64: String?): String? {
        if (base64.isNullOrBlank()) return null
        return runCatching {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val logosDir = File(context.filesDir, "header_logos").apply { mkdirs() }
            val dest = File(logosDir, "$headerId.jpg")
            dest.writeBytes(bytes)
            dest.absolutePath
        }.getOrNull()
    }

    fun withMaterializedLogo(context: Context, header: DocumentHeader): DocumentHeader {
        val path = materializeLogo(context, header.id, header.logoBase64)
            ?: header.logoPath?.takeIf { File(it).exists() }
        return header.copy(logoPath = path)
    }

    /** Si hay archivo local y falta base64, lo codifica para el sync. */
    fun ensureLogoBase64(header: DocumentHeader): DocumentHeader {
        if (!header.logoBase64.isNullOrBlank()) return header
        val path = header.logoPath?.takeIf { File(it).exists() } ?: return header
        return runCatching {
            val bytes = File(path).readBytes()
            header.copy(logoBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP))
        }.getOrDefault(header)
    }

    fun createClinic(): DocumentHeader = DocumentHeader(
        id = UUID.randomUUID().toString(),
        name = "Encabezado de clínica",
        doctorName = "",
        subtitle = "",
        description = "",
        infoLines = emptyList(),
        headerType = HeaderType.CLINICA,
    )

    fun createFromDoctor(doctor: DoctorProfile): DocumentHeader = DocumentHeader(
        id = UUID.randomUUID().toString(),
        name = "Encabezado médico",
        doctorName = doctor.nombre,
        subtitle = doctor.especialidad,
        description = "",
        infoLines = listOf(
            HeaderInfoLine("Cédula", doctor.cedula),
            HeaderInfoLine("MPPS", doctor.mpps),
            HeaderInfoLine("WhatsApp", doctor.whatsapp),
            HeaderInfoLine("RIF", ""),
        ),
        headerType = HeaderType.MEDICO,
    )

    private fun DocumentHeader.toDto() = DocumentHeaderDto(
        id = id,
        name = name,
        logoPath = logoPath,
        logoBase64 = logoBase64,
        doctorName = doctorName,
        subtitle = subtitle,
        description = description,
        infoLines = infoLines.map { HeaderInfoLineDto(it.label, it.value) },
        isDefault = isDefault,
        headerType = headerType.name,
    )

    private fun DocumentHeaderDto.toModel(): DocumentHeader {
        var lines = infoLines?.map { HeaderInfoLine(it.label ?: "", it.value ?: "") }
            ?: DocumentHeader.emptyInfoLines()
        while (lines.size < 4) {
            lines = lines + HeaderInfoLine("Dato ${lines.size + 1}", "")
        }
        return DocumentHeader(
            id = id,
            name = name,
            logoPath = logoPath,
            logoBase64 = logoBase64,
            doctorName = doctorName ?: "",
            subtitle = subtitle ?: "",
            description = description ?: "",
            infoLines = lines.take(4),
            isDefault = isDefault ?: false,
            headerType = HeaderType.fromStorage(headerType),
        )
    }
}
