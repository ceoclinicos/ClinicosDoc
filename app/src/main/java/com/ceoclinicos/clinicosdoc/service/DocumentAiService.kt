package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import com.ceoclinicos.clinicosdoc.config.AiConfig
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.ReportSessionConfig
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.model.SectionDefaults
import com.ceoclinicos.clinicosdoc.util.DocumentSection
import com.ceoclinicos.clinicosdoc.util.cleanSectionBody
import com.ceoclinicos.clinicosdoc.util.normalizeSectionTitle
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections
import com.ceoclinicos.clinicosdoc.util.sanitizeDocumentContent
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object DocumentAiService {
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
        .withZone(ZoneId.systemDefault())

    suspend fun generateDocument(
        context: Context,
        template: DocumentTemplate,
        patient: Patient,
        doctor: DoctorProfile,
        dictation: String,
        header: DocumentHeader? = null,
        sessionConfig: ReportSessionConfig? = null,
    ): String {
        AiConfig.load(context.applicationContext)
        val effectiveTemplate = sessionConfig?.applyTo(template) ?: template
        val headerBlock = header?.toPlainTextBlock()
        val textOverrides = sessionConfig?.physicalExamTextOverrides.orEmpty()
        val physicalExamBlock = PhysicalExamPromptBuilder.buildBlock(context, effectiveTemplate, textOverrides)
        val enfermedadEjemplo = sessionConfig?.enfermedadActualEjemplo.orEmpty()

        val system = """
            Eres un asistente médico que redacta y mejora documentos clínicos en español.
            Tu trabajo es transformar el dictado del médico en un texto profesional, claro y legible.
            Corrige ortografía, gramática y puntuación.
            Convierte expresiones coloquiales a terminología médica equivalente (ej. "no mueve bien el codo" → "limitación funcional a la flexo-extensión del codo"), sin cambiar el significado clínico.
            Organiza el contenido en párrafos fluidos y coherentes.
            No inventes hallazgos clínicos patológicos que contradigan el dictado.
            En INFORME MÉDICO: si no hay examen físico dictado, usa la plantilla base normal; completa con la plantilla los sistemas no mencionados.
            En HISTORIA CLÍNICA: respeta el orden de secciones de la plantilla; redacta con tecnicismo universitario venezolano (estilo de referencia, no copiar formato manuscrito).
            Si una sección activa no tiene datos en el dictado, usa el TEXTO PREDETERMINADO de esa sección (no inventes patología nueva).
            Usa terminología médica apropiada para Venezuela/Latinoamérica.
        """.trimIndent()

        val prompt = buildString {
            appendLine("Genera el cuerpo clínico usando la plantilla \"${template.name}\" (${template.documentType.label}).")
            appendLine()
            appendLine("DATOS DEL MÉDICO (referencia, no incluir en el texto):")
            appendLine("- Nombre: ${doctor.nombre}")
            appendLine("- Especialidad: ${doctor.especialidad}")
            appendLine()
            appendLine("DATOS DEL PACIENTE (referencia, NO incluir en el texto):")
            appendLine("- Nombre: ${patient.nombre}, Edad: ${patient.edad} años, Sexo: ${patient.sexo.ifBlank { "—" }}")
            appendLine()
            appendLine("DICTADO DEL MÉDICO (mejorar redacción y técnica, conservar el contenido clínico):")
            appendLine("\"\"\"")
            appendLine(dictation)
            appendLine("\"\"\"")
            appendLine()
            appendLine("Instrucciones obligatorias:")
            appendLine("1. Mejora la redacción del dictado: corrige errores, ordena ideas y usa lenguaje médico apropiado.")
            appendLine("2. NO incluyas título del documento (INFORME MÉDICO, HISTORIA CLÍNICA, REPOSO MÉDICO).")
            appendLine("3. NO incluyas encabezado institucional ni identificación del paciente.")
            appendLine("4. NO incluyas sección \"Datos del paciente\".")
            appendLine("5. Responde SOLO con el cuerpo clínico redactado.")
            appendLine()
            appendEnfermedadActualHint(enfermedadEjemplo, template.documentType)

            when (template.documentType) {
                DocumentType.HISTORIA_CLINICA -> {
                    appendLine("Para HISTORIA CLÍNICA ignora detección libre de secciones.")
                    appendLine("Genera UNA sección por cada ítem de la plantilla, en el orden exacto indicado.")
                    appendLine("Formato de cada sección: línea [[SECTION:Nombre exacto]] y contenido debajo.")
                    appendLine("PROHIBIDO usar ** para títulos. NO incluyas \"Identificación del paciente\" (la app ya la muestra).")
                    appendLine("Las imágenes/modelos de historia clínica universitaria son REFERENCIA DE TECNICISMO Y REDACCIÓN, no para copiar numeración romana, extensión párrafo a párrafo ni subsecciones literales.")
                    appendLine("Adapta la profundidad al dictado: si el médico fue breve, redacta breve; si fue detallado, amplía con lenguaje semiológico apropiado.")
                    appendLine()
                    val effectiveSections = effectiveTemplate.normalizedSections()
                        .filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
                    val sectionsList = effectiveSections.joinToString("\n") { "- $it" }
                    appendLine("Secciones de la plantilla (orden obligatorio):")
                    appendLine(sectionsList)
                    appendLine()
                    appendLine("Guía de estilo técnico por sección (contenido, no formato fijo):")
                    appendLine("- Motivo de consulta: frase breve, terminología clínica directa.")
                    appendLine("- Enfermedad actual: narrativa cronológica; tiempos, evolución, consultas, paraclínicos y tratamientos si el dictado los trae.")
                    appendLine("- Antecedentes personales: lenguaje semiológico; puede agrupar fisiológicos, socioeconómicos, vacunas y patológicos; \"Niega...\" para negativos.")
                    appendLine("- Antecedentes familiares: relaciones, edades y causas si se conocen; sin inventar.")
                    appendLine("- Hábitos psicobiológicos: tóxicos, hábitos intestinales/urinarios, sexuales, sueño; psicobiografía solo si hay datos.")
                    appendLine("- Examen funcional: lo que REFIERE el paciente por sistemas; distinto del examen físico objetivo.")
                    appendLine("- Examen físico: lo que EXPLORA el médico; semiología por regiones. Plantilla base solo si no hay dictado de exploración.")
                    appendLine("- Diagnóstico: lista numerada al final; términos clínicos o CIE según el dictado.")
                    appendLine()
                    appendLine(SectionDefaults.promptBlock(effectiveSections))
                    appendLine("Omite de la respuesta las secciones que la plantilla no liste.")
                    if (physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                }
                DocumentType.INFORME -> {
                    appendLine("Para INFORME MÉDICO ignora la detección libre de secciones.")
                    appendLine("El encabezado institucional lo coloca la app; tú generas SOLO el cuerpo en 3 bloques.")
                    appendLine()
                    val sexoTexto = when (patient.sexo.lowercase()) {
                        "masculino", "m" -> "masculino"
                        "femenino", "f" -> "femenino"
                        else -> patient.sexo.ifBlank { "de sexo no referido" }
                    }
                    appendLine("ESTRUCTURA DEL DOCUMENTO (la app arma 1+2+3+4; tú escribes 2, 3 y 4):")
                    appendLine("1. ENCABEZADO → lo pone la app (NO lo escribas).")
                    appendLine("2. INICIO del informe → párrafo narrativo SIN título de sección.")
                    appendLine("3. EXAMEN FÍSICO → línea [[SECTION:Examen físico]] y contenido debajo.")
                    appendLine("4. DIAGNÓSTICO → línea [[SECTION:Diagnóstico]] al final con lista numerada.")
                    appendLine()
                    appendLine("═══ BLOQUE 2 (inicio del informe, SIN subtítulo) ═══")
                    appendLine("- Un párrafo narrativo profesional con el dictado.")
                    appendLine("- Inicia: \"Se trata de paciente $sexoTexto de ${patient.edad} años de edad...\"")
                    appendLine("- Incluye motivo, evento, síntomas y conducta médica SOLO según el dictado.")
                    appendLine("- Redacta semiológicamente lo referido; NO inventes síntomas ni signos.")
                    appendLine("- NO uses nombre ni cédula. NO uses ** ni título de sección.")
                    appendLine()
                    appendLine("Referencia de estilo (adapta al dictado y al paciente):")
                    appendLine("Se trata de paciente femenino de 31 años de edad quien posterior a traumatismo contuso en codo izquierdo presenta aumento de volumen y limitación funcional, por lo cual acude a este centro donde es evaluada por equipo médico de guardia, donde se indica tratamiento endovenoso y estudio de rayos X de miembro superior izquierdo.")
                    appendLine()
                    appendLine("═══ BLOQUE 3 — Examen físico ═══")
                    appendLine("- Primera línea EXACTA de la sección: [[SECTION:Examen físico]]")
                    appendLine("- NO uses asteriscos **. El contenido va en las líneas siguientes.")
                    appendLine("- Línea 1 de contenido (signos vitales), SOLO si hay valores dictados:")
                    appendLine("  Ejemplo: TA: 120/80 mmHg | FC: 82 lpm")
                    appendLine("- Signos NO dictados u con valor 0: OMITIRLOS (no escribas 0 ni ---).")
                    appendLine("- Si no hay ningún signo vital dictado, empieza directo con el resto del examen físico.")
                    appendLine("- Usa PLANTILLA BASE de examen físico (abajo). SIEMPRE debe existir esta sección.")
                    appendLine("- NUNCA escribas \"Examen físico\" dentro del párrafo inicial ni como texto suelto en el cuerpo.")
                    appendLine("- Si el dictado dice \"examen físico\", crea SIEMPRE [[SECTION:Examen físico]] y el contenido va DEBAJO, nunca en la misma línea.")
                    appendLine()
                    if (physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                    appendLine()
                    appendLine("═══ BLOQUE 4 — Diagnóstico ═══")
                    appendLine("- Primera línea EXACTA: [[SECTION:Diagnóstico]]")
                    appendLine("- Lista numerada: mínimo 1, máximo 4 diagnósticos según el dictado.")
                    appendLine("- Formato: 1. [diagnóstico]. 2. [diagnóstico].")
                    appendLine()
                    appendLine("REGLAS FINALES:")
                    appendLine("- Solo 3 bloques de texto (inicio + examen físico + diagnóstico).")
                    appendLine("- Formato sección: [[SECTION:Nombre]] en una línea, contenido debajo.")
                    appendLine("- PROHIBIDO usar ** para títulos de sección.")
                    appendLine("- No repitas el párrafo inicial dentro del examen físico.")
                }
                DocumentType.REPOSO -> {
                    val effectiveSections = effectiveTemplate.normalizedSections()
                        .filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
                    val sectionsList = effectiveSections.joinToString("\n") { "- $it" }
                    appendLine("Secciones en orden:")
                    appendLine(sectionsList)
                    appendLine("Cada sección con **título:** y contenido.")
                    appendLine(SectionDefaults.promptBlock(effectiveSections))
                }
            }

            if (!headerBlock.isNullOrBlank()) {
                appendLine()
                appendLine("Referencia del médico (no duplicar): $headerBlock")
            }
        }

        val raw = AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 4096)
        return sanitizeDocumentContent(raw)
    }

    suspend fun regenerateSection(
        context: Context,
        template: DocumentTemplate,
        patient: Patient,
        doctor: DoctorProfile,
        dictation: String,
        sectionTitle: String,
        currentSectionBody: String,
        otherSections: List<DocumentSection>,
        header: DocumentHeader? = null,
        sessionConfig: ReportSessionConfig? = null,
    ): String {
        AiConfig.load(context.applicationContext)
        val effectiveTemplate = sessionConfig?.applyTo(template) ?: template
        val normalizedTitle = normalizeSectionTitle(sectionTitle)
        val textOverrides = sessionConfig?.physicalExamTextOverrides.orEmpty()
        val physicalExamBlock = PhysicalExamPromptBuilder.buildBlock(context, effectiveTemplate, textOverrides)
        val enfermedadEjemplo = sessionConfig?.enfermedadActualEjemplo.orEmpty()
        val isPhysicalExam = normalizedTitle.equals(SectionCatalog.EXAMEN_FISICO, ignoreCase = true) ||
            Regex("""(?i)examen\s+f[ií]sico""").matches(normalizedTitle)
        val isDiagnostico = normalizedTitle.equals(SectionCatalog.DIAGNOSTICO, ignoreCase = true) ||
            Regex("""(?i)diagn[oó]stico""").matches(normalizedTitle)
        val isInformeIntro = template.documentType == DocumentType.INFORME && normalizedTitle.isBlank()

        val system = """
            Eres un asistente médico que redacta documentos clínicos en español.
            Regeneras UNA sola sección sin inventar hallazgos que contradigan el dictado.
            Usa terminología médica apropiada para Venezuela/Latinoamérica.
        """.trimIndent()

        val prompt = buildString {
            appendLine("Regenera SOLO una sección del ${template.documentType.label}.")
            appendLine("Plantilla: \"${template.name}\".")
            appendLine()
            appendLine("DATOS DEL PACIENTE (referencia, NO incluir en el texto):")
            appendLine("- Edad: ${patient.edad} años, Sexo: ${patient.sexo.ifBlank { "—" }}")
            appendLine()
            appendLine("DICTADO DEL MÉDICO (fuente principal):")
            appendLine("\"\"\"")
            appendLine(dictation)
            appendLine("\"\"\"")
            appendLine()
            if (otherSections.isNotEmpty()) {
                appendLine("OTRAS SECCIONES DEL DOCUMENTO (solo contexto; NO las regeneres ni copies):")
                otherSections.forEach { section ->
                    val title = normalizeSectionTitle(section.title).ifBlank { "(inicio sin título)" }
                    val preview = section.body.trim().take(280)
                    appendLine("- $title: $preview${if (section.body.length > 280) "…" else ""}")
                }
                appendLine()
            }
            if (currentSectionBody.isNotBlank()) {
                appendLine("TEXTO ACTUAL DE LA SECCIÓN (puedes mejorarlo; no estás obligado a copiarlo):")
                appendLine(currentSectionBody)
                appendLine()
            }
            appendLine("SECCIÓN A REGENERAR: ${normalizedTitle.ifBlank { "Inicio del informe (párrafo narrativo sin título)" }}")
            appendLine()
            appendLine("REGLAS OBLIGATORIAS:")
            appendLine("- Responde SOLO con el contenido de ESA sección.")
            appendLine("- NO incluyas [[SECTION:...]], **títulos** ni otras secciones.")
            appendLine("- NO incluyas nombre ni cédula del paciente.")
            appendLine("- NO inventes síntomas, signos ni diagnósticos no presentes en el dictado.")
            appendLine("- Mejora redacción, ortografía y semiología según el dictado.")
            appendLine()
            appendEnfermedadActualHint(enfermedadEjemplo, template.documentType, normalizedTitle)

            when {
                isInformeIntro -> {
                    val sexoTexto = when (patient.sexo.lowercase()) {
                        "masculino", "m" -> "masculino"
                        "femenino", "f" -> "femenino"
                        else -> patient.sexo.ifBlank { "de sexo no referido" }
                    }
                    appendLine("Tipo: párrafo inicial del INFORME MÉDICO (sin título).")
                    appendLine("- Inicia: \"Se trata de paciente $sexoTexto de ${patient.edad} años de edad...\"")
                    appendLine("- Motivo, evento, síntomas y conducta SOLO según el dictado.")
                }
                isPhysicalExam -> {
                    appendLine("Tipo: EXAMEN FÍSICO.")
                    appendLine("- Primera línea: signos vitales SOLO si hay valores dictados.")
                    appendLine("- Ejemplo: TA: 120/80 mmHg | FC: 82 lpm")
                    appendLine("- Signos NO dictados o en 0: OMITIRLOS (no escribas 0).")
                    appendLine("- Luego una línea por sistema activo del catálogo.")
                    if (physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                }
                isDiagnostico -> {
                    appendLine("Tipo: DIAGNÓSTICO.")
                    appendLine("- Lista numerada (1. 2. 3.); mínimo 1, máximo 4 según el dictado.")
                }
                template.documentType == DocumentType.HISTORIA_CLINICA -> {
                    appendLine("Tipo: sección de HISTORIA CLÍNICA.")
                    appendLine(sectionStyleHint(normalizedTitle))
                    if (isPhysicalExam && physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                }
                else -> {
                    appendLine("Tipo: sección \"${normalizedTitle.ifBlank { "contenido" }}\".")
                    if (currentSectionBody.isBlank()) {
                        appendLine("- Si el dictado no trae datos para esta sección, escribe \"No referido\".")
                    }
                }
            }

            header?.toPlainTextBlock()?.takeIf { it.isNotBlank() }?.let { block ->
                appendLine()
                appendLine("Referencia del médico (no duplicar): $block")
            }
        }

        val raw = AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 2048)
        return extractRegeneratedSectionBody(raw, normalizedTitle)
    }

    private fun StringBuilder.appendEnfermedadActualHint(
        ejemplo: String,
        documentType: DocumentType,
        sectionTitle: String = "",
    ) {
        if (ejemplo.isBlank()) return
        val applies = when (documentType) {
            DocumentType.HISTORIA_CLINICA ->
                sectionTitle.isBlank() ||
                    sectionTitle.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true)
            DocumentType.INFORME -> sectionTitle.isBlank()
            else -> false
        }
        if (!applies) return
        appendLine("EJEMPLO DE ESTILO para la narrativa clínica (referencia de redacción; adapta al dictado):")
        appendLine("\"\"\"")
        appendLine(ejemplo)
        appendLine("\"\"\"")
        appendLine()
    }

    private fun sectionStyleHint(title: String): String = when {
        title.equals(SectionCatalog.MOTIVO_CONSULTA, ignoreCase = true) ->
            "- Motivo de consulta: frase breve y directa."
        title.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true) ->
            "- Enfermedad actual: narrativa cronológica con tiempos, evolución y tratamientos del dictado."
        title.contains("Antecedentes personales", ignoreCase = true) ->
            "- Antecedentes personales: \"Niega...\" para negativos; no inventar."
        title.contains("Antecedentes familiares", ignoreCase = true) ->
            "- Antecedentes familiares: relaciones y causas si se conocen."
        title.contains("Hábitos", ignoreCase = true) ->
            "- Hábitos psicobiológicos: solo lo referido en el dictado."
        title.contains("Examen funcional", ignoreCase = true) ->
            "- Examen funcional: lo que REFIERE el paciente por sistemas."
        else -> "- Redacta con lenguaje semiológico apropiado al título de la sección."
    }

    private fun extractRegeneratedSectionBody(raw: String, sectionTitle: String): String {
        val sanitized = sanitizeDocumentContent(raw)
        val parsed = parseDocumentSections(sanitized)
        val matching = parsed.firstOrNull { section ->
            val title = normalizeSectionTitle(section.title)
            when {
                sectionTitle.isBlank() -> title.isBlank()
                else -> title.equals(sectionTitle, ignoreCase = true)
            }
        }
        val body = when {
            matching != null -> matching.body.ifBlank { sanitized }
            parsed.size == 1 && parsed.first().body.isNotBlank() -> parsed.first().body
            else -> sanitized.lines()
                .filterNot { line -> Regex("""^\[\[SECTION:[^\]]+]]\s*$""").matches(line.trim()) }
                .joinToString("\n")
        }
        return cleanSectionBody(body.trim(), sectionTitle)
    }

    private fun formatDate(instant: Instant): String = dateFormatter.format(instant)
}
