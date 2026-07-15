package com.ceoclinicos.clinicosdoc.model

data class HeaderInfoLine(
    val label: String,
    val value: String,
)

data class DocumentHeader(
    val id: String,
    val name: String,
    val logoPath: String? = null,
    /** JPEG en base64 para sync Firestore (sin Storage). */
    val logoBase64: String? = null,
    val doctorName: String,
    val subtitle: String,
    val description: String,
    val infoLines: List<HeaderInfoLine>,
    val isDefault: Boolean = false,
    val headerType: HeaderType = HeaderType.MEDICO,
) {
    val displayTitle: String
        get() = doctorName.trim().ifBlank {
            if (headerType == HeaderType.CLINICA) "Clínica" else "Médico"
        }
    fun toPlainTextBlock(): String {
        val buffer = StringBuilder()
        if (doctorName.trim().isNotEmpty()) buffer.appendLine(doctorName.trim())
        if (subtitle.trim().isNotEmpty()) buffer.appendLine(subtitle.trim())
        if (description.trim().isNotEmpty()) buffer.appendLine(description.trim())
        return buffer.toString().trim()
    }

    companion object {
        fun emptyInfoLines(): List<HeaderInfoLine> = emptyList()
    }
}
