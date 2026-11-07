const banks = [
  { id: "anatomia_torax", title: "Anatomía del tórax", questions: [
    ["¿Qué cavidad del corazón impulsa sangre hacia la aorta?", ["Aurícula derecha", "Ventrículo izquierdo", "Aurícula izquierda", "Ventrículo derecho"], 1, "El ventrículo izquierdo impulsa la sangre oxigenada hacia la circulación sistémica a través de la aorta."],
    ["¿Cuántos lóbulos tiene normalmente el pulmón derecho?", ["Uno", "Dos", "Tres", "Cuatro"], 2, "El pulmón derecho tiene tres lóbulos: superior, medio e inferior. El izquierdo tiene dos."],
    ["¿Qué músculo es el principal responsable de la inspiración tranquila?", ["Diafragma", "Pectoral mayor", "Recto abdominal", "Trapecio"], 0, "Al contraerse, el diafragma desciende y aumenta el volumen torácico, facilitando la entrada de aire."]
  ] },
  { id: "fisiologia_cardiaca", title: "Fisiología cardíaca", questions: [
    ["¿Cuál es el marcapasos habitual del corazón?", ["Nodo auriculoventricular", "Haz de His", "Fibras de Purkinje", "Nodo sinoauricular"], 3, "El nodo sinoauricular inicia normalmente los impulsos eléctricos que determinan el ritmo cardíaco."],
    ["¿Qué representa la sístole ventricular?", ["Llenado ventricular", "Contracción ventricular", "Relajación auricular exclusivamente", "Cierre de las venas cavas"], 1, "Durante la sístole los ventrículos se contraen y, en la fase de eyección, expulsan sangre hacia las grandes arterias."],
    ["¿Cómo se calcula el gasto cardíaco?", ["Presión por resistencia", "Volumen dividido entre presión", "Frecuencia por volumen sistólico", "Frecuencia por presión sistólica"], 2, "El gasto cardíaco es el volumen de sangre bombeado por minuto: frecuencia cardíaca multiplicada por volumen sistólico."]
  ] },
  { id: "fisiologia_respiratoria", title: "Fisiología respiratoria", questions: [
    ["¿Dónde ocurre principalmente el intercambio de gases pulmonar?", ["Alvéolos", "Tráquea", "Laringe", "Bronquios principales"], 0, "El intercambio de oxígeno y dióxido de carbono ocurre a través de la membrana alveolocapilar."],
    ["¿Qué sustancia reduce la tensión superficial de los alvéolos?", ["Hemoglobina", "Mucina", "Colágeno", "Surfactante"], 3, "El surfactante, producido por neumocitos tipo II, reduce la tensión superficial y ayuda a evitar el colapso alveolar."],
    ["¿Cómo se transporta la mayor parte del oxígeno en sangre?", ["Como bicarbonato", "Unido a hemoglobina", "Unido a albúmina", "Disuelto en plasma"], 1, "La mayor parte del oxígeno viaja unida a la hemoglobina de los eritrocitos; una pequeña fracción se encuentra disuelta."]
  ] },
  { id: "fisiologia_renal", title: "Fisiología renal", questions: [
    ["¿Cuál es la unidad funcional del riñón?", ["Alvéolo", "Hepatocito", "Nefrona", "Osteona"], 2, "La nefrona incluye el corpúsculo renal y el sistema tubular, responsables de filtrar y modificar el líquido que formará la orina."],
    ["¿Qué hormona aumenta la reabsorción de agua en el conducto colector?", ["Insulina", "Glucagón", "Calcitonina", "Hormona antidiurética"], 3, "La hormona antidiurética favorece la inserción de acuaporinas y aumenta la reabsorción de agua en el conducto colector."],
    ["¿Qué hormona renal estimula la producción de eritrocitos?", ["Eritropoyetina", "Aldosterona", "Cortisol", "Tiroxina"], 0, "La eritropoyetina se produce principalmente en el riñón y estimula la formación de eritrocitos en la médula ósea."]
  ] },
  { id: "diabetes_mellitus_tipo_2", title: "Diabetes tipo 2", questions: [
    ["¿Qué HbA1c alcanza el umbral diagnóstico de diabetes en adultos no gestantes?", ["5,0 %", "6,5 %", "5,7 %", "6,0 %"], 1, "Una HbA1c de 6,5 % o más cumple un criterio diagnóstico. En ausencia de hiperglucemia inequívoca, el resultado debe confirmarse."],
    ["¿Cuál es el umbral diagnóstico de glucemia plasmática en ayunas para diabetes?", ["90 mg/dL", "100 mg/dL", "126 mg/dL", "110 mg/dL"], 2, "Una glucemia en ayunas de al menos 126 mg/dL cumple un criterio diagnóstico, con confirmación si no hay hiperglucemia inequívoca."],
    ["¿Qué describe la poliuria?", ["Aumento del volumen urinario", "Dolor al orinar", "Sangre en la orina", "Ausencia de orina"], 0, "La poliuria es el aumento del volumen de orina. En la diabetes puede deberse a diuresis osmótica por glucosuria."]
  ] },
  { id: "hipertension_arterial", title: "Presión arterial", questions: [
    ["¿Qué instrumento se utiliza para medir la presión arterial?", ["Espirómetro", "Glucómetro", "Oftalmoscopio", "Esfigmomanómetro"], 3, "El esfigmomanómetro permite medir la presión arterial. Debe utilizarse un manguito del tamaño adecuado y una técnica estandarizada."],
    ["¿Qué cambio de hábito ayuda a reducir la presión arterial?", ["Aumentar el sodio", "Reducir el exceso de sodio", "Fumar diariamente", "Aumentar el alcohol"], 1, "Reducir el exceso de sodio en la dieta puede contribuir al control de la presión arterial junto con otros hábitos saludables."],
    ["¿Qué órgano puede sufrir daño crónico por hipertensión?", ["Cristalino exclusivamente", "Apéndice exclusivamente", "Riñón", "Vesícula biliar exclusivamente"], 2, "La hipertensión puede dañar los vasos renales y contribuir a enfermedad renal crónica. También afecta corazón, cerebro y retina."]
  ] },
  { id: "dengue", title: "Dengue", questions: [
    ["¿Qué mosquito transmite principalmente el dengue en zonas urbanas?", ["Aedes aegypti", "Anopheles", "Culex", "Mansonia"], 0, "Aedes aegypti es el principal vector urbano del dengue; suele reproducirse en recipientes con agua acumulada."],
    ["¿Cuál es un signo de alarma en dengue?", ["Estornudo aislado", "Prurito leve aislado", "Aumento del apetito", "Dolor abdominal intenso y continuo"], 3, "El dolor abdominal intenso y continuo es un signo de alarma y requiere valoración médica, especialmente cerca de la desaparición de la fiebre."],
    ["¿Qué medicamento debe evitarse en la sospecha de dengue por riesgo hemorrágico?", ["Paracetamol", "Ácido acetilsalicílico", "Solución de rehidratación oral", "Suero fisiológico"], 1, "El ácido acetilsalicílico y otros antiinflamatorios no esteroideos deben evitarse por el riesgo de sangrado. El manejo requiere valoración clínica."]
  ] },
  { id: "anemia", title: "Anemia", questions: [
    ["¿Qué parámetro se utiliza para definir anemia?", ["Glucosa elevada", "Plaquetas elevadas", "Hemoglobina disminuida", "Sodio disminuido"], 2, "La anemia se define por una hemoglobina inferior al rango correspondiente a edad, sexo y situación fisiológica."],
    ["¿Qué deficiencia causa con frecuencia anemia microcítica?", ["Hierro", "Vitamina B12", "Ácido fólico", "Vitamina D"], 0, "La deficiencia de hierro es una causa frecuente de anemia microcítica, aunque existen otras causas como talasemias y algunas enfermedades crónicas."],
    ["¿Qué vitamina puede causar anemia megaloblástica y alteraciones neurológicas al faltar?", ["Vitamina C", "Vitamina K", "Vitamina A", "Vitamina B12"], 3, "La deficiencia de vitamina B12 puede causar anemia megaloblástica y manifestaciones neurológicas, incluso sin anemia evidente."]
  ] },
  { id: "apendicitis_aguda", title: "Apendicitis", questions: [
    ["¿Dónde suele localizarse el dolor de la apendicitis cuando progresa el cuadro típico?", ["Hipocondrio izquierdo", "Fosa ilíaca derecha", "Región lumbar izquierda", "Hipocondrio derecho"], 1, "En la presentación típica el dolor comienza alrededor del ombligo y después se localiza en la fosa ilíaca derecha. Existen presentaciones atípicas."],
    ["¿Cómo suele describirse el inicio del dolor en la apendicitis típica?", ["Dolor en el hombro", "Dolor retroesternal", "Dolor periumbilical", "Dolor en el talón"], 2, "La distensión e inflamación inicial del apéndice producen dolor visceral, habitualmente periumbilical, antes de la irritación peritoneal localizada."],
    ["¿Cuál es la conducta adecuada ante sospecha de apendicitis?", ["Valoración médica urgente", "Esperar varios días", "Tomar laxantes", "Aplicar masaje abdominal intenso"], 0, "La sospecha de apendicitis requiere valoración médica urgente por el riesgo de perforación y otras complicaciones."]
  ] },
  { id: "conjuntivitis", title: "Conjuntivitis", questions: [
    ["¿Qué estructura se inflama en la conjuntivitis?", ["Retina", "Nervio óptico", "Cristalino", "Conjuntiva"], 3, "La conjuntivitis es la inflamación de la conjuntiva, membrana que recubre la cara interna de los párpados y parte anterior del ojo."],
    ["¿Qué síntoma orienta especialmente a conjuntivitis alérgica?", ["Pérdida súbita de visión", "Prurito ocular", "Dolor ocular intenso", "Pupila fija"], 1, "El prurito ocular, a menudo bilateral, orienta a conjuntivitis alérgica. El dolor intenso o la pérdida visual requieren otra evaluación."],
    ["¿Qué medida reduce la transmisión de conjuntivitis infecciosa?", ["Compartir toallas", "Frotarse ambos ojos", "Lavarse las manos", "Compartir maquillaje"], 2, "La higiene de manos y evitar compartir toallas, maquillaje u objetos personales ayudan a reducir la transmisión."]
  ] },
  { id: "gastritis", title: "Estómago y gastritis", questions: [
    ["¿Qué bacteria se asocia con gastritis crónica y úlcera péptica?", ["Helicobacter pylori", "Vibrio cholerae", "Clostridium tetani", "Bordetella pertussis"], 0, "Helicobacter pylori puede colonizar el estómago y causar gastritis crónica; también se asocia con úlcera péptica y otras complicaciones."],
    ["¿Qué grupo de medicamentos puede lesionar la mucosa gástrica?", ["Antihistamínicos H1", "Broncodilatadores inhalados", "Sales de rehidratación", "Antiinflamatorios no esteroideos"], 3, "Los antiinflamatorios no esteroideos reducen prostaglandinas protectoras y pueden producir gastropatía, úlceras y sangrado digestivo."],
    ["¿Cómo se llama el vómito con sangre?", ["Hematuria", "Hematemesis", "Hemoptisis", "Epistaxis"], 1, "La hematemesis es el vómito de sangre y puede indicar sangrado digestivo alto, por lo que requiere atención médica urgente."]
  ] },
  { id: "migraña", title: "Migraña", questions: [
    ["¿Qué característica es frecuente en el dolor de migraña?", ["Siempre dura segundos", "Nunca causa náuseas", "Puede ser pulsátil", "Siempre se debe a infección"], 2, "El dolor migrañoso puede ser pulsátil, moderado o intenso, y acompañarse de náuseas, fotofobia o fonofobia."],
    ["¿Cómo se llama la molestia o sensibilidad excesiva a la luz?", ["Fotofobia", "Diplopía", "Anosmia", "Disfagia"], 0, "La fotofobia es la sensibilidad o molestia ante la luz y es frecuente durante un episodio migrañoso."],
    ["¿Qué cefalea requiere valoración urgente?", ["La habitual sin cambios", "La leve conocida", "La que mejora al descansar", "La súbita de máxima intensidad"], 3, "Una cefalea súbita que alcanza rápidamente su máxima intensidad es una señal de alarma y requiere descartar causas secundarias graves."]
  ] },
  { id: "hipotiroidismo", title: "Hipotiroidismo", questions: [
    ["¿Qué síntoma es frecuente en hipotiroidismo?", ["Intolerancia al calor", "Intolerancia al frío", "Sudoración marcada", "Pérdida de peso constante"], 1, "La reducción de hormonas tiroideas puede causar intolerancia al frío, cansancio, estreñimiento y aumento de peso, entre otros síntomas."],
    ["¿Qué patrón es típico del hipotiroidismo primario manifiesto?", ["TSH baja y T4 alta", "TSH normal y T4 alta", "TSH alta y T4 libre baja", "TSH baja y T4 normal"], 2, "En el hipotiroidismo primario manifiesto, la tiroides produce menos hormona y la hipófisis aumenta la secreción de TSH."],
    ["¿Qué fármaco se utiliza habitualmente como reemplazo hormonal en hipotiroidismo?", ["Levotiroxina", "Metimazol", "Insulina", "Propranolol"], 0, "La levotiroxina reemplaza la hormona tiroidea. Su indicación y dosis deben individualizarse y controlarse clínicamente."]
  ] },
  { id: "varicela", title: "Varicela", questions: [
    ["¿Qué virus causa la varicela?", ["Virus de Epstein-Barr", "Citomegalovirus", "Parvovirus B19", "Virus varicela-zóster"], 3, "La infección primaria por el virus varicela-zóster causa varicela. Su reactivación posterior puede causar herpes zóster."],
    ["¿Qué hallazgo cutáneo es característico de varicela?", ["Solo máculas permanentes", "Lesiones en distintas etapas", "Solo nódulos indoloros", "Una única úlcera"], 1, "Es característica la coexistencia de máculas, pápulas, vesículas y costras, porque las lesiones aparecen en brotes."],
    ["¿Qué medida ayuda a prevenir la varicela?", ["Antibióticos diarios", "Antiparasitarios mensuales", "Vacunación", "Suplementos de hierro"], 2, "La vacunación reduce el riesgo de varicela y sus complicaciones. Las indicaciones dependen de edad, antecedentes y contraindicaciones."]
  ] },
  { id: "vitaminas_hidrosolubles", title: "Vitaminas", questions: [
    ["¿Qué deficiencia vitamínica causa escorbuto?", ["Vitamina C", "Vitamina B1", "Vitamina B12", "Vitamina B6"], 0, "La deficiencia de vitamina C altera la síntesis de colágeno y puede causar sangrado gingival, equimosis y mala cicatrización."],
    ["¿Qué vitamina se conoce como tiamina?", ["Vitamina B12", "Vitamina B6", "Vitamina C", "Vitamina B1"], 3, "La tiamina es la vitamina B1 y participa en el metabolismo energético; su deficiencia puede afectar sistema nervioso y corazón."],
    ["¿Qué vitamina se recomienda suplementar antes del embarazo para reducir defectos del tubo neural?", ["Vitamina K", "Ácido fólico", "Vitamina A en altas dosis", "Vitamina E"], 1, "El ácido fólico antes de la concepción y al inicio del embarazo reduce el riesgo de defectos del tubo neural. La dosis depende del riesgo individual."]
  ] }
];

const DAY_MS = 86400000;
const EPOCH = Date.UTC(2026, 10, 6);

function dailyChallenge(now = new Date()) {
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const date = shifted.toISOString().slice(0, 10);
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - EPOCH) / DAY_MS);
  const index = ((day % banks.length) + banks.length) % banks.length;
  return { date, bankNumber: index + 1, bank: banks[index] };
}

function gradeAnswers(bank, answers) {
  if (!Array.isArray(answers) || answers.length !== 3 || answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) {
    throw new Error("Selecciona una respuesta válida para cada pregunta.");
  }
  return {
    score: bank.questions.reduce((total, q, i) => total + Number(q[2] === answers[i]), 0),
    review: bank.questions.map(q => ({ correctAnswer: q[2], explanation: q[3] })),
  };
}

module.exports = { banks, dailyChallenge, gradeAnswers };
