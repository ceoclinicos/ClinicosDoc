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
        "ojos" to 4,
        "oidos" to 5,
        "nariz" to 6,
        "boca_faringe" to 7,
        "cardiopulmonar" to 8,
        "abdomen" to 9,
        "extremidades" to 10,
        "neurologico" to 11,
    )

    /** Conserva el orden recibido (plantilla/catálogo). Solo elimina duplicados. */
    fun orderEnabledIds(ids: List<String>): List<String> = ids.distinct()

    fun priorityForName(name: String): Int {
        val n = name.trim().lowercase()
        return when {
            n.startsWith("signos") -> 0
            n.startsWith("general") -> 1
            n.startsWith("piel") -> 2
            n.startsWith("cabeza") -> 3
            n.startsWith("ojos") -> 4
            n.startsWith("oidos") || n.startsWith("oídos") -> 5
            n.startsWith("nariz") -> 6
            n.startsWith("boca") || n.startsWith("faringe") -> 7
            n.startsWith("cardiopulmonar") || n.startsWith("cardio") -> 8
            n.startsWith("abdomen") -> 9
            n.startsWith("extremidades") -> 10
            n.startsWith("neurol") -> 11
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
            id = "ojos",
            name = "Ojos",
            defaultText = "Agudeza visual conservada. Pupilas isocóricas, normorreactivas a la luz y acomodación. Movimientos oculares conservados. Conjuntivas rosadas, escleras anictéricas. Reflejo foveal presente, retina sin exudados ni hemorragias.",
            sortOrder = 4,
        ),
        PhysicalExamSystem(
            id = "oidos",
            name = "Oídos",
            defaultText = "Pabellones auriculares normoinsertos, simétricos e indoloros al trago/tracción. Conductos auditivos externos permeables, sin masas ni secreciones. Membranas timpánicas íntegras, gris perla, cono luminoso y relieves anatómicos conservados bilateralmente.",
            sortOrder = 5,
        ),
        PhysicalExamSystem(
            id = "nariz",
            name = "Nariz",
            defaultText = "Pirámide nasal simétrica. Tabique centrado, mucosa permeable y rosada. Cornetes inferiores de tamaño normal sin hipertrofia. No se observan pólipos, masas ni secreciones patológicas. Ventilación nasal bilateral conservada.",
            sortOrder = 6,
        ),
        PhysicalExamSystem(
            id = "boca_faringe",
            name = "Boca y Faringe",
            defaultText = "Mucosa oral húmeda y rosada. Dentadura completa/en buen estado, encías sin sangrado. Lengua centrada y móvil. Úvula central. Amígdalas palatinas Grado I/IV sin exudado. Faringe posterior normoémica, sin secreción ni petequias.",
            sortOrder = 7,
        ),
        PhysicalExamSystem(
            id = "cardiopulmonar",
            name = "Cardiopulmonar",
            defaultText = "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
            sortOrder = 8,
        ),
        PhysicalExamSystem(
            id = "abdomen",
            name = "Abdomen",
            defaultText = "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
            sortOrder = 9,
        ),
        PhysicalExamSystem(
            id = "extremidades",
            name = "Extremidades",
            defaultText = "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
            sortOrder = 10,
        ),
        PhysicalExamSystem(
            id = "neurologico",
            name = "Neurológico",
            defaultText = "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
            sortOrder = 11,
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

    /**
     * Ejemplos de estilo cuando el dictado aporta hallazgos patológicos.
     * No sustituyen el texto base normal; solo guían la redacción.
     */
    val pathologicalStyleExamples: Map<String, String> = mapOf(
        "cardiopulmonar" to
            "Tórax simétrico, normoexpansible, se auscultan sibilantes en hemitórax derecho o bilaterales, " +
            "ruidos cardiacos hipofonéticos, no soplo, no galope.",
        "abdomen" to
            "Globoso a expensas de panículo adiposo (inicie por apariencia: plano, globoso, batracio o en delantal), " +
            "ruidos hidroaéreos disminuidos, doloroso a la palpación en flanco e hipocondrio derecho.",
        "extremidades" to
            "Se evidencia aumento de volumen y limitación funcional a la flexoextensión activa y pasiva " +
            "de la rodilla derecha, pulsos distales conservados. Resto de extremidades simétricas, eutróficas, sin edema.",
        "neurologico" to
            "Obnubilado, lenguaje no coherente, desorientado en tiempo, espacio y persona, Glasgow 12/15 puntos.",
    )
}
