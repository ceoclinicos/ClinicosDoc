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
        val bodySystems = systems.filter { it.id != "signos_vitales" }
        val namesInOrder = bodySystems.joinToString(", ") { it.name }

        return buildString {
            appendLine("SISTEMAS DE EXAMEN FÍSICO ACTIVOS (OBLIGATORIO incluir TODOS, en este orden):")
            systems.forEachIndexed { index, system ->
                appendLine("${index + 1}. ${system.name} [${system.id}]")
                if (system.id == "signos_vitales") {
                    appendLine("   → Solo si hay valores dictados; si no, omitir esta línea.")
                } else {
                    appendLine("   → Texto base (usar intacto si el dictado NO menciona este sistema):")
                    appendLine("     \"${system.name}: ${system.defaultText}\"")
                }
            }
            appendLine()
            appendLine("REGLAS OBLIGATORIAS DEL EXAMEN FÍSICO:")
            appendLine("- DEBES escribir TODOS los sistemas activos listados arriba, aunque el dictado solo mencione uno.")
            appendLine("- Ejemplo: si solo se dictó Extremidades, igual debes incluir General, Piel, Cabeza y cuello, Cardiopulmonar, Abdomen, Neurológico, etc. (los activos) con su texto base.")
            appendLine("- Solo el/los sistemas mencionados en el dictado se editan o reemplazan con los hallazgos dictados.")
            appendLine("- Los sistemas NO mencionados se copian EXACTAMENTE con su texto base (sin inventar patología ni omitirlos).")
            appendLine("- PROHIBIDO dejar solo el sistema dictado. PROHIBIDO omitir sistemas activos.")
            if (bodySystems.isNotEmpty()) {
                appendLine("- Formato: UNA línea por sistema, empezando con el nombre exacto: \"$namesInOrder\".")
                appendLine("- Orden exacto de aparición: $namesInOrder.")
            }
            if (vitalsSystem != null) {
                appendLine("- Signos vitales (si dictados): línea aparte al inicio, solo valores presentes.")
                appendLine("  Formato: TA: 120/80 mmHg | FR: 18 rpm | FC: 82 lpm | SaTO2: 98%")
                appendLine("- Signos no dictados: omitirlos (no escribas 0). Si no hay ningún signo, no pongas línea de vitales.")
            }
            appendLine("- Coloca cada signo en el sistema correcto (ej. Rovsing → Abdomen).")
            appendLine("- Si el dictado contradice la base de un sistema, sustituye SOLO ese sistema.")
            appendLine("- NO inventes hallazgos no dictados.")
        }
    }
}
