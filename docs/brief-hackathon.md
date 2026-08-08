Como les dije hay unos requisitos que toca tener si o si y son los siguientes teniendo en cuenta lo que se quiere desarrollar:

IA

La IA debe ser parte central del producto. *

Debe existir una arquitectura de agentes que pueda:

* interpretar el estado fisiológico
* detectar cambios
* analizar posibles causas
* evaluar intervenciones
* ejecutar simulaciones
* actualizar sus conclusiones cuando cambia el estado
* coordinar información entre agentes

REAL TIME

Debe ser evidente que la IA sucede en el momento 

La aplicación debe reaccionar inmediatamente cuando:

* llega un nuevo dato fisiológico
*cambia una variable
* aparece una anomalía
* un agente genera un evento
* un humano toma una decisión
* se aplica una intervención
comienza una simulación

Siguiendo este esquema para que todo ocurra en tiempo real 

1.event 2.AI reaction 3. physiological update 4. new event 5. AI reaction


PORTAL

Portal debe tener un papel fundamental.

sincronizar en tiempo real:

* estado del paciente
* variables fisiológicas
* eventos
* actividad de agentes
* intervenciones humanas
* simulaciones
* estado del Digital Twin
* usuarios conectados

Toca tener en cuenta que esto es demasiado importante para ganar

Flow

Tenemos un paciente virtual cuyo estado fisiológico cambia en tiempo real a partir de datos públicos/desidentificados o datos sintéticos.

Queremos representar variables como:

* Frecuencia cardíaca
* Presión arterial
* MAP
* ECG/ritmo cardíaco
* SpO₂
* Frecuencia respiratoria
* Lactato
* Gasto cardíaco
* Perfusión
* Estado hemodinámico

No necesitamos modelar todo el cuerpo ni hacer un modelo clínico perfecto. Necesitamos un modelo fisiológico consistente que permita ver cómo unas variables afectan a otras.



1. El paciente se deteriora

Durante la demo, el paciente comienza estable y luego aparecen cambios fisiológicos.

Por ejemplo:

HR aumento
BP disminución 
MAP disminución 
SpO₂ disminución 
Lactato aumento 

El sistema debe detectar que el paciente está entrando en un estado de inestabilidad.

Debe aparecer algo como:

INESTABILIDAD HEMODINÁMICA

Y queremos un indicador de:

Tiempo estimado hasta estado crítico


1. La IA empieza a reaccionar en tiempo real

No queremos un único chatbot.

Queremos varios agentes especializados que reaccionen al mismo estado fisiológico:

Agente de Cardiología
Analiza ECG, ritmo, frecuencia y estado cardiovascular.

Agente de Farmacología
Analiza posibles efectos fisiológicos de las intervenciones.

Agente de Fisiología
Interpreta las relaciones entre las variables y el deterioro.

Agente de Simulación
Prueba diferentes intervenciones y proyecta posibles trayectorias.

Orquestador
Coordina los agentes y genera un consenso.

Idealmente queremos poder ver en pantalla que los agentes están trabajando:

Analizando nuevo ritmo…
Detectando deterioro de perfusión…
Evaluando intervención…
Ejecutando simulaciones…
Consenso actualizado…

Incluso sería muy bueno que los agentes puedan tener diferencias y que el orquestador tenga que resolver el conflicto.



1. El usuario tiene que tomar una decisión

El sistema debe permitir seleccionar una intervención.

Por ejemplo:

Medicamento A
Medicamento B
Procedimiento
Prueba diagnóstica
Y no intervenir

No necesitamos muchos medicamentos. Para el MVP preferiría 2–3 intervenciones muy buenas



WHAT-IF

Antes de aplicar una intervención, queremos poder preguntar:

¿Qué pasaría si hacemos esto?

El sistema crea diferentes escenarios:

Escenario A: no intervenir
Escenario B: intervención A
Escenario C: intervención B

Y el agente de simulación proyecta cómo podría evolucionar el paciente en cada escenario.

1. Después de la decisión, el gemelo cambia

Si el usuario selecciona una intervención:

INTERVENCIÓN SELECCIONADA

debe generarse un evento en tiempo real.

Después:

1. intervención cambio fisiológico 2. nuevo estado 3. nuevos eventos 4. agentes vuelven a analizar

Portal debe ser fundamental para la arquitectura.

