# Cardiac Twin — estado y contexto para continuar

Léelo antes de tocar código. Los documentos de producto son
`cardiac-twin-proyecto.md` (mapa de pantallas y prioridades) y
`cardiac-twin-context.md` (detalle del monitor).

---

## 1. Qué es

Un gemelo digital cardíaco en tiempo real. Un paciente virtual se deteriora en
vivo, unos agentes lo analizan y el usuario prueba decisiones para ver a dónde
llevan **antes** de tomarlas.

La pregunta que responde: **¿qué pasa si actuamos ahora?**

La cadena que todo el producto hace visible:

```
PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
```

No es decorativa: está implementada. Sube una constante del llenado
ventricular en `lib/engine.ts` y caen en cascada presión, saturación, lactato
y tiempo a crítico. **No hay números pintados a mano en ninguna pantalla.**

### El argumento que justifica el proyecto

| Decisión | Presión | Gasto cardíaco | Lactato |
|---|---|---|---|
| Vasopresor (noradrenalina) | **sube** 65→77 | no mejora, 4.9→4.4 | no baja |
| Inotrópico (dobutamina) | sube 65→80 | 4.9→7.0 | baja |

El vasopresor sube el número que todos miran mientras el que importa empeora.
Una tabla de rangos no puede mostrar eso. Está en el motor, no en un texto.

Sale de dos cosas que hay que **conservar** al tocar el motor:
- la **poscarga**: subir la SVR reduce el volumen sistólico;
- la **perfusión depende del flujo**, no solo de la presión
  (`(map/85)*0.45 + (co/7.4)*0.55`).

Si alguien "simplifica" cualquiera de las dos, el proyecto pierde su tesis.

---

## 2. Dónde está y cómo se corre

Repo `pandafter/TwinCardiaco`, rama `main`.
`Backend/` es Python (no tocar sin hablarlo). `Frontend/` es este proyecto.

```bash
cd Frontend
npm run dev      # desarrollo, puerto 3210
npm run demo     # build + start: ESTO es lo que se usa para presentar
```

**Para la demo usa siempre `npm run demo`.** En dev, Turbopack inyecta parte
del CSS por JavaScript; si el servidor se reinicia con una pestaña abierta, el
HMR se cae y la página queda con estilos parciales — el grid no aplica y los
elementos `absolute` se posicionan contra el viewport. Parece un bug de
layout y no lo es.

Rutas: `/` (selección de paciente), `/monitor`, `/compare`, `/response`.

`/monitor?sala=uci-3` abre la **sesión compartida**. Para probarla sin un
segundo computador: dos ventanas de incógnito distintas (la identidad vive
en `sessionStorage`, así que dos pestañas normales del mismo perfil también
sirven).

**La IA necesita `ANTHROPIC_API_KEY`** en `.env.local` — ver
`.env.local.example`. Sin ella todo funciona igual, con reglas locales, y la
pantalla lo dice.

---

## 3. Arquitectura

### Una sola fuente de datos

Toda la UI lee de `usePatientState()` → `lib/patientStore.ts`. Ningún
componente sabe de dónde vienen los datos.

```
Backend (SSE /api/stream) ──┐
                            ├──► patientStore ──► usePatientState ──► UI
Motor local (engine.ts) ────┘
```

`lib/live.ts` habla con el backend por SSE y **solo traduce campos**; si un
valor no viene del servidor se deja en `null` y la UI lo oculta, no se
inventa. Si el stream cae, se degrada al motor local y se avisa en pantalla.

### El motor

`lib/engine.ts` produce **el mismo payload** que
`Backend/cardiotwin/physiology.py` en `PhysioState.vitals()`, y usa los mismos
umbrales que `assess_state()` en `interventions.py`. Por eso cambiar de fuente
no toca componentes.

Los coeficientes de las intervenciones salen de `_inotrope`, `_vasopressor` y
`_fluid` del backend.

### El sistema de diseño

`globals.css` define la escala tipográfica completa como tokens
(`--fs-micro` … `--fs-num-lg`) y Tailwind los expone como `text-micro`,
`text-label`, `text-body`, `text-lead`, `text-num`.

