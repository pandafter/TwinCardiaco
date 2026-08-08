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

**`lib/ask.ts`**: traduce lenguaje natural a `{ intervention, efficacy, delay }`
y el motor determinista hace el resto — la IA no puede alucinar un número
porque el espacio de salida es cerrado. Hoy son reglas locales (sin red, sin
API key, sin latencia); el hueco para el LLM está marcado.

**`lib/whatif.ts`**: cuatro ramas (`none`, `inotrope`, `vasopressor`, `fluid`)
con nombres humanos.

---

## 5. Herramientas de verificación

Úsalas: están para no discutir de memoria.

```bash
node scripts/calibrate.ts              # tabla del deterioro sin abrir el navegador
node scripts/calibrate-intervention.ts # respuesta a cada fármaco
node scripts/calibrate-scenarios.ts    # las tres ramas comparadas
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
- **Escalado**: la raíz usa `min(100vw/80, 100vh/53.3)`. Se diseña contra
  1280×853 y todo escala con `rem`. **No uses px absolutos en arbitrary
  values** (`p-[14px]` no escala; `p-3.5` sí).
- **El estiramiento vertical** (`flex-1` + `justify-between`) reparte el
  sobrante y deja huecos enormes. Revisa la captura, no el código.

---

## 7. Qué falta

1. **Cerrar el what-if en lenguaje natural**: `ask.ts` ya traduce la frase y
   los gráficos ya tienen el render punteado. Falta conectar la caja de texto
   con la rama proyectada y decir explícitamente "fuera de alcance" cuando la
   pregunta no cabe en el modelo. **Es lo que justifica la IA entera**: sin
   ella hay cuatro botones; con ella, escenarios infinitos.
2. Sustituir las reglas de `ask.ts` por una llamada real al modelo, dejando
   las reglas como plan B.
3. Verificar la conexión SSE contra el backend corriendo de verdad.

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
