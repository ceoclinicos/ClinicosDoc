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
                appendLine("- Línea 1 SIEMPRE signos vitales con formato:")
                appendLine("  TA: [valor] mmHg | FR: [valor] rpm | FC: [valor] lpm | SaTO2: [valor]%")
                appendLine("- Signos vitales NO dictados se escriben como 0 (ej. TA: 0 mmHg | FR: 0 rpm | FC: 82 lpm | SaTO2: 0%).")
                appendLine("- Signos vitales dictados conservan el valor exacto del dictado.")
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