Queremos utilizarlo para sincronizar en tiempo real:

* estado del paciente
* datos fisiológicos
* eventos
* actividad de los agentes
* intervenciones humanas
* simulaciones
* estado del gemelo

Idealmente, si dos personas están conectadas, ambas deberían ver exactamente el mismo paciente y los mismos cambios.

Si una persona selecciona una intervención, la otra debería verla inmediatamente.

La idea es que Portal sea prácticamente el eje central que conecta al paciente virtual, los agentes y los humanos.

Datos

Podemos utilizar datasets públicos/desidentificados de ECG ( MIT-BIH Arrhythmia Database
Base ekg en tiempo real) y otras señales fisiológicas y reproducirlos como si fueran un stream en tiempo real.

También podemos utilizar datos inventados para las variables que no estén disponibles.

** diferenciar claramente:

OBSERVADO: datos provenientes del dataset/stream.

INFERIDO: estado fisiológico calculado a partir de esos datos.

SIMULADO: lo que proyectamos después de una intervención.

No debemos presentar una simulación como si fuera un dato real.


Quiero que el usuario vea esto:

1. Paciente estable

2. Los datos empiezan a cambiar

3. Paciente deteriorándose

4. Los agentes empiezan a reaccionar

5. Tiempo hasta estado crítico disminuyendo

6. La IA simula diferentes intervenciones

7. El humano toma una decisión

8. El Digital Twin cambia

9. La trayectoria fisiológica cambia

10. Todos los usuarios y agentes ven el nuevo estado en tiempo real.



Mismo paciente. Diferente decisión. Diferente trayectoria.



///
Acerca del hackathon:

Construye IA que sucede ahora
​Con el apoyo de Portal

​Únete al Discord: https://discord.gg/9kaUWUT3q

​La mayoría de los productos de IA todavía están pensados para una persona, un prompt y una pantalla de carga. Este fin de semana construiremos lo que viene después.

​The Realtime Hackathon by Portal es un hackathon online de 39 horas para desarrolladores, diseñadores y product builders que quieran crear experiencias de IA capaces de reaccionar, colaborar y evolucionar mientras las cosas suceden.

​Del 7 al 9 de agosto, únete a entre 150 y 200 builders de Latinoamérica y otras partes del mundo. Tendrás un fin de semana para construir un producto funcional, no una presentación, usando IA y Portal para conectar personas, agentes y eventos en vivo.

​¿Qué es Portal?
​Portal es una plataforma para desarrolladores que permite agregar funciones en tiempo real a una aplicación sin tener que construir toda la infraestructura desde cero.

​Ofrece a personas, agentes de IA, aplicaciones y fuentes de datos en vivo una forma compartida de enviar y recibir actualizaciones mientras suceden. Con Portal puedes crear funciones como chats en vivo, presencia, cursores colaborativos, actividad de agentes, seguimiento de ubicación, reacciones de la audiencia y notificaciones.

​Así podrás dedicar el fin de semana a trabajar en la experiencia real del producto, en lugar de preocuparte por cómo mantener sincronizados a cada usuario, agente y pantalla.

​¿Qué podrías construir?
​Podrías crear:

​• Un espacio de trabajo multijugador donde personas y agentes de IA investiguen, escriban o diseñen juntos

​• Una sala de operaciones con IA que monitoree eventos en vivo y coordine varios agentes

​• Un canvas colaborativo donde todos puedan ver los cambios mientras suceden

​• Un mapa en vivo donde la IA reaccione al movimiento, las entregas, los incidentes o los reportes de la comunidad

​• Una transmisión interactiva donde las reacciones de la audiencia influyan en un host de IA

​• Una experiencia de voz en tiempo real, un juego, un marketplace o un experimento social

​• Algo tan nuevo que todavía no tenga una categoría

​Todo proyecto elegible debe incluir una capacidad de IA y una interacción significativa en tiempo real impulsada por Portal entre distintos usuarios, clientes, agentes o fuentes de datos en vivo.

​Qué puedes esperar
​• Una sesión en vivo de introducción a Portal con su fundador, Rodrigo Weilg

​• Clínicas técnicas y apoyo de mentores durante todo el fin de semana

​• Formación de equipos para quienes participen por su cuenta

​• Una presentación en vivo por Discord con los cinco mejores proyectos

​• Una galería permanente con los proyectos participantes

