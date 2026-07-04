package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate

object PhysicalExamPromptBuilder {
    fun buildBlock(context: Context, template: DocumentTemplate): String {
        val systems = PhysicalExamCatalogStorage.resolvedForTemplate(
            context,
            template.enabledPhysicalExamSystemIds,
        )
        if (systems.isEmpty()) return ""

        return buildString {
            appendLine("SISTEMAS DE EXAMEN FÍSICO ACTIVOS (solo estos bloques; configurados en la plantilla):")
            systems.forEach { system ->
                appendLine("• ${system.name} [${system.id}]:")
                appendLine("  Base normal: ${system.defaultText}")
            }
            appendLine()
            appendLine("REGLAS DE REDACCIÓN DEL EXAMEN FÍSICO:")
            appendLine("- Usa UNA línea por sistema activo: \"${systems.first().name}: ...\" (nombre exacto del catálogo).")
            appendLine("- Parte del texto base de cada sistema.")
            appendLine("- Si el dictado trae hallazgos de un sistema, MEZCLA o REEMPLAZA solo en ese bloque.")
            appendLine("- Coloca cada signo en el sistema correcto (ej. Rovsing y dolor FID → Abdomen).")
            appendLine("- Si el dictado contradice la base, sustituye esa parte (ej. sin ruidos hidroaéreos).")
            appendLine("- NO inventes signos ni síntomas no dictados.")
            appendLine("- Sistemas activos sin datos en el dictado conservan el texto base normal.")
        }
    }
}