**`--fs-micro` (0.6rem) es el piso. Nada baja de ahí.** La barra de decisión
llegó a usar `text-[0.4375rem]` — unos 8px en un portátil — y ese era el
motivo real de que "no se entendieran los botones": no estaban mal
redactados, estaban ilegibles. No vuelvas a meter tamaños arbitrarios en
`text-[...]`.

El color es información: rojo/ámbar/verde solo dicen estado del paciente,
azul y violeta solo identifican series del gráfico, y el dorado es lo
accionable. Lo que no significa nada va en gris. Se eliminó el cian como
color de acción (era un sexto acento compitiendo).

### Reglas duras del proyecto

1. **Lo simulado nunca se ve como lo medido.** Toda proyección va punteada,
   más tenue y rotulada. Si alguien confunde una proyección con una medición,
   el proyecto falla en su premisa.
2. **El frontend no calcula fisiología.** El motor vive aislado; los
   componentes solo dibujan.
3. **Lenguaje humano primero.** El jurado no es médico. "El corazón bombea 40%
   menos", no "taquiarritmia con compromiso hemodinámico". El término técnico
   va al lado, en pequeño.
4. **Ningún agente emite una cifra que no venga del motor**, y cada hallazgo
   trae su evidencia.

---

## 4. Qué hay construido

**Pantallas**: selección de paciente, monitor en vivo (corazón latiendo al
ritmo real, ECG, cadena causal, tendencias, barra de decisión), comparación de
escenarios y respuesta a la intervención.

**Piezas vivas**: `BeatingHeart` late al HR real con intervalo agendado latido
a latido, doble contracción, amplitud según volumen sistólico y color según
perfusión. `EcgStrip` genera sus complejos según la frecuencia.

**La IA es real** y vive en dos route handlers de Next (`src/app/api/`):

- `POST /api/ask` — el modelo lee el estado del paciente EN ESE INSTANTE,
  lo explica (`reading`) y traduce la pregunta a `{intervention, efficacy,
  delay_s}`. La fisiología la calcula el motor: el esquema JSON es cerrado,
  no hay ningún campo donde escribir una cifra inventada.
- `POST /api/agents` — TRES llamadas, no una que devuelva tres opiniones.
  Cada especialista corre con su system prompt y una vista FILTRADA del
  estado, así que el desacuerdo nace de que miran cosas distintas. Los dos
  en paralelo; el orquestador después, porque los lee. Se pide una vez por
  hito (cambio de estado o decisión tomada), no por tick.

`lib/ask.ts` sigue existiendo como respaldo local y define el mismo
contrato. Si no hay key, si la red falla o si el modelo declina, se cae a
esas reglas y la UI marca la fuente (`IA` / `reglas locales`).

**Por qué no el backend de Python**: corre Python 3.9.6 sin fastapi, numpy,
scipy ni numba instalados; su `Orchestrator` todavía rostrea `farmacologia`
(el agente que el front eliminó) y apunta a `claude-sonnet-4-6`, un ID que
no existe. La ruta de Next no depende de nada de eso.

**`lib/whatif.ts`**: cuatro ramas (`none`, `inotrope`, `vasopressor`, `fluid`)
con nombres humanos y veredicto en una frase sin jerga. Se precalculan y se
cachean, así el hover dibuja la trayectoria al instante.

**El monitor es UNA escena que cambia de foco**, no siete bloques a la vez:
el paciente / lo que dice la IA / las opciones / el resultado. Avanza sola
con el estado, y las tabs permiten volver a cualquiera. `FlowGuide` muestra
en qué paso va el caso y qué se espera del usuario.

**Se puede intervenir varias veces.** `interventionLog` acumula; lo único
que bloquea la barra es la asistolia. Poder equivocarse y rescatar es lo que
separa un simulador de una encuesta de una sola pregunta.

**El corazón puede pararse.** La hipoperfusión sostenida daña la bomba
(rápido para romperse, lento para repararse) y acaba en asistolia: ECG
plano, vitales en cero, fármacos rechazados. El reloj de la cabecera pasa a
"hasta que el corazón deje de latir" en cuanto existe.