​• US$800 en premios en efectivo

​🥇 Primer lugar: US$500

​🥈 Segundo lugar: US$300

​Cronograma
​Viernes 7 de agosto

​• 19:00: Inicio del hackathon

​• 20:00: Introducción a Portal con Rodrigo

​• 21:00: Comienza el periodo de construcción

​Domingo 9 de agosto

​• 00:00: Se abren las entregas

​• 10:00: Se cierran las entregas

​• 19:00: Presentación de los cinco finalistas y anuncio de los ganadores, en vivo por Discord

​Todos los horarios están expresados en UTC menos 5.

​Puedes participar por tu cuenta o con un equipo de hasta cuatro personas. Los proyectos y demos pueden presentarse en inglés o español.

​Trae tu laptop, tus herramientas de IA favoritas y una idea que valga la pena hacer realidad en vivo.

​Organizado por Portal × Crafter Station.


//
TYC:
1. Información general
The Realtime Hackathon by Portal es un hackathon online de 39 horas organizado por Portal y Crafter Station.

El evento se realizará del viernes 7 al domingo 9 de agosto de 2026 y reunirá a desarrolladores, diseñadores y creadores de productos de Latinoamérica y otras partes del mundo.

Este documento contiene la información oficial del hackathon y es la fuente principal para consultar sus fechas, reglas, requisitos, entregables, premios y condiciones de participación.

2. Objetivo del hackathon
La mayoría de los productos de inteligencia artificial todavía están pensados para una persona, un prompt y una pantalla de carga. Este hackathon busca explorar lo que viene después.

El objetivo es crear productos de inteligencia artificial capaces de reaccionar, colaborar y evolucionar mientras las cosas suceden.

Los participantes tendrán un fin de semana para construir un producto funcional usando inteligencia artificial y Portal. El resultado debe ser un producto que pueda probarse y demostrarse, no solo una idea o una presentación.

3. Qué es Portal
Portal es una plataforma para desarrolladores que permite agregar funciones en tiempo real a una aplicación sin construir toda la infraestructura desde cero.

Portal ofrece a personas, agentes de inteligencia artificial, aplicaciones y fuentes de datos en vivo una forma compartida de enviar y recibir actualizaciones mientras suceden.

Con Portal se pueden crear funciones como:

Chats en vivo.
Indicadores de presencia.
Cursores colaborativos.
Actividad de agentes.
Seguimiento de ubicación.
Reacciones de la audiencia.
Notificaciones.
Sincronización entre usuarios, agentes y aplicaciones.
Esto permite que los participantes se concentren en la experiencia del producto, en lugar de dedicar el hackathon a construir la infraestructura necesaria para mantener sincronizados a los usuarios, agentes y pantallas.

4. Quiénes pueden participar
El hackathon está dirigido a desarrolladores, diseñadores, creadores de productos y personas interesadas en construir experiencias con inteligencia artificial y tecnología en tiempo real.

La participación es online y está abierta a personas de Latinoamérica y otras partes del mundo.

Se puede participar:

De manera individual.
En un equipo de hasta cuatro integrantes.
Las personas que participen individualmente podrán usar los espacios de Discord para presentarse, conocer a otros participantes y formar un equipo.

5. Discord oficial
La comunidad y las comunicaciones del hackathon estarán disponibles en el servidor de Discord de Portal:

Unirse al Discord de Portal

Los participantes podrán usar los siguientes canales:

#announcements
Este es el canal oficial para compartir información importante del hackathon.

La organización utilizará este canal para publicar:

Calendarios y enlaces para agendar mentorías.
Fechas y horas límite.
Recordatorios sobre las entregas.
Actualizaciones del cronograma.
Anuncios importantes durante el evento.
Cualquier otra información que los participantes deban conocer.
#team-lookup
Este canal se usará para que los participantes se presenten y busquen personas con quienes formar un equipo.

#general
Este canal se usará para conversar sobre el hackathon, conocer a otros participantes y organizar equipos.

#soporte-hackathon
Este canal se usará para preguntas puntuales sobre las reglas, el cronograma, las entregas y la organización del hackathon.

#soporte-portal
Este canal se usará para preguntas técnicas o puntuales relacionadas con Portal.

6. Requisitos de los proyectos
Para ser elegible, cada proyecto debe cumplir con todos los siguientes requisitos:

Incluir una capacidad de inteligencia artificial.
Utilizar Portal como parte del producto.
Incluir una interacción significativa en tiempo real impulsada por Portal.
Conectar usuarios, clientes de software, agentes o fuentes de datos en vivo independientes.
Contar con un producto funcional que pueda probarse y demostrarse.
Tener un repositorio público en GitHub.
Tener una versión desplegada del producto.
Presentar todos los entregables antes del cierre de las entregas.
Una presentación, una idea o un concepto sin un producto funcional no será suficiente para participar como proyecto elegible.

La integración con Portal debe ser una parte importante de la experiencia. No basta con mencionar Portal o agregarlo al proyecto sin una interacción real entre usuarios, agentes, aplicaciones o fuentes de datos en vivo.

7. Periodo válido de commits
Para la evaluación, solo se tendrán en cuenta los commits realizados dentro del siguiente periodo:

Inicio: viernes 7 de agosto de 2026 a las 19:00, UTC menos 5.

Cierre: domingo 9 de agosto de 2026 a las 10:00, UTC menos 5.

Los commits realizados antes o después de este periodo no se tendrán en cuenta durante la evaluación.

Los participantes deben asegurarse de que todos los commits relevantes estén disponibles en el repositorio público de GitHub enviado como parte de la entrega.

Si la entrega se basa en un producto existente, el repositorio debe incluir un tag llamado the-realtime-hackathon que agrupe los commits realizados durante el periodo oficial. En estos casos, solo se evaluará el trabajo incluido en esos commits.

8. Requisitos de la entrega
Las entregas deben enviarse mediante el formulario oficial de The Realtime Hackathon.

Cada entrega debe incluir:

El nombre del equipo.
Los nombres de todos los integrantes del equipo, separados por comas.
El nombre de usuario de Discord de al menos un integrante, que será el contacto del equipo.
Un pitch del producto de 280 caracteres o menos.
La URL del producto desplegado, donde el equipo evaluador pueda probarlo.
La URL de una demo grabada de 1 minuto y 30 segundos como máximo.
La URL del repositorio público en GitHub.
Una explicación de cómo se utilizó Portal en el producto.
Demo en vivo
La URL del producto desplegado debe permitir que el equipo evaluador pruebe una versión funcional del producto.

Demo grabada
La demo grabada debe presentar y explicar el producto construido y puede estar editada. Debe durar como máximo 1 minuto y 30 segundos y estar disponible mediante una URL accesible para el equipo evaluador, por ejemplo, en YouTube, Loom, Screen Studio, LinkedIn, Instagram o X.

Repositorio de GitHub
El repositorio de GitHub debe ser público. Si corresponde a un producto existente, debe incluir un tag llamado the-realtime-hackathon que agrupe los commits realizados durante el evento.

La entrega debe explicar claramente:

Qué hace el producto mediante un pitch de 280 caracteres o menos.
Cómo se utilizó Portal.
La entrega debe completarse antes de las 10:00 del domingo 9 de agosto de 2026, UTC menos 5.

9. Idiomas permitidos
Los proyectos, videos y demostraciones pueden presentarse en:

Español.
Inglés.
10. Evaluación
La evaluación tendrá en cuenta el uso de Portal dentro del producto.

El equipo evaluador revisará la explicación incluida en el formulario de entrega para entender cómo se utilizó Portal y qué papel cumple dentro de la experiencia. También podrá revisar el repositorio público, la demo en vivo y la demo grabada.

Durante la evaluación, solo se tendrán en cuenta los commits realizados dentro del periodo oficial indicado en este documento. Para productos existentes, se evaluarán únicamente los commits agrupados en el tag the-realtime-hackathon.

11. Ideas de proyectos
Los participantes pueden construir cualquier producto que cumpla con los requisitos del hackathon. Algunos ejemplos son:

Un espacio de trabajo multijugador donde personas y agentes de inteligencia artificial investiguen, escriban o diseñen juntos.
Una sala de operaciones con inteligencia artificial que monitoree eventos en vivo y coordine varios agentes.
Un canvas colaborativo donde todos los participantes puedan ver los cambios mientras suceden.
Un mapa en vivo donde la inteligencia artificial reaccione al movimiento, las entregas, los incidentes o los reportes de la comunidad.
Una transmisión interactiva donde las reacciones de la audiencia influyan en un presentador de inteligencia artificial.
Una experiencia de voz en tiempo real.
Un juego, marketplace o experimento social con interacciones en tiempo real.
Una propuesta nueva que todavía no tenga una categoría definida.
Estos ejemplos son referenciales. Se pueden presentar ideas diferentes siempre que cumplan con los requisitos de elegibilidad.

