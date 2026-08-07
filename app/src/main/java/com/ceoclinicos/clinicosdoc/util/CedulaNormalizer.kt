package com.ceoclinicos.clinicosdoc.util

object CedulaNormalizer {
    fun normalize(input: String): String {
        val raw = input.trim().uppercase().replace(Regex("[\\s.-]"), "")
        if (raw.isBlank()) return ""
        if (raw.matches(Regex("^[VE]\\d{6,9}$"))) return raw
        val digits = raw.filter { it.isDigit() }
        if (raw.matches(Regex("^\\d{6,9}$"))) return "V$raw"
        if (raw.firstOrNull() in listOf('V', 'E') && digits.length in 6..9) {
            return "${raw.first()}$digits"
        }
        if (digits.length in 6..9) return "V$digits"
        return raw
    }

    fun compose(letter: String, digitsInput: String): String {
        val digits = digitsInput.filter { it.isDigit() }
        if (digits.isEmpty()) return ""
        val L = if (letter.equals("E", ignoreCase = true)) "E" else "V"
        return "$L$digits"
    }

    fun isValid(input: String): Boolean = normalize(input).length >= 7

    fun isValidDigits(digitsInput: String): Boolean {
        val digits = digitsInput.filter { it.isDigit() }
        return digits.length in 6..9
    }

    /** Claves para buscar doc en Firestore (`pacientes`, etc.). */
    fun lookupKeys(input: String): List<String> {
        val raw = normalize(input)
        if (raw.isBlank()) return emptyList()
        val keys = linkedSetOf(raw)
        val digits = raw.filter { it.isDigit() }
        if (digits.length in 6..9) {
            keys += digits
            keys += "V$digits"
            keys += "E$digits"
            keys += "V-$digits"
            keys += "E-$digits"
        }
        if (raw.startsWith("V") && raw.drop(1).all { it.isDigit() }) {
            keys += raw.drop(1)
            keys += "V-${raw.drop(1)}"
        }
        if (raw.startsWith("E") && raw.drop(1).all { it.isDigit() }) {
            keys += raw.drop(1)
            keys += "E-${raw.drop(1)}"
        }
        return keys.toList()
    }

    fun digitsOnly(input: String): String = normalize(input).filter { it.isDigit() }

    fun letterOf(input: String): String {
        val n = normalize(input)
        return if (n.startsWith("E")) "E" else "V"
    }
}