```
sin intervenir ................. paro a 07:48
cualquier decisión al 2:30 ..... no hay paro
vasopresor tarde (5:00) ........ paro a 09:56, solo lo retrasa
```

**El ECG cambia de morfología, no solo de velocidad**: descenso del ST,
onda T que se aplana y se invierte, bajo voltaje y QT largo, todo
progresivo con la perfusión. Los hallazgos se nombran junto al trazado.

**Sesión compartida** (`?sala=`): uno propone, otro aprueba o veta, y solo
entonces se aplica — en las dos pantallas. Nadie resuelve su propia
propuesta. Estando solo, nada de esto aparece.

**Tres agentes**: Cardiología (protege el miocardio), Fisiología (protege el
oxígeno sistémico) y Orquestador. **No fusiones los dos primeros**: el
conflicto entre ellos es el mejor activo del sistema y nace de que sus
objetivos se oponen en shock cardiogénico. Farmacología se eliminó (sus
riesgos ya vienen en `risks[]`) y Simulación no opina — es una tool.

---

## 5. Herramientas de verificación

Úsalas: están para no discutir de memoria.

```bash
node scripts/calibrate.ts              # tabla del deterioro sin abrir el navegador
node scripts/calibrate-intervention.ts # respuesta a cada fármaco
node scripts/calibrate-scenarios.ts    # las tres ramas comparadas
node scripts/calibrate-arrest.ts       # cuándo para el corazón, con y sin intervenir
node scripts/check-room.mjs            # la sesión compartida, con dos navegadores
node scripts/console-check.mjs / /monitor /compare   # errores del navegador por ruta
node scripts/icon-catalog.mjs          # los 45 iconos a design/icons.png
npm run shot                           # captura a 1840×1230 + recortes por zona
```

`npm run shot` acepta `SHOT_URL`, `SHOT_OUT`, `SHOT_W`, `SHOT_H`.
Las pantallas aceptan `?t=130&freeze=1` para congelar un estado reproducible.

**Antes de dar algo por bueno**: `npm run build`, `console-check` en todas las
rutas, y una captura mirada de verdad.

---

## 6. Trampas ya pagadas — no las repitas

- **`Math.sin` no es determinista entre motores JS.** El ruido lo usaba y la
  diferencia se acumulaba hasta romper la hidratación (servidor y cliente
  dibujaban coordenadas distintas en el decimal 14). Ahora es un hash entero
  de 32 bits. **No metas `Math.sin`, `Math.random` ni `Date.now()` en el
  motor.**
- **El motor es mutable.** Instanciarlo en el cuerpo del render hace que
  StrictMode lo adelante dos veces. Va dentro del initializer de `useState`.
- **Las columnas del grid necesitan `minmax(0,1fr)`.** Sin eso el contenido
  empuja la última columna fuera de la pantalla.
- **Componentes con `relative` propio** (`EcgStrip`) ignoran un `absolute`
  pasado por `className`: en Tailwind `relative` gana. Hay que envolverlos.
- **Escalado**: la raíz usa `clamp(14px, min(100vw/78, 100vh/46), 44px)`.
  Todo escala con `rem`. **No uses px absolutos en arbitrary values**
  (`p-[14px]` no escala; `p-3.5` sí). El divisor de alto era 53.3 y en una
  laptop normal la base caía a ~14px: todo se veía un tercio más pequeño que
  en la maqueta. Si vuelves a tocarlo, verifica a 1440×800, no solo a 1840.
- **El estiramiento vertical** (`flex-1` + `justify-between`) reparte el
  sobrante y deja huecos enormes. Revisa la captura, no el código.
- **Las ramas what-if se juzgan contra "no hacer nada", no contra el estado
  inicial.** Con un paciente que se deteriora, TODAS las ramas empeoran en
  absoluto y las cuatro opciones decían literalmente lo mismo. La
  comparación relativa (`vsNone`) es la que produce el dilema del producto.
