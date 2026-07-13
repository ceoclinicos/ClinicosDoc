package com.ceoclinicos.clinicosdoc.util

data class VitalSigns(
    val ta: String = "",
    val fr: String = "",
    val fc: String = "",
    val sato2: String = "",
) {
    fun hasAnyValue(): Boolean =
        isPresent(ta) || isPresent(fr) || isPresent(fc) || isPresent(sato2)

    /** Solo incluye signos con valor distinto de vacío o 0. */
    fun toLine(): String {
        val parts = buildList {
            if (isPresent(ta)) add("TA: ${ta.trim()} mmHg")
            if (isPresent(fr)) add("FR: ${fr.trim()} rpm")
            if (isPresent(fc)) add("FC: ${fc.trim()} lpm")
            if (isPresent(sato2)) add("SaTO2: ${sato2.trim()}%")
        }
        return parts.joinToString(" | ")
    }

    companion object {
        fun isPresent(value: String): Boolean {
            val v = value.trim()
            if (v.isEmpty()) return false
            if (v == "0" || v == "0.0" || v == "0/0" || v.equals("---", ignoreCase = true)) return false
            return true
        }
    }
}

object VitalSignsParser {
    private val vitalLineHint = Regex(
        """(?i)(TA:|FR:|FC:|SaTO2:)""",
    )
    private val taRegex = Regex("""(?i)TA:\s*([^\s|]+)\s*mmHg""")
    private val frRegex = Regex("""(?i)FR:\s*([^\s|]+)\s*rpm""")
    private val fcRegex = Regex("""(?i)FC:\s*([^\s|]+)\s*lpm""")
    private val sato2Regex = Regex("""(?i)SaTO2:\s*([^\s|]+)\s*%""")

    fun isPhysicalExam(title: String): Boolean =
        title.equals("Examen físico", ignoreCase = true) ||
            Regex("""(?i)examen\s+f[ií]sico""").containsMatchIn(title)

    /** Extrae signos vitales de la primera línea del body (si existe). */
    fun parseFromBody(body: String): VitalSigns {
        val firstLine = body.lineSequence().firstOrNull { it.isNotBlank() }.orEmpty().trim()
        if (!vitalLineHint.containsMatchIn(firstLine)) return VitalSigns()
        return VitalSigns(
            ta = taRegex.find(firstLine)?.groupValues?.getOrNull(1).orEmpty(),
            fr = frRegex.find(firstLine)?.groupValues?.getOrNull(1).orEmpty(),
            fc = fcRegex.find(firstLine)?.groupValues?.getOrNull(1).orEmpty(),
            sato2 = sato2Regex.find(firstLine)?.groupValues?.getOrNull(1).orEmpty(),
        )
    }

    fun hasVitalSignsLine(body: String): Boolean {
        val firstLine = body.lineSequence().firstOrNull { it.isNotBlank() }.orEmpty()
        return vitalLineHint.containsMatchIn(firstLine.trim())
    }

    /** Reemplaza, inserta o elimina la línea de signos vitales según valores presentes. */
    fun applyToBody(body: String, vitals: VitalSigns): String {
        val lines = body.lines().toMutableList()
        val firstNonBlank = lines.indexOfFirst { it.isNotBlank() }
        val newLine = vitals.toLine()

        fun removeVitalLine(): String {
            if (firstNonBlank >= 0 && vitalLineHint.containsMatchIn(lines[firstNonBlank].trim())) {
                lines.removeAt(firstNonBlank)
            }
            return lines.joinToString("\n").trimStart('\n')
        }

        if (newLine.isBlank()) return removeVitalLine()

        return when {
            firstNonBlank < 0 -> newLine
            vitalLineHint.containsMatchIn(lines[firstNonBlank].trim()) -> {
                lines[firstNonBlank] = newLine
                lines.joinToString("\n")
            }
            else -> {
                lines.add(firstNonBlank.coerceAtLeast(0), newLine)
                lines.joinToString("\n")
            }
        }
    }

    /** Body sin la línea de signos vitales (para editar el resto). */
    fun bodyWithoutVitals(body: String): String {
        val lines = body.lines().toMutableList()
        val firstNonBlank = lines.indexOfFirst { it.isNotBlank() }
        if (firstNonBlank >= 0 && vitalLineHint.containsMatchIn(lines[firstNonBlank].trim())) {
            lines.removeAt(firstNonBlank)
        }
        return lines.joinToString("\n").trimStart('\n')
    }
}
