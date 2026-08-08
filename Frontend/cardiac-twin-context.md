# CARDIAC TWIN — Contexto para la primera pantalla

Pega este archivo en la raíz del proyecto. Es el contexto que el agente de VS Code
debe leer antes de escribir código.

---

## 1. Qué estamos construyendo

Un **gemelo digital cardíaco en tiempo real** para un hackathon. Un paciente
virtual se deteriora en vivo, agentes de IA lo analizan, y el usuario prueba
intervenciones para ver cómo cambia la trayectoria.

Es un prototipo de investigación y educación. NO es una herramienta clínica,
no diagnostica y no recomienda tratamientos.

**Escenario único:** fibrilación auricular con respuesta ventricular rápida que
lleva a inestabilidad hemodinámica.

La cadena causal que todo el producto debe hacer visible:

```
PULSO ↑ → LLENADO ↓ → SANGRE BOMBEADA ↓ → PRESIÓN ↓ → OXÍGENO ↓
```

---

## 2. Alcance de ESTA tarea (primera pantalla)

Solo frontend. Sin backend, sin websockets, sin IA todavía.

Un **motor mock local** corriendo en el cliente a 4 ticks por segundo genera el
estado del paciente y lo deteriora progresivamente. Esto permite que la pantalla
se vea completamente viva desde el minuto uno, y luego se reemplaza la fuente de
datos por el stream real sin tocar la UI.

**Regla de arquitectura:** toda la UI lee de un solo hook `usePatientState()`.
Hoy ese hook devuelve datos del mock. Mañana devuelve datos del socket. Ningún
componente sabe de dónde vienen los datos.

---

## 3. Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Motion (framer-motion) para animación
- Sin librerías de charts pesadas: los gráficos son SVG a mano (son series
  simples y necesitamos control total del render)

---

## 4. El estado del paciente

```ts
type PatientState = {
  t: number                    // segundos desde el inicio
  vitals: {
    hr: number                 // lpm
    sbp: number; dbp: number   // mmHg
    map: number                // mmHg — la variable protagonista
    spo2: number               // %
    rr: number                 // rpm
    lactate: number            // mmol/L
    rhythm: 'SINUS' | 'AFIB_RVR'
  }
  derived: {
    cardiacOutput: number      // L/min
    strokeVolume: number       // mL
    fillingPct: number         // 0–1, qué tanto alcanza a llenarse
    perfusion: number          // 0–1
    status: 'STABLE' | 'UNSTABLE' | 'CRITICAL'
    timeToCritical: number | null  // segundos
  }
}
```

### Motor mock

Corre a 250 ms. Ecuaciones reales, simples:

```ts
const tDiastole   = Math.max(0.05, 60 / hr - 0.3)
const fillingPct  = clamp(tDiastole / 0.5, 0, 1)
const strokeVol   = svMax * fillingPct * contractility * (rhythm === 'AFIB_RVR' ? 0.82 : 1)
const cardiacOut  = (strokeVol * hr) / 1000
const map         = (cardiacOut * svr) / 80 + 4
const perfusion   = clamp(map / 85, 0, 1)
// lactato sube cuando la perfusión cae:
lactate += (perfusion < 0.7 ? (0.7 - perfusion) * 0.9 : -0.1 * lactate) * dt
```

Guion del deterioro, para que la demo sea reproducible:

| Tiempo | Qué pasa |
|---|---|
| 0–30 s | Estable. Ritmo sinusal, HR ~78, MAP ~88 |
| 30 s | Entra en fibrilación auricular. HR salta a 130 |
| 30–120 s | HR sube gradualmente a 160. MAP cae. Lactato sube |
| 90 s | Cruza a `UNSTABLE`. Aparece `timeToCritical` |

Añade ruido de ±2 % a cada vital para que se vea vivo, nunca perfectamente liso.

En fibrilación auricular, los intervalos entre latidos deben ser **irregulares**.
Este detalle importa: es lo que hace que el corazón en pantalla se vea enfermo.

---

## 5. Layout de la pantalla

Monitor clínico, pantalla completa, fondo oscuro. Cuatro zonas:

```
┌──────────────────────────────────────────────────────────┐
│  BARRA DE ESTADO      estado + tiempo a estado crítico    │
├───────────┬──────────────────────────────┬───────────────┤
│           │                              │               │
│  VITALES  │      CORAZÓN LATIENDO        │    AGENTES    │
│           │                              │   (placeholder│
│  HR       │   ── CADENA CAUSAL ──        │    por ahora) │
│  BP       │                              │               │
│  MAP      ├──────────────────────────────┤               │
│  SpO₂     │                              │               │
│  FR       │   GRÁFICO DE TRAYECTORIA     │               │
│  Lactato  │                              │               │
├───────────┴──────────────────────────────┴───────────────┤
│  INTERVENCIONES        4 botones                          │
└──────────────────────────────────────────────────────────┘
```

### Barra de estado
`ESTABLE` / `INESTABLE` / `CRÍTICO` como banda de color (verde / ámbar / rojo),
y a la derecha `TIEMPO A ESTADO CRÍTICO` en `MM:SS` contando hacia abajo.

### Vitales (izquierda)
Cada uno: número grande en fuente monoespaciada, unidad pequeña, y **una etiqueta
en lenguaje normal debajo**. MAP va más grande que el resto.