12. Cronograma oficial
Todos los horarios están expresados en UTC menos 5, correspondiente a la hora de Lima.

Viernes 7 de agosto de 2026
19:00: Inicio oficial del hackathon y del periodo válido de commits.

20:00: Portal Quick Start con Rodrigo Weilg, fundador de Portal.

21:00: Inicio de la ventana principal de construcción.

Sábado 8 de agosto de 2026
09:00 a 21:00: Mentorías para los participantes.

La organización compartirá los calendarios individuales de los mentores en el canal #announcements.

Los participantes podrán agendar una sesión directamente mediante los enlaces de Cal.com o Calendly de cada mentor.

Domingo 9 de agosto de 2026
00:00: Apertura de las entregas.

10:00: Cierre de las entregas y del periodo válido de commits.

19:00: Reunión final en vivo por Discord, presentación de las demos ganadoras y anuncio del primer y segundo puesto.

13. Mentorías y soporte
Las mentorías se realizarán el sábado 8 de agosto de 2026, entre las 09:00 y las 21:00, UTC menos 5.

Los calendarios y enlaces para reservar sesiones se compartirán en el canal #announcements. Cada mentor utilizará Cal.com o Calendly para gestionar sus reservas.

Además de las mentorías, los participantes podrán hacer consultas durante el hackathon en:

#soporte-hackathon para preguntas sobre el evento.
#soporte-portal para preguntas relacionadas con Portal.
14. Presentación final
La reunión final se realizará el domingo 9 de agosto de 2026 a las 19:00, UTC menos 5, en vivo por Discord.

Durante esta reunión:

Se presentarán las demos de los proyectos ganadores.
Se anunciará el proyecto que obtuvo el primer puesto.
Se anunciará el proyecto que obtuvo el segundo puesto.
15. Premios
El hackathon entregará un total de US$800 en premios en efectivo, distribuidos de la siguiente manera:

🥇 Primer puesto: US$500.

🥈 Segundo puesto: US$300.

16. Galería de proyectos
Los proyectos construidos durante el hackathon podrán formar parte de una galería permanente dedicada a mostrar los productos creados durante el evento.

17. Resumen de condiciones principales
Para participar, cada proyecto debe:

Ser presentado por una persona o un equipo de hasta cuatro integrantes.
Contar con un producto funcional.
Incluir una capacidad de inteligencia artificial.
Utilizar Portal para crear una interacción significativa en tiempo real.
Conectar usuarios, clientes de software, agentes o fuentes de datos independientes.
Tener un repositorio público en GitHub.
Tener una versión desplegada.
Incluir una demo grabada de 1 minuto y 30 segundos como máximo.
Incluir el nombre del equipo y los nombres de todos sus integrantes.
Incluir el nombre de usuario de Discord de al menos un integrante como contacto.
Incluir un pitch de 280 caracteres o menos.
Explicar cómo utiliza Portal.
Tener commits realizados dentro del periodo oficial y, si se trata de un producto existente, agruparlos en el tag the-realtime-hackathon.
Presentarse en español o inglés.
Entregarse antes del domingo 9 de agosto de 2026 a las 10:00, UTC menos 5.
18. Organización
The Realtime Hackathon by Portal es organizado por:

Portal × Crafter Station

Endpoints

GET	/api/health	estado de portal, llm, agentes
GET	/api/state	snapshot (plan B si cae el stream)
GET	/api/stream	SSE con todos los eventos
GET	/api/events?since=	replay del log
GET	/api/interventions	construir los botones dinamicamente
GET	/api/agents	que ve y que optimiza cada agente
GET	/api/heart3d	colores derivados para la malla
POST	/api/scenario/shock	disparar el deterioro
POST	/api/scenario/reset	reiniciar para ensayar
POST	/api/intervention	aplicar (valida y republica)
POST	/api/whatif	proyectar las ramas
POST	/api/deliberate	forzar ronda de agentes
POST	/api/portal/token	acuñar JWT del browser




///
La idea en una frase: es un simulador de vuelo, pero para decisiones médicas.

