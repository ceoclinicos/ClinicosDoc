package com.ceoclinicos.clinicosdoc.service

import android.content.Context
import com.ceoclinicos.clinicosdoc.config.AiConfig
import com.ceoclinicos.clinicosdoc.data.EnfermedadActualStorage
import com.ceoclinicos.clinicosdoc.data.PhysicalExamCatalogStorage
import com.ceoclinicos.clinicosdoc.data.TemplateStorage
import com.ceoclinicos.clinicosdoc.model.DoctorProfile
import com.ceoclinicos.clinicosdoc.model.DocumentHeader
import com.ceoclinicos.clinicosdoc.model.DocumentTemplate
import com.ceoclinicos.clinicosdoc.model.DocumentType
import com.ceoclinicos.clinicosdoc.model.OrdenesMedicasDefaults
import com.ceoclinicos.clinicosdoc.model.Patient
import com.ceoclinicos.clinicosdoc.model.RecetaDefaults
import com.ceoclinicos.clinicosdoc.model.ReportSessionConfig
import com.ceoclinicos.clinicosdoc.model.SectionCatalog
import com.ceoclinicos.clinicosdoc.model.SectionDefaults
import com.ceoclinicos.clinicosdoc.util.DocumentSection
import com.ceoclinicos.clinicosdoc.util.cleanSectionBody
import com.ceoclinicos.clinicosdoc.util.normalizeSectionTitle
import com.ceoclinicos.clinicosdoc.util.parseDocumentSections
import com.ceoclinicos.clinicosdoc.util.sanitizeDocumentContent
import com.ceoclinicos.clinicosdoc.util.serializeDocumentSections
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
        val examSystems = PhysicalExamCatalogStorage.resolvedForReport(
            context,
            effectiveTemplate.enabledPhysicalExamSystemIds,
            textOverrides,
        )
        val enfermedadEjemplo = EnfermedadActualStorage.resolved(
            sessionConfig?.enfermedadActualEjemplo.orEmpty(),
            context,
        )

        val system = """
            Eres un asistente médico que redacta y mejora documentos clínicos en español.
            Tu trabajo es transformar el dictado del médico en un texto profesional, claro y legible.
            Corrige ortografía, gramática y puntuación.
            Convierte expresiones coloquiales a terminología médica equivalente (ej. "no mueve bien el codo" → "limitación funcional a la flexo-extensión del codo"), sin cambiar el significado clínico.
            Organiza el contenido en párrafos fluidos y coherentes.
            En INFORME MÉDICO / HISTORIA: el examen físico DEBE incluir TODOS los sistemas activos de la plantilla.
            Si el dictado solo menciona un sistema (ej. Extremidades), ese se adapta y LOS DEMÁS se copian con su texto base normal sin omitirlos.
            No inventes hallazgos clínicos patológicos que contradigan el dictado.
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
            appendLine("2. NO incluyas título del documento (INFORME MÉDICO, HISTORIA CLÍNICA, REPOSO MÉDICO, ÓRDENES MÉDICAS).")
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
                    appendLine(SectionDefaults.MOTIVO_CONSULTA_STYLE)
                    appendLine("- Enfermedad actual: narrativa cronológica; tiempos, evolución, consultas, paraclínicos y tratamientos si el dictado los trae.")
                    appendLine("- Antecedentes personales: lenguaje semiológico; puede agrupar fisiológicos, socioeconómicos, vacunas y patológicos; \"Niega...\" para negativos.")
                    appendLine("- Antecedentes familiares: relaciones, edades y causas si se conocen; sin inventar.")
                    appendLine("- Hábitos psicobiológicos: tóxicos, hábitos intestinales/urinarios, sexuales, sueño; psicobiografía solo si hay datos.")
                    appendLine("- Examen funcional: lo que REFIERE el paciente por sistemas; distinto del examen físico objetivo.")
                    appendLine("- Examen físico: lo que EXPLORA el médico. DEBE incluir TODOS los sistemas activos; solo modifica los dictados y conserva el texto base en el resto.")
                    appendLine("- Diagnóstico: lista numerada al final; términos clínicos o CIE según el dictado.")
                    appendLine()
                    appendLine(SectionDefaults.promptBlock(effectiveSections, effectiveTemplate.sectionDefaultTexts))
                    appendLine("Omite de la respuesta las secciones que la plantilla no liste.")
                    if (physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                }
                DocumentType.INFORME -> {
                    val effectiveSections = effectiveTemplate.normalizedSections()
                        .filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
                        .ifEmpty {
                            listOf(
                                SectionCatalog.MOTIVO_CONSULTA,
                                SectionCatalog.ENFERMEDAD_ACTUAL,
                                SectionCatalog.EXAMEN_FISICO,
                                SectionCatalog.DIAGNOSTICO,
                            )
                        }
                    val sexoTexto = when (patient.sexo.lowercase()) {
                        "masculino", "m" -> "masculino"
                        "femenino", "f" -> "femenino"
                        else -> patient.sexo.ifBlank { "de sexo no referido" }
                    }
                    appendLine("Para INFORME MÉDICO ignora la detección libre de secciones.")
                    appendLine("El encabezado institucional lo coloca la app; tú generas SOLO el cuerpo.")
                    appendLine("Genera UNA sección por cada ítem de la plantilla, en el orden exacto indicado.")
                    appendLine("Formato: línea [[SECTION:Nombre exacto]] y contenido debajo. PROHIBIDO usar **.")
                    appendLine("NO incluyas \"Datos del paciente\" ni nombre/cédula.")
                    appendLine()
                    appendLine("Secciones de la plantilla (orden obligatorio):")
                    effectiveSections.forEach { appendLine("- $it") }
                    appendLine()
                    appendLine("Guía de estilo:")
                    appendLine(SectionDefaults.MOTIVO_CONSULTA_STYLE)
                    appendLine(
                        "- Enfermedad actual: narrativa al estilo del ejemplo. " +
                            "Inicie con paciente $sexoTexto de ${patient.edad} años; " +
                            "natural/procedente, diagnóstico de base o sin patológicos, inicio con fecha, hechos del dictado y cierre en el centro.",
                    )
                    appendLine("- Examen físico: DEBE incluir TODOS los sistemas activos. Solo modifica los dictados; el resto va con texto base intacto.")
                    appendLine("- Diagnóstico (si está en la plantilla): lista numerada 1. 2. 3.")
                    appendLine("- Plan (si está en la plantilla): lista numerada de conducta/tratamiento (observación, fármacos, controles). Solo según dictado.")
                    appendLine()
                    appendLine(SectionDefaults.promptBlock(effectiveSections, effectiveTemplate.sectionDefaultTexts))
                    if (physicalExamBlock.isNotBlank()) {
                        appendLine()
                        appendLine(physicalExamBlock)
                    }
                }
                DocumentType.REPOSO -> {
                    val effectiveSections = effectiveTemplate.normalizedSections()
                        .filterNot { it.equals(SectionCatalog.DATOS_PACIENTE, ignoreCase = true) }
                    val sectionsList = effectiveSections.joinToString("\n") { "- $it" }
                    appendLine("Secciones en orden:")
                    appendLine(sectionsList)
                    appendLine("Cada sección con **título:** y contenido.")
                    appendLine(SectionDefaults.promptBlock(effectiveSections, effectiveTemplate.sectionDefaultTexts))
                }
                DocumentType.ORDENES_MEDICAS -> {
                    val molde = effectiveTemplate.sectionDefaultTexts.entries
                        .firstOrNull {
                            it.key.equals(OrdenesMedicasDefaults.SECTION_ORDENES, ignoreCase = true)
                        }?.value
                        ?: SectionDefaults.textFor(
                            OrdenesMedicasDefaults.SECTION_ORDENES,
                            effectiveTemplate.sectionDefaultTexts,
                        )
                    appendLine(OrdenesMedicasDefaults.promptGuidelines(molde))
                }
                DocumentType.RECETA -> {
                    val moldeRecipe = effectiveTemplate.sectionDefaultTexts.entries
                        .firstOrNull {
                            it.key.equals(RecetaDefaults.SECTION_RECIPE, ignoreCase = true)
                        }?.value
                        ?: RecetaDefaults.MOLDE_RECIPE
                    val moldeInd = effectiveTemplate.sectionDefaultTexts.entries
                        .firstOrNull {
                            it.key.equals(RecetaDefaults.SECTION_INDICACIONES, ignoreCase = true)
                        }?.value
                        ?: RecetaDefaults.MOLDE_INDICACIONES
                    appendLine(RecetaDefaults.promptGuidelines(moldeRecipe, moldeInd))
                }
            }

            if (!headerBlock.isNullOrBlank()) {
                appendLine()
                appendLine("Referencia del médico (no duplicar): $headerBlock")
            }
        }

        val raw = AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 4096)
        return sanitizeDocumentContent(raw, examSystems)
    }

    /** Genera hoja de órdenes a partir de un informe/HC ya redactado. */
    suspend fun generateOrdenesFromCase(
        context: Context,
        patient: Patient,
        doctor: DoctorProfile,
        caseContent: String,
        notes: String = "",
        modo: OrdenesMedicasDefaults.Modo = OrdenesMedicasDefaults.Modo.ORDENES,
        header: DocumentHeader? = null,
    ): String {
        AiConfig.load(context.applicationContext)
        val template = TemplateStorage.forType(context, DocumentType.ORDENES_MEDICAS)
            .firstOrNull { it.isDefault }
            ?: TemplateStorage.forType(context, DocumentType.ORDENES_MEDICAS).firstOrNull()
            ?: DocumentTemplate(
                id = "ordenes-default",
                name = "Órdenes médicas",
                documentType = DocumentType.ORDENES_MEDICAS,
                sections = SectionCatalog.defaultsFor(DocumentType.ORDENES_MEDICAS),
                sectionDefaultTexts = mapOf(
                    OrdenesMedicasDefaults.SECTION_ORDENES to OrdenesMedicasDefaults.MOLDE_EJEMPLO,
                ),
            )
        val molde = template.sectionDefaultTexts.entries
            .firstOrNull { it.key.equals(OrdenesMedicasDefaults.SECTION_ORDENES, ignoreCase = true) }
            ?.value
            ?: OrdenesMedicasDefaults.MOLDE_EJEMPLO
        val headerBlock = header?.toPlainTextBlock()

        val system = """
            Eres un asistente médico que redacta órdenes / tratamiento en español.
            Te basas en el caso clínico ya redactado (informe o historia).
            No inventes diagnósticos ni fármacos que contradigan el caso.
            Usa terminología médica apropiada para Venezuela/Latinoamérica.
        """.trimIndent()

        val prompt = buildString {
            appendLine("Genera ÓRDENES MÉDICAS (${modo.label}) a partir del caso clínico.")
            appendLine()
            appendLine("DATOS DEL MÉDICO (referencia, no incluir): ${doctor.nombre} · ${doctor.especialidad}")
            appendLine("DATOS DEL PACIENTE (referencia, no incluir): ${patient.nombre}, ${patient.edad} años, ${patient.sexo.ifBlank { "—" }}")
            appendLine()
            appendLine("CASO CLÍNICO (informe/historia ya redactado — base para las órdenes):")
            appendLine("\"\"\"")
            appendLine(caseContent.trim())
            appendLine("\"\"\"")
            if (notes.isNotBlank()) {
                appendLine()
                appendLine("NOTAS / DICTADO ADICIONAL DEL MÉDICO (priorizar):")
                appendLine("\"\"\"")
                appendLine(notes.trim())
                appendLine("\"\"\"")
            }
            appendLine()
            appendLine("Instrucciones:")
            appendLine("1. NO incluyas título ÓRDENES MÉDICAS ni membrete del paciente.")
            appendLine("2. Responde SOLO con [[SECTION:Órdenes]] y la lista numerada.")
            appendLine()
            appendLine(OrdenesMedicasDefaults.promptGuidelines(molde, modo))
            if (!headerBlock.isNullOrBlank()) {
                appendLine()
                appendLine("Referencia del médico (no duplicar): $headerBlock")
            }
        }

        val raw = AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 2048)
        return sanitizeDocumentContent(raw, emptyList())
    }

    /**
     * Genera receta desde dictado, informe/HC o diagnóstico (protocolos/guías).
     */
    suspend fun generateReceta(
        context: Context,
        patient: Patient,
        doctor: DoctorProfile,
        fuente: RecetaDefaults.Fuente,
        input: String,
        notes: String = "",
        header: DocumentHeader? = null,
    ): String {
        AiConfig.load(context.applicationContext)
        val template = TemplateStorage.forType(context, DocumentType.RECETA)
            .firstOrNull { it.isDefault }
            ?: TemplateStorage.forType(context, DocumentType.RECETA).firstOrNull()
            ?: DocumentTemplate(
                id = "receta-default",
                name = "Receta",
                documentType = DocumentType.RECETA,
                sections = SectionCatalog.defaultsFor(DocumentType.RECETA),
                sectionDefaultTexts = mapOf(
                    RecetaDefaults.SECTION_RECIPE to RecetaDefaults.MOLDE_RECIPE,
                    RecetaDefaults.SECTION_INDICACIONES to RecetaDefaults.MOLDE_INDICACIONES,
                ),
            )
        val moldeRecipe = template.sectionDefaultTexts.entries
            .firstOrNull { it.key.equals(RecetaDefaults.SECTION_RECIPE, ignoreCase = true) }
            ?.value
            ?: RecetaDefaults.MOLDE_RECIPE
        val moldeInd = template.sectionDefaultTexts.entries
            .firstOrNull { it.key.equals(RecetaDefaults.SECTION_INDICACIONES, ignoreCase = true) }
            ?.value
            ?: RecetaDefaults.MOLDE_INDICACIONES
        val fromDiagnostico = fuente == RecetaDefaults.Fuente.DIAGNOSTICO
        val headerBlock = header?.toPlainTextBlock()

        val system = if (fromDiagnostico) {
            """
            Eres un asistente médico que redacta RECETAS en español.
            Te basas en el diagnóstico indicado y en protocolos/guías clínicas habituales
            (primera línea razonable para Venezuela/Latinoamérica).
            Usa principios activos, dosis y duración típicas. Sé prudente y no inventes esquemas raros.
            """.trimIndent()
        } else {
            """
            Eres un asistente médico que redacta RECETAS en español.
            Te basas en el dictado o caso clínico aportado. No inventes fármacos que no estén respaldados.
            Usa terminología médica apropiada para Venezuela/Latinoamérica.
            """.trimIndent()
        }

        val prompt = buildString {
            when (fuente) {
                RecetaDefaults.Fuente.DICTAR ->
                    appendLine("Genera RECETA MÉDICA a partir del dictado / lista de fármacos del médico.")
                RecetaDefaults.Fuente.INFORME ->
                    appendLine("Genera RECETA MÉDICA a partir del informe o historia clínica (extrae tratamiento ambulatorio indicado).")
                RecetaDefaults.Fuente.DIAGNOSTICO ->
                    appendLine("Genera RECETA MÉDICA según el DIAGNÓSTICO, usando protocolos y guías científicas habituales.")
            }
            appendLine()
            appendLine("DATOS DEL MÉDICO (referencia, no incluir): ${doctor.nombre} · ${doctor.especialidad}")
            appendLine("DATOS DEL PACIENTE (referencia, no incluir): ${patient.nombre}, ${patient.edad} años, ${patient.sexo.ifBlank { "—" }}")
            appendLine()
            when (fuente) {
                RecetaDefaults.Fuente.DIAGNOSTICO -> {
                    appendLine("DIAGNÓSTICO:")
                    appendLine("\"\"\"")
                    appendLine(input.trim())
                    appendLine("\"\"\"")
                }
                RecetaDefaults.Fuente.INFORME -> {
                    appendLine("CASO CLÍNICO (informe/historia):")
                    appendLine("\"\"\"")
                    appendLine(input.trim())
                    appendLine("\"\"\"")
                }
                RecetaDefaults.Fuente.DICTAR -> {
                    appendLine("DICTADO / FÁRMACOS:")
                    appendLine("\"\"\"")
                    appendLine(input.trim())
                    appendLine("\"\"\"")
                }
            }
            if (notes.isNotBlank()) {
                appendLine()
                appendLine("NOTAS ADICIONALES DEL MÉDICO (priorizar):")
                appendLine("\"\"\"")
                appendLine(notes.trim())
                appendLine("\"\"\"")
            }
            appendLine()
            appendLine("Instrucciones:")
            appendLine("1. NO incluyas título RECETA ni membrete del paciente.")
            appendLine("2. Responde SOLO con [[SECTION:Recipe]] e [[SECTION:Indicaciones]].")
            appendLine()
            appendLine(
                RecetaDefaults.promptGuidelines(
                    moldeRecipe,
                    moldeInd,
                    allowProtocolInference = fromDiagnostico,
                ),
            )
            if (!headerBlock.isNullOrBlank()) {
                appendLine()
                appendLine("Referencia del médico (no duplicar): $headerBlock")
            }
        }

        val raw = AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 2048)
        return sanitizeDocumentContent(raw, emptyList())
    }

    /**
     * Agrega un fármaco a una receta ya generada (completa dosis/cantidad con IA si hace falta).
     */
    suspend fun appendFarmacoToReceta(
        context: Context,
        currentContent: String,
        principioActivo: String,
        presentacion: String,
        concentracion: String = "",
        patient: Patient? = null,
    ): String {
        AiConfig.load(context.applicationContext)
        val sections = parseDocumentSections(sanitizeDocumentContent(currentContent)).toMutableList()
        var recipeIdx = sections.indexOfFirst {
            it.title.equals(RecetaDefaults.SECTION_RECIPE, ignoreCase = true)
        }
        var indIdx = sections.indexOfFirst {
            it.title.equals(RecetaDefaults.SECTION_INDICACIONES, ignoreCase = true)
        }
        if (recipeIdx < 0) {
            sections.add(0, DocumentSection(title = RecetaDefaults.SECTION_RECIPE, body = ""))
            recipeIdx = 0
            if (indIdx >= 0) indIdx++
        }
        if (indIdx < 0) {
            sections.add(DocumentSection(title = RecetaDefaults.SECTION_INDICACIONES, body = ""))
            indIdx = sections.lastIndex
        }

        val conc = concentracion.trim()
        val drugLine = buildString {
            append(principioActivo.trim())
            if (conc.isNotBlank()) append(" $conc")
            append(" ($presentacion)")
        }

        val system = """
            Eres un asistente médico. Completas UN fármaco para una receta ambulatoria en español.
            Usa dosis/cantidad típicas según protocolos habituales si no se especifican.
            Responde SOLO con dos bloques:
            RECIPE:
            (líneas del fármaco + Dispóngase)
            INDICACIONES:
            (nombre: + posología)
        """.trimIndent()

        val prompt = buildString {
            appendLine("Agrega este fármaco a la receta (solo este, no reescribas los demás):")
            appendLine("- Principio activo: ${principioActivo.trim()}")
            appendLine("- Presentación: $presentacion")
            if (conc.isNotBlank()) appendLine("- Concentración: $conc")
            patient?.let {
                appendLine("- Paciente: ${it.edad} años, ${it.sexo.ifBlank { "—" }}")
            }
            appendLine()
            appendLine("Formato RECIPE (ejemplo):")
            appendLine("$drugLine")
            appendLine("Dispóngase: N unidades.")
            appendLine()
            appendLine("Formato INDICACIONES (ejemplo):")
            appendLine("${principioActivo.trim()}:")
            appendLine("Tomar … vía … cada … por … días.")
        }

        val raw = try {
            AiService.sendPrompt(prompt = prompt, systemMessage = system, maxTokens = 512)
        } catch (_: Exception) {
            null
        }

        val (recipeAdd, indAdd) = parseFarmacoBlocks(raw, drugLine, principioActivo.trim(), presentacion)
        sections[recipeIdx] = sections[recipeIdx].copy(
            body = listOf(sections[recipeIdx].body.trim(), recipeAdd.trim())
                .filter { it.isNotBlank() }
                .joinToString("\n\n"),
        )
        sections[indIdx] = sections[indIdx].copy(
            body = listOf(sections[indIdx].body.trim(), indAdd.trim())
                .filter { it.isNotBlank() }
                .joinToString("\n\n"),
        )
        return serializeDocumentSections(sections)
    }

    private fun parseFarmacoBlocks(
        raw: String?,
        fallbackDrugLine: String,
        principio: String,
        presentacion: String,
    ): Pair<String, String> {
        if (raw.isNullOrBlank()) {
            return fallbackDrugLine + "\nDispóngase: —." to
                "$principio:\nTomar según indicación médica ($presentacion)."
        }
        val cleaned = raw.replace("```", "").trim()
        val recipeMatch = Regex(
            """(?is)RECIPE\s*:?\s*(.*?)(?=INDICACIONES\s*:|$)""",
        ).find(cleaned)
        val indMatch = Regex(
            """(?is)INDICACIONES\s*:?\s*(.*)$""",
        ).find(cleaned)
        val recipe = recipeMatch?.groupValues?.getOrNull(1)?.trim().orEmpty()
            .ifBlank { "$fallbackDrugLine\nDispóngase: —." }
        val ind = indMatch?.groupValues?.getOrNull(1)?.trim().orEmpty()
            .ifBlank { "$principio:\nTomar según indicación médica ($presentacion)." }
        return recipe to ind
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
        val enfermedadEjemplo = EnfermedadActualStorage.resolved(
            sessionConfig?.enfermedadActualEjemplo.orEmpty(),
            context,
        )
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
                    appendLine("- Incluye TODOS los sistemas activos, aunque el dictado solo mencione uno.")
                    appendLine("- Sistemas no dictados → texto base intacto. Solo edita los mencionados.")
                    appendLine("- Signos vitales SOLO si hay valores dictados (ej. TA: 120/80 mmHg | FC: 82 lpm).")
                    appendLine("- Signos en 0 o no dictados: omitirlos.")
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
        val applies = when (documentType) {
            DocumentType.HISTORIA_CLINICA ->
                sectionTitle.isBlank() ||
                    sectionTitle.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true)
            DocumentType.INFORME ->
                sectionTitle.isBlank() ||
                    sectionTitle.equals(SectionCatalog.ENFERMEDAD_ACTUAL, ignoreCase = true)
            else -> false
        }
        if (!applies) return
        val sample = ejemplo.trim().ifBlank { EnfermedadActualStorage.DEFAULT_EJEMPLO }
        appendLine("ENFERMEDAD ACTUAL — ejemplo de estilo (referencia; adapta al dictado, sexo, edad y hechos reales):")
        appendLine("\"\"\"")
        appendLine(sample)
        appendLine("\"\"\"")
        appendLine("Reglas de estilo:")
        appendLine(EnfermedadActualStorage.STYLE_RULES)
        appendLine()
    }

    private fun sectionStyleHint(title: String): String = when {
        title.equals(SectionCatalog.MOTIVO_CONSULTA, ignoreCase = true) ->
            SectionDefaults.MOTIVO_CONSULTA_STYLE
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
        val sanitized = sanitizeDocumentContent(raw, emptyList())
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
