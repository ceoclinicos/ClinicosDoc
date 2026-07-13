package com.ceoclinicos.clinicosdoc.model

data class PhysicalExamSystem(
    val id: String,
    val name: String,
    val defaultText: String,
    val sortOrder: Int = 0,
)

object PhysicalExamDefaults {
    val builtIn: List<PhysicalExamSystem> = listOf(
        PhysicalExamSystem(
            id = "general",
            name = "General",
            defaultText = "Paciente en regulares condiciones generales, consciente, colaborador, eupneico, hidratado.",
            sortOrder = 0,
        ),
        PhysicalExamSystem(
            id = "signos_vitales",
            name = "Signos vitales",
            defaultText = "",
            sortOrder = 1,
        ),
        PhysicalExamSystem(
            id = "piel",
            name = "Piel",
            defaultText = "Turgor y elasticidad conservados, sin lesiones primarias ni secundarias.",
            sortOrder = 2,
        ),
        PhysicalExamSystem(
            id = "cardiopulmonar",
            name = "Cardiopulmonar",
            defaultText = "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
            sortOrder = 3,
        ),
        PhysicalExamSystem(
            id = "abdomen",
            name = "Abdomen",
            defaultText = "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
            sortOrder = 4,
        ),
        PhysicalExamSystem(
            id = "extremidades",
            name = "Extremidades",
            defaultText = "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
            sortOrder = 5,
        ),
        PhysicalExamSystem(
            id = "neurologico",
            name = "Neurológico",
            defaultText = "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
            sortOrder = 6,
        ),
        PhysicalExamSystem(
            id = "cabeza_cuello",
            name = "Cabeza y cuello",
            defaultText = "Normocéfalo; cuello móvil, sin adenomegalias ni ingurgitación yugular.",
            sortOrder = 7,
        ),
    )

    val defaultEnabledIds: List<String> = listOf(
        "general",
        "signos_vitales",
        "cardiopulmonar",
        "abdomen",
        "extremidades",
        "neurologico",
    )
}