Los pilotos entrenan en simuladores donde se les apaga un motor y practican sin que muera nadie. En medicina eso no existe: un médico aprende a manejar un paciente que se está muriendo, manejando pacientes que se están muriendo. Queremos construir ese simulador para el corazón.

Cómo se ve funcionando

Abres la pantalla y hay un paciente vivo: un corazón latiendo y unos signos vitales moviéndose segundo a segundo. Al principio está estable. A los 30 segundos entra en una arritmia — el corazón se desboca — y empieza una cadena: late tan rápido que no alcanza a llenarse de sangre entre latido y latido, entonces bombea menos, cae la presión, y el cuerpo se queda sin oxígeno.

Esa cadena se ve encendiéndose en pantalla, eslabón por eslabón, en vivo. Aparece un reloj de "tiempo hasta estado crítico" contando hacia abajo.

Abajo hay cuatro botones de intervención. Antes de tocar cualquiera, pasas el mouse por encima y se dibuja la trayectoria de qué pasaría si eliges ese. Eliges uno, el paciente responde, la trayectoria cambia. Y al final muestras las dos líneas juntas: mismo paciente, distinta decisión, distinto desenlace.

Eso es todo el producto. Un escenario clínico, cuatro intervenciones, y que el tiempo real se sienta impecable.

Las tres piezas técnicas

1. El motor. Cuatro ecuaciones corriendo en el servidor a 4 ticks por segundo. Determinista, sin IA. Es lo que hace que cuando sube la frecuencia, caiga la presión — siempre igual, siempre consistente. Los efectos de cada intervención van quemados en una tabla que escribimos nosotros a mano.

2. La IA. Y aquí lo importante: la IA nunca calcula fisiología. No decide cuánto baja la presión un medicamento, eso ya está en la tabla. La IA hace tres cosas distintas:

- Traduce la descripción de un paciente en texto ("67 años, hipertenso, cardiopatía previa") a los parámetros iniciales del motor.
- Interpreta lo que está pasando y lo explica en español, en streaming.
- Y la clave: una caja de texto donde preguntas cualquier cosa en lenguaje natural — "¿y si le doy líquidos primero y lo cardiovierto dos minutos después?" — y la IA traduce esa frase a parámetros del motor, corre la simulación y dibuja esa trayectoria.

Ese último punto es lo que justifica la IA entera. Sin él tenemos cuatro botones y una simulación bonita, y el jurado nos va a decir que es un chatbot pegado encima. Con él tenemos algo que no se puede hacer sin un modelo de lenguaje. Si toca sacrificar algo, sacrificamos lo visual antes que eso.

3. Portal, que es la tecnología del patrocinador. Mantiene todo sincronizado en tiempo real: si dos personas abren la pantalla, ven el mismo paciente, y una intervención de uno aparece en la pantalla del otro al instante. Necesito que revisemos las docs, porque de sus primitivas depende si sincronizamos el estado completo en cada tick o solo los cambios.

Sobre los agentes

Van a ser tres, no cinco: uno que interpreta el estado, uno que explica los escenarios, y un orquestador que sintetiza. Y no corren en cada tick — solo se despiertan cuando algo cruza un umbral o hay una intervención. Entre eventos están callados. Eso baja el costo casi por completo y es lo que permite que corra en vivo.

Las trayectorias proyectadas las precalcula el motor apenas el paciente se desestabiliza. El agente solo las narra. Si el modelo tuviera que producir los números, no corre en tiempo real.

Cómo propongo repartirlo

Tres frentes en paralelo, sin dependencias:

- Motor y tabla de intervenciones. TypeScript puro, sin UI, se prueba en consola.
- Frontend con un motor mock corriendo en el cliente, para que no espere al backend. Todoando el backend esté listo se cambia la fuente de datos sin tocar un componente.
- La capa de tiempo real con Portal, apenas tengamos docs.

Dos advertencias

Hay un wizard de configuración de cuatro pantallas antes del monitor. En la demo dura 15 segundos. El monitor en vivo es el producto. Si nos enamoramos del wizard, llegamos al final con un formulario
precioso y sin demo.

Y una regla que no se rompe: lo simulado nunca se ve como lo medido. Toda proyección va pse presenta como prototipo de investigación y educación, no como herramienta clínica, y esa distinción tiene que ser visible en pantalla.