- **La intervención no se puede pasar al constructor del motor** para
  proyectar: su bucle termina en `decisionAt - dt` y la condición `t >= at`
  nunca se cumple. Se aplica dentro del bucle de proyección.
- **Nada que se abra puede empujar el layout.** La respuesta a una pregunta
  crecía dentro del flujo y la columna de vitales perdía dos filas justo
  cuando el usuario acababa de preguntar. Ahora flota anclada sobre la barra
  (`absolute bottom-full`) con fondo opaco.
- **`overflow-hidden` corta a media línea y parece un fallo de render.** Para
  texto usa `line-clamp-N`; `overflow-hidden` solo como red de seguridad del
  contenedor.
- **Márgenes mágicos contra un grid `items-start`.** La home usaba
  `mt-[3.4rem]` / `mb-[3.25rem]` para alinear columnas a ojo: el corazón hero
  se salía de su tarjeta y tapaba el título, y el pie se solapaba con el rail.
  Se sustituyeron por un grid de dos columnas con `min-h-0` en toda la cadena.

---

## 7. Qué falta

Del lado del **frontend**:

1. Verificar el SSE contra el backend corriendo de verdad. Está escrito y
   degrada bien sin él, pero nunca se ha probado con datos reales.
2. **`/compare` y `/response` ya no están enlazadas desde ninguna parte**
   (se borró `shell/Shell.tsx`, que era el único sitio con ese nav y además
   no lo importaba nadie). Siguen accesibles por URL y siguen mostrando datos
   inventados: "PORTAL CONECTADO", "4 agentes", "2 usuarios conectados" y
   timestamps fijos `13:58:00`. **No las enseñes en la demo.** O se alinean al
   monitor o se borran.
3. El motor solo simula el caso recomendado. La home ya lo dice en pantalla
   (chip `SIMULABLE` frente a `solo ficha`, y un aviso en el pie), pero si
   alguien quiere los otros tres casos hay que parametrizar `Engine`.

Del lado del **backend** (pedido al equipo, en orden):

1. **`POST /api/ask`** — no existe y es lo que justifica la IA. El contrato
   exacto está implementado en `lib/ask.ts`: el LLM devuelve
   `{intervention, efficacy, delay_s}` con structured output y espacio
   cerrado, nunca números de fisiología. Necesita que `Intervention.apply()`
   acepte `efficacy` y `delay`.
2. **`filling_pct` en `vitals.tick`** — es el segundo eslabón de la cadena
   causal. Sin él, el front tiene que derivarlo de `hr`, que es justo lo que
   la regla 2 prohíbe.
3. **`deterioration_risk` y `trend`** — o los manda el servidor o se quitan
   de la pantalla.
4. **`vs_none` en cada escenario de `compare_scenarios()`** — comparar contra
   el estado inicial no distingue nada, porque en un paciente que se
   deteriora todas las ramas empeoran. Ver la trampa en la sección 6.
5. **Portal**: `PUBLISH_PATH` sigue siendo un `TODO`, falta el listener del
   canal `actions` y falta presence. El SSE ya salva la demo — no jugarse la
   presentación peleando con esto.

---

## 8. Honestidad clínica — no lo pierdas de vista

**Esto no tiene utilidad clínica y no debe presentarse como si la tuviera.**
El backend lo dice en su cabecera: *"valores fisiológicamente plausibles pero
NO validados contra pacientes. Motor de escenarios, no predictor."* Los
coeficientes son plausibles, no medidos; el paciente es genérico.

Dos números parecen más rigurosos de lo que son y conviene saberlo:

- **"tiempo hasta estado crítico"** es una extrapolación lineal de la
  pendiente actual, no una predicción validada;
- **los porcentajes de confianza e incertidumbre** de los agentes son
  literales en el código, no una estimación.

Lo que sí se sostiene: es un **simulador para enseñar razonamiento
hemodinámico**. La cadena causal es fisiología de libro y la disociación entre
presión y gasto con vasopresores es un concepto clínico establecido. Declarar
el límite antes de que lo pregunten da credibilidad al resto.
