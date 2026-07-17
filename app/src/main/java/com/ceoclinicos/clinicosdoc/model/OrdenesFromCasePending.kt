package com.ceoclinicos.clinicosdoc.model

/** Payload temporal para navegar a generar órdenes desde un informe/HC. */
object OrdenesFromCasePending {
    data class Payload(
        val patientId: String,
        val caseContent: String,
        val sourceDocumentId: String? = null,
        val headerId: String? = null,
        val sourceTypeLabel: String = "",
    )

    @Volatile
    var payload: Payload? = null

    fun take(): Payload? {
        val p = payload
        payload = null
        return p
    }

    fun set(p: Payload) {
        payload = p
    }
}
