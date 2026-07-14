package com.ceoclinicos.clinicosdoc.model

data class PhysicalExamSystem(
    val id: String,
    val name: String,
    val defaultText: String,
    val sortOrder: Int = 0,
)

object PhysicalExamDefaults {
    /** Orden clínico: signos → general → piel → cabeza/cuello → cardiopulmonar → resto. */
    val displayPriority: Map<String, Int> = mapOf(
        "signos_vitales" to 0,
        "general" to 1,
        "piel" to 2,
        "cabeza_cuello" to 3,
        "cardiopulmonar" to 4,
        "abdomen" to 5,
        "extremidades" to 6,
        "neurologico" to 7,
    )

    /** Reordena IDs activos al orden clínico fijo (ignora el orden de activación). */
    fun orderEnabledIds(ids: List<String>): List<String> {
        val unique = ids.distinct()
        return unique.sortedWith(
            compareBy(
                { displayPriority[it] ?: 100 },
                { it },
            ),
        )
    }

    fun priorityForName(name: String): Int {
        val n = name.trim().lowercase()
        return when {
            n.startsWith("signos") -> 0
            n.startsWith("general") -> 1
            n.startsWith("piel") -> 2
            n.startsWith("cabeza") -> 3
            n.startsWith("cardiopulmonar") || n.startsWith("cardio") -> 4
            n.startsWith("abdomen") -> 5
            n.startsWith("extremidades") -> 6
            n.startsWith("neurol") -> 7
            else -> 100
        }
    }

    val builtIn: List<PhysicalExamSystem> = listOf(
        PhysicalExamSystem(
            id = "signos_vitales",
            name = "Signos vitales",
            defaultText = "",
            sortOrder = 0,
        ),
        PhysicalExamSystem(
            id = "general",
            name = "General",
            defaultText = "Paciente en regulares condiciones generales, consciente, colaborador, eupneico, hidratado.",
            sortOrder = 1,
        ),
        PhysicalExamSystem(
            id = "piel",
            name = "Piel",
            defaultText = "Turgor y elasticidad conservados, sin lesiones primarias ni secundarias.",
            sortOrder = 2,
        ),
        PhysicalExamSystem(
            id = "cabeza_cuello",
            name = "Cabeza y cuello",
            defaultText = "Normocéfalo; cuello móvil, sin adenomegalias ni ingurgitación yugular.",
            sortOrder = 3,
        ),
        PhysicalExamSystem(
            id = "cardiopulmonar",
            name = "Cardiopulmonar",
            defaultText = "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
            sortOrder = 4,
        ),
        PhysicalExamSystem(
            id = "abdomen",
            name = "Abdomen",
            defaultText = "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
            sortOrder = 5,
        ),
        PhysicalExamSystem(
            id = "extremidades",
            name = "Extremidades",
            defaultText = "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
            sortOrder = 6,
        ),
        PhysicalExamSystem(
            id = "neurologico",
            name = "Neurológico",
            defaultText = "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
            sortOrder = 7,
        ),
    )

    val defaultEnabledIds: List<String> = listOf(
        "signos_vitales",
        "general",
        "piel",
        "cabeza_cuello",
        "cardiopulmonar",
        "abdomen",
        "extremidades",
        "neurologico",
    )
}
