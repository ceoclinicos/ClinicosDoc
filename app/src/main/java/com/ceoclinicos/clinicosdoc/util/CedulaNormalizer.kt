package com.ceoclinicos.clinicosdoc.util

object CedulaNormalizer {
    fun normalize(input: String): String =
        input.trim().uppercase().replace(Regex("[\\s.-]"), "")

    fun isValid(input: String): Boolean = normalize(input).length >= 6
}
