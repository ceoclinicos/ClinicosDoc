const banks = [
  { id: "anatomia_torax", title: "Anatomía del tórax", questions: [
    ["¿Qué hueso se encuentra en la parte anterior central del tórax?", ["Fémur", "Esternón", "Radio", "Tibia"], 1, "El esternón es un hueso plano situado en la parte anterior central del tórax."],
    ["¿Qué membrana recubre los pulmones y la cara interna de la pared torácica?", ["Peritoneo", "Meninges", "Pleura", "Sinovial"], 2, "La pleura visceral recubre los pulmones y la parietal tapiza la pared torácica interna."],
    ["¿Qué órgano ocupa el espacio entre ambos pulmones?", ["Corazón", "Bazo", "Vejiga", "Útero"], 0, "El corazón se encuentra en el mediastino, entre ambos pulmones."],
    ["¿Cuántos pares de costillas tiene habitualmente una persona?", ["Seis", "Ocho", "Dieciséis", "Doce"], 3, "El esqueleto humano tiene habitualmente doce pares de costillas que contribuyen a proteger los órganos torácicos."]
  ] },
  { id: "fisiologia_cardiaca", title: "Fisiología cardíaca", questions: [
    ["¿Cómo se llama la fase de relajación y llenado de los ventrículos?", ["Apnea", "Diástole", "Hemólisis", "Coagulación"], 1, "Durante la diástole los ventrículos se relajan y se llenan de sangre."],
    ["¿Qué función principal cumplen las válvulas del corazón?", ["Producir oxígeno", "Fabricar glóbulos rojos", "Impedir el retroceso de la sangre", "Eliminar urea"], 2, "Las válvulas se abren y cierran según las diferencias de presión para mantener el flujo en una dirección."],
    ["¿Qué transportan las arterias coronarias al músculo cardíaco?", ["Sangre con oxígeno y nutrientes", "Orina", "Bilis", "Aire inspirado"], 0, "Las coronarias aportan la sangre que necesita el miocardio para funcionar."],
    ["¿En qué unidad se expresa habitualmente la frecuencia cardíaca?", ["Milímetros", "Litros por hora", "Grados Celsius", "Latidos por minuto"], 3, "La frecuencia cardíaca cuenta los latidos que ocurren durante un minuto."]
  ] },
  { id: "fisiologia_respiratoria", title: "Fisiología respiratoria", questions: [
    ["¿Qué gas elimina el organismo principalmente al espirar?", ["Helio", "Dióxido de carbono", "Hidrógeno", "Neón"], 1, "El dióxido de carbono producido por el metabolismo llega a los pulmones por la sangre y se elimina al respirar."],
    ["¿Qué mide un pulsioxímetro colocado en el dedo?", ["Glucosa sanguínea", "Presión intracraneal", "Saturación periférica de oxígeno", "Volumen de orina"], 2, "El pulsioxímetro estima la saturación de oxígeno de la hemoglobina; no mide directamente el dióxido de carbono."],
    ["¿Qué suele ocurrir con la frecuencia respiratoria durante el ejercicio?", ["Aumenta", "Desaparece", "Siempre disminuye a cero", "No puede cambiar"], 0, "Durante el ejercicio aumenta la demanda de oxígeno y la eliminación de dióxido de carbono, por lo que suele aumentar la ventilación."],
    ["¿Cómo se llama la pausa o ausencia de respiración?", ["Taquicardia", "Poliuria", "Disfagia", "Apnea"], 3, "La apnea es el cese del flujo respiratorio. Su importancia depende de la duración y del contexto clínico."]
  ] },
  { id: "fisiologia_renal", title: "Fisiología renal", questions: [
    ["¿Qué desecho del metabolismo de las proteínas se elimina por la orina?", ["Bilis", "Urea", "Surfactante", "Melanina"], 1, "La urea se forma principalmente en el hígado y se elimina por los riñones."],
    ["¿Qué conductos llevan la orina desde los riñones hasta la vejiga?", ["Bronquios", "Arterias coronarias", "Uréteres", "Trompas uterinas"], 2, "Cada uréter conduce la orina de un riñón a la vejiga."],
    ["Además de eliminar desechos, ¿qué ayudan a regular los riñones?", ["Agua y electrolitos", "Color del cabello", "Forma de las uñas", "Tamaño de las pupilas"], 0, "Los riñones ajustan la eliminación de agua y sales y también participan en el equilibrio ácido-base."],
    ["¿Qué sustancia sanguínea se utiliza habitualmente para estimar la función renal?", ["Bilirrubina únicamente", "Troponina", "Amilasa", "Creatinina"], 3, "La creatinina permite estimar la filtración glomerular mediante fórmulas que consideran otros datos de la persona."]
  ] },
  { id: "diabetes_mellitus_tipo_2", title: "Diabetes tipo 2", questions: [
    ["¿Qué alteración caracteriza a la diabetes tipo 2?", ["Exceso de oxígeno", "Resistencia a la insulina y déficit relativo de su secreción", "Ausencia de glóbulos rojos", "Exceso de calcio en todos los casos"], 1, "En la diabetes tipo 2 los tejidos responden menos a la insulina y el páncreas no logra compensarlo suficientemente."],
    ["¿Cuál puede ser una manifestación de glucosa elevada?", ["Pérdida permanente del olfato", "Cabello azul", "Sed excesiva", "Aumento del número de dedos"], 2, "La hiperglucemia puede causar sed excesiva, aumento de la orina y pérdida de peso, aunque también puede ser asintomática."],
    ["¿Qué cuidado ayuda a prevenir complicaciones en los pies de una persona con diabetes?", ["Revisarlos diariamente", "Caminar descalzo sobre superficies calientes", "Ignorar las heridas", "Cortar los callos con cuchillas"], 0, "La revisión diaria permite detectar heridas o cambios tempranos, especialmente cuando existe pérdida de sensibilidad."],
    ["En una persona consciente con hipoglucemia y que puede tragar, ¿qué suele usarse inicialmente?", ["Agua sola", "Insulina adicional", "Ejercicio intenso", "Carbohidrato de absorción rápida"], 3, "La hipoglucemia se trata inicialmente con carbohidratos rápidos si la persona puede tragar. Si no puede, no se administra nada por boca y se requiere ayuda urgente."]
  ] },
  { id: "hipertension_arterial", title: "Presión arterial", questions: [
    ["¿Por qué es importante medir la presión aunque la persona se sienta bien?", ["Siempre causa fiebre", "Puede estar elevada sin síntomas", "Solo aumenta durante infecciones", "Solo existe en deportistas"], 1, "La hipertensión suele ser asintomática y se identifica mediante mediciones adecuadas."],
    ["Antes de medir la presión en reposo, ¿qué se recomienda?", ["Correr", "Fumar", "Sentarse y descansar unos minutos", "Hablar sin parar"], 2, "Descansar sentado al menos cinco minutos, con espalda y brazo apoyados, ayuda a obtener una medición fiable."],
    ["¿Qué significa el número superior de la presión arterial?", ["Presión sistólica", "Frecuencia respiratoria", "Glucosa", "Temperatura"], 0, "La presión sistólica es la presión arterial durante la contracción ventricular."],
    ["¿Qué debe hacerse con el tratamiento antihipertensivo si las cifras se normalizan?", ["Suspenderlo siempre", "Duplicarlo sin consultar", "Tomarlo solo si hay dolor", "Mantenerlo según indicación y consultar los cambios"], 3, "La normalización puede deberse al tratamiento. Los cambios deben acordarse con el profesional que lo indicó."]
  ] },
  { id: "dengue", title: "Dengue", questions: [
    ["¿Qué medida reduce los criaderos del mosquito transmisor del dengue?", ["Guardar agua destapada", "Eliminar agua estancada en recipientes", "Acumular neumáticos con agua", "Dejar baldes llenos al aire libre"], 1, "Vaciar, limpiar o tapar recipientes con agua ayuda a evitar criaderos de Aedes."],
    ["¿Qué tipo de agente causa el dengue?", ["Hongo", "Parásito intestinal", "Virus", "Bacteria"], 2, "El dengue es una infección viral transmitida por mosquitos infectados."],
    ["¿La desaparición de la fiebre descarta complicaciones del dengue?", ["No, puede coincidir con el inicio de la fase crítica", "Sí, siempre", "Sí, si hay cansancio", "Sí, si disminuye el apetito"], 0, "La fase crítica puede comenzar alrededor de la defervescencia; deben vigilarse los signos de alarma."],
    ["¿Qué hallazgo requiere atención urgente en una persona con posible dengue?", ["Hambre leve", "Estornudo aislado", "Uñas largas", "Vómitos persistentes"], 3, "Los vómitos persistentes son un signo de alarma, al igual que el dolor abdominal intenso o el sangrado de mucosas."]
  ] },
  { id: "anemia", title: "Anemia", questions: [
    ["¿Qué función principal cumple la hemoglobina?", ["Digerir grasas", "Transportar oxígeno", "Producir orina", "Formar bilis"], 1, "La hemoglobina de los glóbulos rojos transporta oxígeno a los tejidos."],
    ["¿Qué síntoma puede aparecer en una persona con anemia?", ["Visión nocturna superior", "Aumento de estatura inmediato", "Cansancio", "Crecimiento de dientes nuevos"], 2, "El cansancio, la palidez y la falta de aire con esfuerzo pueden acompañar a la anemia, pero no son exclusivos de ella."],
    ["¿Qué situación puede causar anemia por pérdida de sangre?", ["Menstruaciones muy abundantes", "Leer con poca luz", "Dormir temprano", "Beber agua potable"], 0, "Las pérdidas menstruales abundantes pueden agotar las reservas de hierro y causar anemia."],
    ["¿Qué estudio inicial permite conocer la hemoglobina?", ["Electrocardiograma", "Radiografía de mano", "Audiometría", "Hemograma"], 3, "El hemograma mide hemoglobina y otros parámetros que ayudan a estudiar la anemia y orientar su causa."]
  ] },
  { id: "apendicitis_aguda", title: "Apendicitis", questions: [
    ["¿A qué parte del intestino se encuentra unido el apéndice?", ["Esófago", "Ciego", "Recto", "Estómago"], 1, "El apéndice vermiforme está unido al ciego, al inicio del intestino grueso."],
    ["¿Qué síntoma digestivo puede acompañar a la apendicitis?", ["Aumento marcado del apetito", "Sed sin otros síntomas como único dato obligatorio", "Pérdida del apetito", "Imposibilidad permanente de eructar"], 2, "La pérdida del apetito, las náuseas y los vómitos pueden acompañar al dolor de la apendicitis."],
    ["¿La ausencia de fiebre excluye una apendicitis temprana?", ["No", "Sí, siempre", "Sí, en todos los adultos", "Sí, si hay náuseas"], 0, "Una apendicitis temprana puede presentarse sin fiebre; el diagnóstico requiere valorar el conjunto de síntomas y hallazgos."],
    ["¿Qué complicación puede producir una apendicitis no tratada?", ["Catarata", "Otitis externa", "Hipotiroidismo", "Perforación y peritonitis"], 3, "La inflamación puede progresar hasta perforar el apéndice y provocar infección dentro del abdomen."]
  ] },
  { id: "conjuntivitis", title: "Conjuntivitis", questions: [
    ["¿Qué parte del ojo se inflama en la conjuntivitis?", ["Retina", "Conjuntiva", "Cristalino", "Nervio óptico"], 1, "La conjuntiva recubre la cara interna de los párpados y parte de la superficie del globo ocular."],
    ["¿Qué hábito ayuda a evitar el contagio de conjuntivitis infecciosa?", ["Compartir toallas", "Frotarse los ojos con manos sucias", "Lavarse las manos", "Compartir maquillaje ocular"], 2, "La higiene de manos y evitar compartir objetos personales reducen la transmisión."],
    ["¿Qué síntoma orienta especialmente hacia conjuntivitis alérgica?", ["Picor en ambos ojos", "Pérdida súbita de visión", "Dolor ocular intenso", "Pupila inmóvil"], 0, "El picor bilateral es frecuente en la conjuntivitis alérgica, aunque requiere valorar otros síntomas."],
    ["¿Qué dato en un ojo rojo requiere valoración urgente?", ["Lagrimeo leve aislado", "Picor leve estacional", "Molestia leve sin cambios visuales", "Disminución de la visión"], 3, "La pérdida de visión, el dolor intenso o la fotofobia importante pueden indicar problemas distintos a una conjuntivitis simple."]
  ] },
  { id: "gastritis", title: "Estómago y gastritis", questions: [
    ["¿Qué significa gastritis?", ["Inflamación del colon", "Inflamación de la mucosa del estómago", "Infección del pulmón", "Cálculo renal"], 1, "La gastritis es la inflamación de la mucosa gástrica; los síntomas por sí solos no siempre confirman su presencia."],
    ["¿Qué bacteria se asocia con gastritis crónica y úlcera péptica?", ["Aedes aegypti", "Candida albicans", "Helicobacter pylori", "Virus de la varicela"], 2, "Helicobacter pylori puede colonizar la mucosa gástrica y causar gastritis y úlceras."],
    ["¿Qué grupo de medicamentos puede dañar la mucosa del estómago?", ["Antiinflamatorios no esteroideos", "Lágrimas artificiales", "Soluciones nasales salinas", "Emolientes cutáneos"], 0, "Los antiinflamatorios no esteroideos pueden favorecer lesiones gástricas y sangrado, especialmente con ciertos factores de riesgo."],
    ["¿Qué hallazgo digestivo es una señal de alarma?", ["Eructo ocasional", "Hambre antes de comer", "Ruidos intestinales aislados", "Vómito con sangre"], 3, "Vomitar sangre puede indicar hemorragia digestiva y requiere atención urgente."]
  ] },
  { id: "migraña", title: "Migraña", questions: [
    ["¿Qué molestia puede acompañar al dolor de una migraña?", ["Dolor exclusivo de tobillo", "Sensibilidad a la luz", "Sangrado nasal obligatorio", "Ictericia"], 1, "La fotofobia y la sensibilidad al ruido son frecuentes durante una crisis de migraña."],
    ["¿Qué describe el aura visual de algunas migrañas?", ["Ceguera irreversible obligatoria", "Secreción ocular purulenta", "Luces o líneas que aparecen transitoriamente", "Cambio permanente del color del iris"], 2, "El aura puede incluir fenómenos visuales reversibles. Los síntomas nuevos o atípicos necesitan evaluación."],
    ["¿Qué hábito puede ayudar a prevenir crisis en personas con migraña?", ["Mantener horarios regulares de sueño", "Dormir cada día a horas muy distintas", "Omitir siempre las comidas", "Abusar de analgésicos"], 0, "La regularidad del sueño, la alimentación y la identificación de desencadenantes pueden ayudar a reducir las crisis."],
    ["¿Qué dolor de cabeza necesita atención urgente?", ["El habitual ya evaluado y sin cambios", "Uno leve tras una noche corta que cede", "Uno leve e idéntico a episodios previos", "Uno súbito que alcanza intensidad máxima en segundos"], 3, "La cefalea súbita de máxima intensidad puede ser señal de hemorragia u otra causa grave y requiere valoración inmediata."]
  ] },
  { id: "hipotiroidismo", title: "Hipotiroidismo", questions: [
    ["¿Dónde se localiza la glándula tiroides?", ["En la pelvis", "En la parte anterior del cuello", "Dentro del riñón", "Detrás de la rodilla"], 1, "La tiroides está situada en la parte anterior del cuello, delante de la tráquea."],
    ["¿Qué síntoma es compatible con hipotiroidismo?", ["Intolerancia marcada al calor como dato típico", "Pérdida de peso obligatoria", "Intolerancia al frío", "Fiebre alta diaria obligatoria"], 2, "El hipotiroidismo puede causar intolerancia al frío, cansancio, estreñimiento y piel seca."],
    ["En el hipotiroidismo primario manifiesto, ¿cómo suele estar la TSH?", ["Elevada", "Siempre indetectable", "No existe en sangre", "Siempre igual a cero"], 0, "En el hipotiroidismo primario manifiesto la TSH suele elevarse mientras la tiroxina libre disminuye."],
    ["¿Qué medicamento se utiliza habitualmente para reemplazar la hormona tiroidea?", ["Amoxicilina", "Salbutamol", "Loratadina", "Levotiroxina"], 3, "La levotiroxina reemplaza la hormona tiroidea y su dosis se ajusta con valoración clínica y análisis."]
  ] },
  { id: "varicela", title: "Varicela", questions: [
    ["¿Qué agente causa la varicela?", ["Bacteria del tétanos", "Virus varicela-zóster", "Hongo de la tiña", "Parásito de la malaria"], 1, "La infección primaria por el virus varicela-zóster produce varicela."],
    ["¿Qué aspecto es típico de las lesiones de varicela?", ["Solo manchas sin evolución", "Únicamente úlceras en los pies", "Lesiones en distintas etapas, incluidas vesículas y costras", "Solo nódulos profundos sin picor"], 2, "Es característico encontrar simultáneamente manchas, pápulas, vesículas y costras, a menudo con picor."],
    ["¿Qué medida ayuda a prevenir la varicela?", ["Vacunación según el esquema indicado", "Tomar antibióticos cada mes", "Evitar todas las frutas", "Usar protector solar únicamente"], 0, "La vacuna reduce el riesgo de varicela y, especialmente, de enfermedad grave."],
    ["Tras la varicela, ¿qué enfermedad puede causar la reactivación del mismo virus?", ["Dengue", "Sarampión", "Gripe", "Herpes zóster"], 3, "El virus puede permanecer latente y reactivarse más adelante como herpes zóster."]
  ] },
  { id: "vitaminas_hidrosolubles", title: "Vitaminas", questions: [
    ["¿Cuál de estas vitaminas es hidrosoluble?", ["Vitamina A", "Vitamina C", "Vitamina D", "Vitamina K"], 1, "La vitamina C y las del grupo B son hidrosolubles; A, D, E y K son liposolubles."],
    ["¿La deficiencia de qué vitamina causa escorbuto?", ["Vitamina D", "Vitamina A", "Vitamina C", "Vitamina K"], 2, "La falta de vitamina C afecta la síntesis de colágeno y puede producir sangrado de encías y mala cicatrización."],
    ["¿Qué vitamina favorece la absorción intestinal de calcio?", ["Vitamina D", "Vitamina B1", "Vitamina B2", "Vitamina C"], 0, "La vitamina D participa en la absorción de calcio y en la salud ósea."],
    ["¿Qué vitamina es necesaria para fabricar varios factores de coagulación?", ["Vitamina C", "Vitamina B12", "Vitamina B6", "Vitamina K"], 3, "La vitamina K es necesaria para la síntesis funcional de varios factores de coagulación."]
  ] },
  { id: "asma", title: "Asma", questions: [
    ["¿Qué sonido respiratorio es frecuente en el asma?", ["Soplo abdominal", "Sibilancias", "Crujido articular", "Zumbido de oído"], 1, "Las sibilancias son sonidos silbantes producidos por el estrechamiento de las vías respiratorias."],
    ["¿Qué exposición puede desencadenar síntomas de asma?", ["Agua potable", "Luz de lectura", "Humo de tabaco", "Lavado de manos"], 2, "El humo del tabaco puede irritar las vías respiratorias y desencadenar o empeorar los síntomas."],
    ["¿Para qué sirve un broncodilatador inhalado?", ["Para abrir las vías respiratorias", "Para curar fracturas", "Para disminuir la glucosa", "Para eliminar cálculos renales"], 0, "Los broncodilatadores relajan el músculo de las vías respiratorias y facilitan el paso del aire."],
    ["Durante una crisis de asma, ¿qué dato indica gravedad?", ["Estornudo aislado", "Picor leve en la nariz", "Tos leve sin dificultad respiratoria", "Dificultad para hablar por falta de aire"], 3, "No poder hablar con normalidad por falta de aire es un signo de crisis grave y requiere atención urgente."]
  ] },
  { id: "neumonia", title: "Neumonía", questions: [
    ["¿Qué órgano afecta principalmente la neumonía?", ["Vejiga", "Pulmón", "Páncreas", "Tiroides"], 1, "La neumonía es una infección del tejido pulmonar."],
    ["¿Qué conjunto de síntomas puede sugerir neumonía?", ["Dolor de muñeca aislado", "Picor de cuero cabelludo", "Tos, fiebre y dificultad para respirar", "Dolor dental sin otros síntomas"], 2, "La tos, la fiebre y la dificultad respiratoria son manifestaciones frecuentes, aunque la presentación varía."],
    ["¿Qué estudio de imagen se utiliza con frecuencia para apoyar el diagnóstico?", ["Radiografía de tórax", "Radiografía de pie", "Ecografía de rodilla", "Mamografía"], 0, "La radiografía de tórax puede mostrar infiltrados compatibles con neumonía en el contexto clínico adecuado."],
    ["¿Todas las neumonías son causadas por bacterias?", ["Sí, siempre", "Solo en niños", "Solo en adultos mayores", "No, también pueden causarlas virus y otros agentes"], 3, "La causa puede ser bacteriana, viral o de otro tipo; el tratamiento depende de la evaluación clínica."]
  ] },
  { id: "tuberculosis", title: "Tuberculosis", questions: [
    ["¿Qué tipo de microorganismo causa la tuberculosis?", ["Virus", "Bacteria", "Hongo exclusivamente", "Gusano"], 1, "La tuberculosis es causada por bacterias del complejo Mycobacterium tuberculosis."],
    ["¿Cómo se transmite principalmente la tuberculosis pulmonar contagiosa?", ["Por picadura de mosquito", "Por tocar ropa limpia", "Por inhalar partículas infecciosas suspendidas en el aire", "Por beber agua fría"], 2, "La transmisión ocurre al inhalar aerosoles de personas con tuberculosis pulmonar o laríngea contagiosa."],
    ["¿Qué síntoma persistente debe motivar estudio de tuberculosis?", ["Tos prolongada", "Hipo de un minuto", "Picor de un dedo", "Estornudo único"], 0, "La tos persistente, especialmente con pérdida de peso, fiebre o sudoración nocturna, requiere valoración."],
    ["¿Qué es fundamental durante el tratamiento de tuberculosis?", ["Suspender al mejorar la tos", "Tomar solo una dosis", "Compartir la medicación", "Completar el esquema indicado bajo seguimiento"], 3, "Completar el tratamiento reduce recaídas y el riesgo de resistencia a los medicamentos."]
  ] },
  { id: "infeccion_urinaria", title: "Infección urinaria", questions: [
    ["¿Qué síntoma es frecuente en una infección de vejiga?", ["Dolor de oído", "Ardor al orinar", "Pérdida de visión", "Dolor de hombro"], 1, "El ardor al orinar y la necesidad frecuente de orinar son síntomas habituales de cistitis."],
    ["¿Cómo se llama la infección que afecta al riñón?", ["Bronquitis", "Conjuntivitis", "Pielonefritis", "Dermatitis"], 2, "La pielonefritis es una infección renal que puede producir fiebre y dolor en el costado."],
    ["¿Qué muestra se utiliza para un urocultivo?", ["Orina", "Saliva", "Cabello", "Sudor"], 0, "El urocultivo busca microorganismos en la orina y puede orientar la selección de antibióticos."],
    ["¿Qué dato en una posible infección urinaria requiere valoración pronta?", ["Hambre antes del almuerzo", "Estornudo aislado", "Uñas quebradizas aisladas", "Fiebre y dolor en el costado"], 3, "La fiebre con dolor en el costado puede indicar infección renal y requiere evaluación médica."]
  ] },
  { id: "enfermedad_renal_cronica", title: "Enfermedad renal crónica", questions: [
    ["¿Durante cuánto tiempo deben persistir las alteraciones renales para considerarlas crónicas?", ["Una hora", "Al menos tres meses", "Un día", "Dos días"], 1, "La enfermedad renal crónica implica alteraciones de la estructura o función renal durante al menos tres meses."],
    ["¿Qué enfermedades son causas frecuentes de enfermedad renal crónica?", ["Conjuntivitis y otitis", "Varicela y rinitis", "Diabetes e hipertensión", "Migraña y caries"], 2, "La diabetes y la hipertensión son causas importantes de daño renal crónico."],
    ["¿Qué hallazgo en la orina puede indicar daño renal?", ["Albúmina elevada de forma persistente", "Ausencia normal de glucosa", "Color amarillo claro únicamente", "Ausencia de bacterias"], 0, "La albuminuria persistente puede indicar daño renal y debe interpretarse junto con otros estudios."],
    ["¿Qué tratamiento puede reemplazar parte de la función renal cuando esta falla gravemente?", ["Lentes correctivos", "Yeso", "Audífono", "Diálisis"], 3, "La diálisis elimina desechos y exceso de líquido cuando está indicada en insuficiencia renal avanzada."]
  ] },
  { id: "insuficiencia_cardiaca", title: "Insuficiencia cardíaca", questions: [
    ["¿Qué describe mejor la insuficiencia cardíaca?", ["Una infección de la piel", "Un corazón que no se llena o bombea adecuadamente", "La ausencia total de latidos en todos los casos", "Una fractura de costilla"], 1, "La insuficiencia cardíaca es un síndrome causado por alteraciones cardíacas que dificultan el llenado o la expulsión de sangre."],
    ["¿Qué signo puede acompañar a la retención de líquido en este trastorno?", ["Cambio del color del iris", "Crecimiento de uñas", "Hinchazón de piernas", "Pérdida del cabello como único signo"], 2, "El edema de las piernas puede reflejar acumulación de líquido, aunque también tiene otras causas."],
    ["¿Qué significa ortopnea?", ["Falta de aire al acostarse que mejora al incorporarse", "Dolor al tragar", "Ardor al orinar", "Visión doble"], 0, "La ortopnea es la dificultad respiratoria en decúbito que mejora al sentarse o elevar el tronco."],
    ["¿Qué cambio conviene comunicar durante el seguimiento de insuficiencia cardíaca?", ["Una uña más larga", "Hambre a la hora habitual", "Estornudo aislado", "Aumento rápido de peso y de la hinchazón"], 3, "Un aumento rápido de peso con más edema puede indicar retención de líquido y requiere consultar al equipo tratante."]
  ] },
  { id: "sindrome_coronario_agudo", title: "Síndrome coronario agudo", questions: [
    ["¿Qué ocurre habitualmente en un infarto de miocardio?", ["Se inflama la vejiga", "Se interrumpe el aporte de sangre a parte del músculo cardíaco", "Se fractura el esternón", "Se infecta el oído"], 1, "Una obstrucción coronaria puede privar de oxígeno al miocardio y causar muerte de tejido."],
    ["¿Qué síntoma puede sugerir un infarto?", ["Picor de un dedo", "Dolor de tobillo al caminar", "Opresión torácica con sudor frío", "Estornudo después de oler polvo"], 2, "La opresión en el pecho con sudoración, náuseas o falta de aire puede indicar un infarto, incluso si hay síntomas atípicos."],
    ["Ante sospecha de infarto, ¿qué debe hacerse?", ["Solicitar atención de emergencia de inmediato", "Esperar hasta el día siguiente", "Hacer ejercicio para probar el corazón", "Conducir solo aunque haya mareo"], 0, "La atención temprana permite diagnosticar y restablecer el flujo coronario cuando corresponde."],
    ["¿Qué prueba registra la actividad eléctrica del corazón?", ["Espirometría", "Urocultivo", "Audiometría", "Electrocardiograma"], 3, "El electrocardiograma es una prueba inicial fundamental ante sospecha de síndrome coronario agudo."]
  ] },
  { id: "accidente_cerebrovascular", title: "Accidente cerebrovascular", questions: [
    ["¿Qué síntoma puede indicar un accidente cerebrovascular?", ["Dolor de uña crónico", "Debilidad súbita de un lado del cuerpo", "Picor leve de nariz", "Estornudo único"], 1, "La debilidad brusca de un lado, la asimetría facial o la dificultad para hablar son señales de alarma."],
    ["¿Qué órgano afecta un accidente cerebrovascular?", ["Estómago", "Vejiga", "Cerebro", "Tiroides"], 2, "Un accidente cerebrovascular altera el flujo sanguíneo o causa sangrado en el cerebro."],
    ["¿Qué dato es importante anotar si aparecen síntomas de un accidente cerebrovascular?", ["La última hora en que la persona estaba sin síntomas", "Su talla de zapatos", "Su comida favorita", "El color de sus ojos"], 0, "La hora de inicio o la última vez que estaba bien orienta las opciones de tratamiento urgente."],
    ["Si la dificultad para hablar desaparece en pocos minutos, ¿qué corresponde hacer?", ["Ignorar el episodio", "Esperar una semana", "Solo dormir", "Buscar atención urgente de todas formas"], 3, "Los síntomas transitorios pueden corresponder a un ataque isquémico transitorio, que también requiere evaluación urgente."]
  ] },
  { id: "epilepsia", title: "Epilepsia", questions: [
    ["Durante una convulsión, ¿qué medida es adecuada?", ["Introducir una cuchara en la boca", "Retirar objetos peligrosos y proteger la cabeza", "Sujetar con fuerza las extremidades", "Dar agua a la fuerza"], 1, "Se debe evitar lesiones, proteger la cabeza y no sujetar a la persona ni introducir objetos en su boca."],
    ["¿Qué debe hacerse con los objetos dentro de la boca durante una convulsión?", ["Introducir un lápiz", "Introducir los dedos", "No introducir ningún objeto", "Colocar una llave"], 2, "Introducir objetos o dedos puede causar lesiones y obstrucción de la vía aérea."],
    ["¿Cuándo requiere ayuda de emergencia una convulsión continua?", ["Si dura cinco minutos o más", "Solo después de una hora", "Nunca", "Solo si ocurre de noche"], 0, "Una convulsión de cinco minutos o más, o crisis repetidas sin recuperación, requiere atención de emergencia. Una primera crisis también necesita evaluación."],
    ["¿Todas las crisis epilépticas producen sacudidas de todo el cuerpo?", ["Sí, siempre", "Solo en adultos", "Solo en niños", "No, también pueden ser focales o alterar brevemente la conciencia"], 3, "Las crisis tienen manifestaciones diversas y no siempre incluyen convulsiones generalizadas."]
  ] },
  { id: "gastroenteritis", title: "Gastroenteritis", questions: [
    ["¿Qué síntoma es habitual en una gastroenteritis?", ["Dolor exclusivo de oído", "Diarrea", "Pérdida de visión", "Debilidad de un brazo de inicio súbito"], 1, "La gastroenteritis suele causar diarrea y puede acompañarse de vómitos, dolor abdominal o fiebre."],
    ["¿Cuál es una prioridad del manejo de diarrea aguda?", ["Dejar de beber siempre", "Tomar antibióticos en todos los casos", "Prevenir y tratar la deshidratación", "Suspender la lactancia en todos los lactantes"], 2, "Reponer agua y electrolitos es fundamental; la solución de rehidratación oral es útil en muchos casos."],
    ["¿Qué medida ayuda a prevenir muchas gastroenteritis infecciosas?", ["Lavarse las manos y manipular alimentos de forma segura", "Compartir vasos sin lavar", "Consumir agua no tratada", "Dejar alimentos perecederos al sol"], 0, "El agua segura, la higiene de manos y la preparación adecuada de alimentos reducen la transmisión."],
    ["¿Qué hallazgo durante la diarrea necesita valoración médica pronta?", ["Apetito conservado", "Sed que cede al beber", "Mejoría progresiva", "Sangre en las heces"], 3, "La sangre en las heces, la deshidratación importante o el dolor intenso requieren evaluación."]
  ] },
  { id: "pancreatitis_aguda", title: "Pancreatitis aguda", questions: [
    ["¿Qué órgano se inflama en la pancreatitis?", ["Bazo", "Páncreas", "Riñón", "Pulmón"], 1, "La pancreatitis aguda es la inflamación súbita del páncreas."],
    ["¿Dónde suele sentirse el dolor de pancreatitis aguda?", ["Solo en un dedo", "Solo en el oído", "En la parte alta del abdomen, a veces hacia la espalda", "Solo en la rodilla"], 2, "El dolor epigástrico intenso que puede irradiarse a la espalda es una presentación frecuente."],
    ["¿Qué causas son frecuentes en la pancreatitis aguda?", ["Cálculos biliares y consumo excesivo de alcohol", "Miopía y caries", "Rinitis y conjuntivitis", "Esguince y fractura"], 0, "Los cálculos biliares y el alcohol son causas frecuentes, aunque existen otras."],
    ["¿Qué enzima sanguínea se mide con frecuencia cuando se sospecha pancreatitis?", ["Hemoglobina", "Albúmina", "TSH", "Lipasa"], 3, "La lipasa elevada, interpretada con los síntomas y otros estudios, ayuda al diagnóstico."]
  ] },
  { id: "colecistitis", title: "Colecistitis", questions: [
    ["¿Qué órgano se inflama en la colecistitis?", ["Apéndice", "Vesícula biliar", "Vejiga urinaria", "Tiroides"], 1, "La colecistitis es la inflamación de la vesícula biliar."],
    ["¿Cuál es una causa habitual de colecistitis aguda?", ["Falta de vitamina C", "Infección del oído", "Obstrucción por un cálculo biliar", "Fractura de un dedo"], 2, "Un cálculo que obstruye el conducto cístico es la causa más frecuente de colecistitis aguda."],
    ["¿Dónde suele localizarse el dolor de la colecistitis?", ["Parte superior derecha del abdomen", "Tobillo izquierdo", "Antebrazo derecho", "Parte posterior de la rodilla"], 0, "El dolor suele localizarse en el hipocondrio derecho y puede acompañarse de fiebre o náuseas."],
    ["¿Qué estudio suele ser inicial ante sospecha de cálculos y colecistitis?", ["Electroencefalograma", "Radiografía de muñeca", "Audiometría", "Ecografía abdominal"], 3, "La ecografía permite valorar cálculos, pared vesicular y otros signos compatibles con colecistitis."]
  ] },
  { id: "sepsis", title: "Sepsis", questions: [
    ["¿Qué describe la sepsis?", ["Una alergia leve al polen", "Disfunción orgánica por una respuesta desregulada a una infección", "Cualquier estornudo", "Una fractura cerrada"], 1, "La sepsis ocurre cuando una respuesta desregulada a una infección produce disfunción orgánica y amenaza la vida."],
    ["¿Cuál de estos focos puede originar una sepsis?", ["Una uña sana", "Una cicatriz antigua sin infección", "Una infección pulmonar", "Una miopía estable"], 2, "La neumonía, las infecciones urinarias y las abdominales, entre otras, pueden causar sepsis."],
    ["En una persona con infección, ¿qué cambio es una señal de alarma?", ["Confusión nueva", "Cabello más largo", "Hambre habitual", "Picor leve aislado"], 0, "La confusión nueva puede ser un signo de disfunción orgánica y requiere valoración urgente."],
    ["Ante sospecha de sepsis, ¿cuál es la conducta adecuada?", ["Esperar varios días", "Usar solo vitaminas", "Hacer ejercicio intenso", "Buscar atención de emergencia"], 3, "La sepsis es una emergencia; el reconocimiento y el tratamiento tempranos son fundamentales."]
  ] },
  { id: "deshidratacion", title: "Deshidratación", questions: [
    ["¿Qué significa deshidratación?", ["Exceso de hueso", "Pérdida de agua corporal mayor que su reposición", "Aumento de glóbulos blancos únicamente", "Inflamación de un tendón"], 1, "La deshidratación aparece cuando las pérdidas de agua superan la ingesta; también puede haber pérdida de sales."],
    ["¿Qué signo puede sugerir deshidratación?", ["Aumento permanente de talla", "Crecimiento de pestañas", "Boca seca y menor cantidad de orina", "Cambio de color del cabello"], 2, "La sequedad de mucosas y la disminución de la orina pueden acompañar a la deshidratación."],
    ["Para reponer pérdidas por diarrea leve o moderada, ¿qué bebida suele ser la más adecuada?", ["Solución de rehidratación oral", "Bebida alcohólica", "Refresco muy azucarado", "Bebida energética"], 0, "La solución de rehidratación oral contiene agua, glucosa y electrolitos en proporciones que favorecen su absorción."],
    ["¿Qué dato puede indicar deshidratación grave?", ["Sed leve que mejora al beber", "Orina habitual", "Buen estado general", "Somnolencia marcada o dificultad para despertar"], 3, "La alteración de conciencia, la incapacidad para beber o los signos de mala circulación requieren atención urgente."]
  ] },
  { id: "vacunacion", title: "Vacunación", questions: [
    ["¿Cuál es el objetivo principal de una vacuna?", ["Tratar todas las fracturas", "Preparar al sistema inmunitario frente a una infección", "Sustituir el agua potable", "Eliminar la necesidad de higiene"], 1, "Las vacunas generan una respuesta inmunitaria que reduce el riesgo de enfermedad o sus complicaciones."],
    ["¿Para qué sirve el registro o carné de vacunación?", ["Medir la presión", "Diagnosticar anemia", "Comprobar dosis recibidas y pendientes", "Calcular la glucosa"], 2, "El registro permite revisar el cumplimiento del esquema y planificar las dosis pendientes."],
    ["¿Las vacunas son necesarias únicamente durante la infancia?", ["No, también pueden indicarse en adultos y personas mayores", "Sí, siempre", "Sí, después nunca se requieren", "Solo se usan al nacer"], 0, "Las indicaciones cambian con la edad, el embarazo, las enfermedades, el riesgo de exposición y el esquema local."],
    ["¿Qué reacción puede ser habitual y leve tras algunas vacunas?", ["Pérdida permanente de visión", "Parálisis obligatoria", "Hemorragia interna habitual", "Dolor en el lugar de aplicación"], 3, "El dolor local y, con algunas vacunas, la fiebre leve pueden ocurrir transitoriamente. Los síntomas intensos o preocupantes requieren valoración."]
  ] },
];

banks.forEach((bank, bankIndex) => {
  bank.questions = bank.questions.map(([question, options, answer, explanation], questionIndex) => {
    const shift = (bankIndex + questionIndex * questionIndex) % options.length;
    return [question, [...options.slice(shift), ...options.slice(0, shift)], (answer - shift + options.length) % options.length, explanation];
  });
});

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
  if (!Array.isArray(answers) || answers.length !== bank.questions.length || Array.from(answers).some(a => !Number.isInteger(a) || a < 0 || a > 3)) {
    throw new Error("Selecciona una respuesta válida para cada pregunta.");
  }
  return {
    score: bank.questions.reduce((total, q, i) => total + Number(q[2] === answers[i]), 0),
    review: bank.questions.map(q => ({ correctAnswer: q[2], explanation: q[3] })),
  };
}

module.exports = { banks, dailyChallenge, gradeAnswers };
