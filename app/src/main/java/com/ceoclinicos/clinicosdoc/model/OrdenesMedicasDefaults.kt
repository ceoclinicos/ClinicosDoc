package com.ceoclinicos.clinicosdoc.model

/**
 * Molde y pautas de Órdenes médicas (IA + plantilla editable).
 * El usuario puede personalizar el ejemplo en la plantilla; la IA lo usa como estilo.
 */
object OrdenesMedicasDefaults {

    const val SECTION_ORDENES = "Órdenes"

    enum class Modo(val label: String, val storageKey: String) {
        EMERGENCIA("Tratamiento de emergencia", "emergencia"),
        AMBULATORIO("Ambulatorio", "ambulatorio"),
        ORDENES("Órdenes médicas", "ordenes"),
        ;

        companion object {
            fun fromKey(key: String): Modo =
                entries.firstOrNull { it.storageKey.equals(key, ignoreCase = true) } ?: ORDENES
        }
    }

    /** Ejemplo editable en plantilla (estilo de ítems). */
    val MOLDE_EJEMPLO = """
        1. Hospitalizar paciente a cargo del servicio de Cirugía.
        2. Dieta líquida.
        3. Hidratación parenteral: 1000 cc de solución 0,9 % a 21 gotas por minuto en 24 horas.
        4. Omeprazol 40 mg EV OD.
        5. Ketoprofeno 100 mg EV cada 12 horas.
        6. Metoclopramida 10 mg EV SOS náuseas/vómitos.
        7. Control de signos vitales cada 4 horas.
        8. Balance hídrico estricto.
        9. Reposo relativo en cama.
        10. Solicitar laboratorios: hematología completa, química sanguínea, amilasa/lipasa.
        11. Interconsulta a Medicina Interna.
        12. Informar al médico de guardia ante deterioro clínico.
    """.trimIndent()

    private fun modeGuidelines(modo: Modo): String = when (modo) {
        Modo.EMERGENCIA -> """
            MODO: Tratamiento de emergencia.
            - Prioriza estabilización, vía EV, oxígeno si aplica, monitorización y alarmas.
            - Incluye hospitalizar / observación si el caso lo amerita.
            - Evita esquemas solo ambulatorios (VO a domicilio) salvo que el caso lo indique.
        """.trimIndent()
        Modo.AMBULATORIO -> """
            MODO: Ambulatorio.
            - NO hospitalizar ni hidratación parenteral salvo indicación explícita en el caso.
            - Preferir vía oral / ambulatoria; controles y signos de alarma para consulta.
            - Omite O₂ EV hospitalario si no aplica al manejo ambulatorio.
        """.trimIndent()
        Modo.ORDENES -> """
            MODO: Órdenes médicas (hospitalarias / generales).
            - Usa el orden estándar completo según el caso (hospitalizar si aplica, dieta, O₂, líquidos, protector, resto).
        """.trimIndent()
    }

    fun promptGuidelines(moldePersonalizado: String, modo: Modo = Modo.ORDENES): String {
        val molde = moldePersonalizado.trim().ifBlank { MOLDE_EJEMPLO }
        return """
            Para ÓRDENES MÉDICAS:
            - El encabezado y membrete del paciente los coloca la app. Tú generas SOLO la lista numerada.
            - Formato: línea [[SECTION:Órdenes]] y debajo SOLO ítems numerados 1. 2. 3. … (sin Motivo de consulta ni otras secciones clínicas del informe).
            - PROHIBIDO usar **. PROHIBIDO títulos de documento (ÓRDENES MÉDICAS lo pone la app).
            - Escribe fármacos concretos: nombre + dosis + vía + intervalo (ej. "Ceftriaxona 1 g EV cada 12 horas").
            - PROHIBIDO enunciados genéricos ("Antibioticoterapia según…", "Antipirético/analgésico:", "según esquema institucional").
            - Omite ítems que no apliquen al caso (si no necesita O₂ o protector gástrico, no los inventes).
            - Orden OBLIGATORIO de prioridad (renumerar al final; omite los que no apliquen):
              1) Hospitalizar (servicio a cargo) — solo si el modo y el caso lo requieren
              2) Dieta
              3) Oxígeno (solo si el caso lo requiere)
              4) Hidratación (parenteral solo si hospitalario/emergencia lo requiere)
              5) Protector gástrico (solo si aplica)
              6) Resto: analgésicos, antieméticos, antibióticos, otros fármacos, controles, labs, interconsultas, alarmas
            - Adapta servicio, dieta, líquidos, fármacos y labs al diagnóstico/caso (empírico o dirigido).
            - Suele haber ~8–14 ítems; ni demasiado corto ni relleno inventado.
            - Si hay notas/dictado adicionales del médico, priorízalas y completa con estilo del molde.

            ${modeGuidelines(modo)}

            MOLDE DE ESTILO (personalizable por el médico; imita redacción y nivel de detalle, NO copies el caso del ejemplo si no aplica):
            """"
            $molde
            """"
        """.trimIndent()
    }
}