| Vital | Etiqueta humana | Normal | Alarma |
|---|---|---|---|
| HR | pulso | 60–100 | > 120 |
| BP | presión arterial | > 100 sist. | < 90 |
| **MAP** | **presión de bombeo** | > 70 | < 65 |
| SpO₂ | oxígeno en sangre | > 95 | < 92 |
| FR | respiraciones | 12–20 | > 22 |
| Lactato | el cuerpo sin oxígeno | < 2.0 | > 2.0 |
| Ritmo | `ritmo normal` / `ritmo caótico` | SINUS | otro |

Cuando un valor cruza su umbral, transiciona a rojo y pulsa suavemente.
Los números cambian con interpolación, nunca saltan de golpe.

### Cadena causal (debajo del corazón) — ELEMENTO CLAVE

Cinco eslabones horizontales que se **encienden en cascada** cuando los valores
cambian:

```
PULSO ↑ 148  →  LLENADO ↓ 41%  →  BOMBEO ↓ 3.2 L/min  →  PRESIÓN ↓ 65  →  OXÍGENO ↓ 61%
```

Cada eslabón: etiqueta en lenguaje humano arriba, valor abajo, flecha de dirección.
La cascada se propaga de izquierda a derecha con ~120 ms de retardo entre eslabones.
Rojo cuando empeora, verde cuando mejora.

Esto es lo que hace visible que hay un motor calculando de verdad. Dale más peso
visual que a cualquier otra cosa salvo el corazón.

### Gráfico de trayectoria
SVG. Dos series sobre una ventana de 5 minutos: MAP (eje izquierdo) y lactato
(eje derecho). Línea sólida = ya ocurrido. Deja preparado el render de línea
**punteada y más tenue** para las proyecciones, que llegan después.

### Intervenciones (abajo)
Cuatro botones. Nombre en lenguaje humano grande, nombre técnico pequeño debajo:

- **Frenar el pulso** · Metoprolol IV
- **Reiniciar el ritmo** · Cardioversión eléctrica
- **Dar volumen** · Bolo 500 mL
- **No intervenir** · Observar

Por ahora solo son visuales, sin lógica.

---

## 6. El corazón latiendo

Es el centro de la pantalla. **SVG animado, sincronizado con el HR real del
motor.** No un GIF, no un video, no una animación de velocidad fija.

Requisitos:

1. **El ritmo lo manda el estado.** El intervalo entre latidos es `60 / hr`
   segundos. Si el HR sube a 160, late más rápido en pantalla. Sin excepciones.

2. **Latido doble (lub-dub).** Un latido real son dos contracciones seguidas:
   una fuerte y una débil ~150 ms después. Es lo que separa un corazón creíble
   de un emoji pulsando.

3. **En fibrilación auricular, irregular.** Cuando `rhythm === 'AFIB_RVR'`, el
   intervalo de cada latido varía aleatoriamente ±25 %. El corazón se ve
   arrítmico. Este detalle es de los que más impresionan.

4. **La amplitud refleja la fuerza.** La escala del latido es proporcional a
   `strokeVolume`. Cuando la bomba se debilita, el corazón se contrae menos.
   Se degrada visiblemente.

5. **El color refleja la perfusión.** Rojo saturado con perfusión alta →
   violáceo apagado cuando cae. Interpola el color con el valor de `perfusion`.

Implementación sugerida: un `<path>` de corazón anatómico en SVG, con la
contracción aplicada como `scale` desde el centro vía Motion, disparada por un
scheduler que agenda el siguiente latido según el HR actual. Un halo/glow detrás
que expande en cada contracción refuerza el efecto.

No uses `animation-duration` de CSS: no permite intervalos irregulares.
Agenda cada latido individualmente.

---

## 7. Estética

Monitor clínico oscuro, denso, con aire. No dashboard corporativo.

- Fondo casi negro con un tinte frío
- Números en fuente monoespaciada, grandes, con peso
- Etiquetas humanas en sans, más pequeñas, gris medio
- Verde para normal, ámbar para advertencia, rojo para crítico
- Sin bordes gruesos ni sombras marcadas: separación por espacio y contraste
- Todo se mueve con suavidad. Nada aparece de golpe, nada salta

**Referencia mental:** un monitor de UCI diseñado por alguien que sabe de tipografía.

---

## 8. Reglas que no se rompen

1. **Lo simulado nunca se ve como lo medido.** Toda proyección va punteada,
   más tenue, y con la palabra `PROYECTADO`. Si alguien confunde una proyección
   con una medición, el proyecto falla en su premisa.

2. **El frontend no calcula fisiología.** El motor mock vive aislado en
   `lib/engine.ts`. Los componentes solo dibujan lo que reciben.

3. **Lenguaje humano primero.** El jurado no es médico. Todo número técnico
   lleva su traducción al lado. Lo grande y lo que se lee primero va en español
   de a pie.

---

## 9. Qué NO construir todavía

- Conexión a Portal o websockets
- Llamadas a modelos de lenguaje
- Simulaciones what-if o comparación de escenarios
- Lógica real de intervenciones
- Corazón en 3D
- Multiusuario
- Pantalla de configuración o login

Solo la primera pantalla, viva, con datos del mock.

---

## 10. Definición de terminado

Abro la pantalla y veo un paciente estable. A los 30 segundos entra en
fibrilación auricular: el corazón empieza a latir rápido e irregular, los vitales
se degradan, la cadena causal se enciende en cascada, aparece el contador de
tiempo a estado crítico, y la trayectoria se dibuja cayendo.

Todo sin tocar nada.
