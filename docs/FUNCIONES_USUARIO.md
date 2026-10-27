# ClinicosDoc — Guía de funciones para el usuario

Este documento describe, en cuatro partes, las funciones principales de ClinicosDoc y su utilidad práctica en el trabajo médico diario.

---

## Parte 1 — Creación de documentos clínicos con inteligencia artificial

La función central de ClinicosDoc es convertir lo que el médico dicta o escribe en documentos clínicos formales, redactados con lenguaje profesional y listos para imprimir o compartir en PDF. Al presionar **"Redactar"**, el usuario sigue un flujo guiado en pasos:

**1. Tipo de documento.** Historia clínica, informe médico, órdenes médicas (modalidad hospitalaria, ambulatoria o emergencia), receta médica o constancia de reposo.

**2. Paciente.** Se selecciona un paciente registrado y la app inserta automáticamente nombre, cédula, edad y datos de referencia.

**3. Origen (molde).** El documento usa las plantillas personales del médico o, si pertenece a un centro de salud afiliado, los moldes institucionales de ese centro para formato uniforme.

**4. Dictado.** El médico dicta con la voz, escribe, o **adjunta un documento**: foto de la cámara o galería, o un PDF. El reconocimiento óptico de caracteres (OCR) extrae el texto de la hoja —una ficha de admisión, una historia previa— y lo agrega al dictado, editable antes de procesar. Esto acelera el llenado cuando los datos ya vienen escritos.

**5. Procesamiento.** Al presionar **"Procesar con IA"**, el texto va al servicio de inteligencia artificial, que redacta cada sección con estilo médico: enfermedad actual en prosa narrativa ("natural de / procedente de / acude por"), examen físico sistema por sistema con los textos de normalidad del catálogo, diagnóstico con enfermedades reales de la CIE-10 (nunca síntomas sueltos como "fiebre" o "tos"), órdenes numeradas en orden clínico (hospitalización, dieta, oxígeno, hidratación, protector gástrico, medicamentos endovenosos primero y orales después, laboratorios agrupados, estudios de imagen por modalidad, controles de signos vitales y avisos de alarma al final), y receta con fármacos del catálogo con presentación y concentración.

El resultado se **guarda automáticamente** en el historial del paciente. Desde ahí se edita cualquier sección, se regenera con IA, se previsualiza el PDF, se imprime o se comparte por WhatsApp.

---

## Parte 2 — Gestión de pacientes y datos clínicos

ClinicosDoc funciona también como un registro de pacientes ligero y práctico:

**Registro de pacientes.** Cada ficha guarda nombre completo, cédula de identidad, fecha de nacimiento, teléfono/WhatsApp y datos de contacto. La aplicación calcula la edad automáticamente. Importante para el contexto venezolano: existe la opción **"Sin cédula"** para pacientes que aún no tienen documento de identidad (lactantes, neonatos, extranjeros sin cédula). En ese caso la app genera una identificación interna y muestra "S/C" donde corresponda, permitiendo registrar al paciente sin bloquear el flujo.

**Lista y búsqueda.** La pantalla de pacientes muestra tarjetas compactas con los datos esenciales y tres acciones de un toque: editar (lápiz), ver el historial de documentos (ojo) y la ficha de emergencia (cruz). Un buscador filtra por nombre o cédula en tiempo real.

**Historial por paciente.** Al abrir un paciente se ven todos sus documentos ordenados por fecha. Se puede abrir cualquiera, reimprimirlo o **crear un informe directamente desde una historia clínica**: la app copia motivo de consulta, enfermedad actual, examen físico, diagnóstico y plan a la estructura de informe sin volver a usar la IA, ideal para el alta o la evolución del mismo caso.

**Citas.** La agenda permite programar citas vinculadas a cada paciente.

**Ficha de emergencia.** Cada paciente con cédula puede generar una ficha técnica con sus datos críticos (tipo de sangre, alergias, antecedentes) y un código QR escaneable para emergencias.

**Borradores.** Si el médico interrumpe una redacción, el borrador se conserva durante siete días y puede retomarse exactamente donde quedó.

---

## Parte 3 — Personalización: plantillas, encabezados y sello

La aplicación se adapta al estilo de cada médico:

**Plantillas de documento.** Cada tipo de documento tiene una plantilla donde el médico elige qué secciones incluir y en qué orden: motivo de consulta, enfermedad actual, antecedentes, hábitos psicobiológicos, examen físico, diagnóstico, plan, nota, días de reposo, entre otras. También puede editar los **textos predeterminados** de cada sección — por ejemplo, su frase habitual de nota de alta o su ejemplo de redacción de enfermedad actual, que la IA toma como guía de estilo.

**Catálogo de examen físico.** El médico controla qué sistemas aparecen en el examen: piel, cabeza, ojos, oídos, nariz, boca y faringe, cuello, tórax, pulmones, corazón, abdomen, genitales, extremidades y neurológico, cada uno con su texto de normalidad editable. Se pueden crear sistemas nuevos, reordenarlos y activarlos o desactivarlos por plantilla.

**Encabezados para PDF.** Los documentos salen con membrete profesional: logotipo del consultorio, nombre del médico, especialidad, MPPS y líneas de información personalizadas.

**Sello médico.** Separado del encabezado, el médico sube una foto de su sello físico (mínimo 128 píxeles). En la vista previa del PDF el sello se puede **arrastrar con el dedo** a cualquier punto de la última página — donde está el último carácter escrito —, queda siempre dentro de la hoja y la posición se guarda con el documento; un check permite volverlo a su posición centrada original. Se activa por documento con "Incluir sello médico".

**Restablecer configuración.** En Configuración hay un botón que devuelve plantillas, catálogo de examen y sello a valores de fábrica sin tocar encabezados, documentos ni pacientes.

---

## Parte 4 — Sincronización, centros de salud y suscripción

**Nube.** Con sesión activa, todo se sincroniza automáticamente con Firebase: pacientes, documentos, plantillas, encabezados, sello y borradores. El médico puede trabajar sin internet y los cambios pendientes se suben al reconectar; el mismo contenido está disponible en la app Android y en el sitio web.

**Modo clínica.** Un centro de salud se registra como cuenta institucional e invita médicos por cédula o código. Los afiliados redactan con los moldes y el membrete del centro, y cada documento queda en el **panel institucional**, donde la clínica consulta los informes de su equipo por paciente, diagnóstico o médico. La suscripción del centro se paga por tamaño de plantel (10, 25, 50 o 250 médicos) y solo habilita las plantillas institucionales y el registro centralizado: cada uso de un molde verifica que la suscripción esté activa. **La inteligencia artificial la paga cada médico aparte**, con su propia suscripción o período de prueba.

**Suscripción individual del médico.** En Configuración se ve el estado del plan: días de prueba restantes, consultas de IA disponibles o suscripción activa de 30 días. Los moldes personales, los documentos, los pacientes y la agenda funcionan siempre, incluso sin suscripción — solo el procesamiento con IA requiere plan vigente.
