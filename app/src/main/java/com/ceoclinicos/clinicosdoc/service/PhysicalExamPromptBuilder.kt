package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate

object PhysicalExamPromptBuilder {
    fun buildBlock(
        context: Context,
        template: DocumentTemplate,
        textOverrides: Map<String, String> = emptyMap(),
    ): String {
        val systems = PhysicalExamCatalogStorage.resolvedForReport(
            context,
            template.enabledPhysicalExamSystemIds,
            textOverrides,
        )
        if (systems.isEmpty()) return ""

        val vitalsSystem = systems.firstOrNull { it.id == "signos_vitales" }

        return buildString {
            appendLine("SISTEMAS DE EXAMEN FÍSICO ACTIVOS (solo estos bloques; orden de redacción):")
            systems.forEach { system ->
                appendLine("• ${system.name} [${system.id}]:")
                appendLine("  Base normal: ${system.defaultText}")
            }
            appendLine()
            appendLine("REGLAS DE REDACCIÓN DEL EXAMEN FÍSICO:")
            if (vitalsSystem != null) {
                appendLine("- Signos vitales: escribe SOLO los valores dictados (TA, FR, FC, SaTO2).")
                appendLine("- Formato ejemplo con todos: TA: 120/80 mmHg | FR: 18 rpm | FC: 82 lpm | SaTO2: 98%")
                appendLine("- Si un signo NO fue dictado o no tiene valor, OMITIRLO (no escribas 0 ni ---).")
                appendLine("- Si ningún signo vital fue dictado, NO escribas línea de signos vitales.")
            }
            val bodySystems = systems.filter { it.id != "signos_vitales" }
            if (bodySystems.isNotEmpty()) {
                appendLine("- Luego UNA línea por cada sistema activo (excepto signos vitales ya en línea 1):")
                appendLine("  \"${bodySystems.first().name}: ...\" (nombre exacto del catálogo).")
            }
            appendLine("- Parte del texto base de cada sistema.")
            appendLine("- Si el dictado trae hallazgos de un sistema, MEZCLA o REEMPLAZA solo en ese bloque.")
            appendLine("- Coloca cada signo en el sistema correcto (ej. Rovsing y dolor FID → Abdomen).")
            appendLine("- Si el dictado contradice la base, sustituye esa parte (ej. sin ruidos hidroaéreos).")
            appendLine("- NO inventes signos ni síntomas no dictados.")
            appendLine("- Sistemas activos sin datos en el dictado conservan el texto base normal.")
        }
    }
}
