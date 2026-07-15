package com.ceoclinicos.clinicosdoc.util

object CedulaNormalizer {
    fun normalize(input: String): String =
        input.trim().uppercase().replace(Regex("[\\s.-]"), "")

    fun isValid(input: String): Boolean = normalize(input).length >= 6

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
        }
        if (raw.startsWith("V") && raw.drop(1).all { it.isDigit() }) {
            keys += raw.drop(1)
        }
        if (raw.startsWith("E") && raw.drop(1).all { it.isDigit() }) {
            keys += raw.drop(1)
        }
        return keys.toList()
    }

    fun digitsOnly(input: String): String = normalize(input).filter { it.isDigit() }
}
