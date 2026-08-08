# CARDIAC TWIN — Contexto del proyecto y mapa de pantallas

Documento maestro. Léelo antes de diseñar o construir cualquier pantalla.
El detalle técnico del monitor en vivo está aparte, en `cardiac-twin-context.md`.

---

## 1. Qué es

Un **gemelo digital cardíaco en tiempo real**. Un paciente virtual se deteriora
en vivo, varios agentes de IA analizan su estado a medida que cambia, y el
usuario puede probar intervenciones para ver cómo cambia la trayectoria.

La pregunta que responde el producto:

> **¿Qué pasa si actuamos ahora?**

Es un prototipo de investigación y educación. No diagnostica, no recomienda
tratamientos y no está validado clínicamente.

## 2. Cómo funciona, en una frase

El corazón es una bomba. Cuando late demasiado rápido no alcanza a llenarse
entre latido y latido, así que mueve menos sangre en cada uno. Late más, pero
bombea menos. Cae la presión y el cuerpo se queda sin oxígeno.

Esa cadena es lo que el producto entero debe hacer visible:

```
PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
```

## 3. Quién lo va a ver — condiciona todo el diseño

**El jurado no es médico.** Son programadores y gente de negocio. Si tienen que
aprender fisiología para entender la pantalla, el proyecto falla.

Consecuencias de diseño, no negociables:

- Todo número técnico lleva su traducción en lenguaje normal al lado.
  MAP 65 → *"presión de bombeo"*. Lactato 3.1 → *"el cuerpo sin oxígeno"*.
- Los botones dicen **"Frenar el pulso"**, con "Metoprolol IV" en pequeño debajo.
- Los agentes escriben en español de a pie, sin jerga.
- Lo grande y lo que se lee primero siempre va en lenguaje humano. Lo técnico
  va al lado, más pequeño, para que un médico vea que está bien hecho.

## 4. El escenario clínico

Uno solo, bien hecho: **fibrilación auricular con respuesta ventricular rápida**
que lleva a inestabilidad hemodinámica.

Cuatro intervenciones, ninguna más:

| Botón | Técnico | Qué hace |
|---|---|---|
| Frenar el pulso | Metoprolol IV | Baja la frecuencia, pero debilita la bomba |
| Reiniciar el ritmo | Cardioversión | Restaura el ritmo normal de golpe |
| Dar volumen | Bolo 500 mL | Aumenta la precarga |
| No intervenir | Observar | El deterioro continúa |

El dilema es el corazón de la demo: frenar el pulso también debilita la
contracción, y en un paciente ya hipotenso puede empeorarlo. Cardiovertir lo
resuelve de golpe. **Mismo paciente, distinta decisión, distinta trayectoria.**

---

## 5. Mapa de pantallas

### Prioridad — léela antes de repartir tiempo

Las pantallas 1 a 4 son **configuración previa**. En una demo de 6 minutos duran
15 segundos en total. La pantalla 5 es el producto. Si hay que recortar, se
recorta arriba, nunca abajo.

| # | Pantalla | Prioridad | Referencia |
|---|---|---|---|
| 1 | Seleccionar paciente | P1 | `design/ref-01-seleccionar-paciente.png` |
| 2 | Configurar escenario | P2 | — |
| 3 | Revisar y confirmar | P2 | — |
| 4 | Iniciar simulación | P2 | — |
| 5 | **Monitor en vivo** | **P0** | `cardiac-twin-context.md` |
| 6 | Comparar escenarios | P0 | overlay del monitor |
| 7 | Preguntar en lenguaje natural | P0 | panel del monitor |
| 8 | Cierre / resumen | P2 | — |

---

### 1 · Seleccionar paciente — P1

Wizard paso 01. Elegir entre 4 casos clínicos predefinidos o crear uno nuevo.

Tres columnas: pasos y contexto a la izquierda, lista de casos en el centro,
detalle del caso seleccionado a la derecha con sus variables iniciales.

Hay referencia visual completa. Constrúyela contra ella.

Si falta tiempo, esta pantalla se degrada a una lista simple de 4 tarjetas y
un botón. No es donde se gana.

---

### 2 · Configurar escenario — P2

Wizard paso 02. Ajustar severidad, velocidad de deterioro y qué intervenciones
estarán disponibles.

Mínimo viable: tres sliders y una lista de checkboxes. No inventes complejidad.

**Aquí entra la IA por primera vez:** el usuario puede describir al paciente en
texto libre — *"67 años, hipertenso de larga data, cardiopatía previa"* — y el
modelo traduce esa descripción a los parámetros iniciales del motor. Muéstralo
como un campo de texto con la parametrización resultante apareciendo al lado.

---

### 3 · Revisar y confirmar — P2

Wizard paso 03. Resumen de lo configurado antes de arrancar.

Puede ser una sola columna con el resumen y dos botones. Es la pantalla más
barata de todas.

---

### 4 · Iniciar simulación — P2

Transición, no pantalla. Cuenta regresiva de 3 segundos, el corazón aparece y
empieza a latir, los vitales entran en escena.

Debe sentirse como encender un monitor. Es el momento en que la demo empieza
de verdad, así que merece 20 líneas de animación bien hechas.

---

### 5 · Monitor en vivo — P0, la pantalla que importa

Aquí ocurre todo. Especificación completa en `cardiac-twin-context.md`.

```
┌──────────────────────────────────────────────────────────┐
│  ESTADO           estable / inestable / crítico + reloj   │
├───────────┬──────────────────────────────┬───────────────┤
│  VITALES  │      CORAZÓN LATIENDO        │    AGENTES    │
│           │   ── CADENA CAUSAL ──        │               │
│           ├──────────────────────────────┤               │
│           │      TRAYECTORIA             │               │
├───────────┴──────────────────────────────┴───────────────┤
│  INTERVENCIONES                                           │
└──────────────────────────────────────────────────────────┘
```

Cuatro elementos cargan el peso:

**El corazón** late sincronizado con la frecuencia real. Irregular cuando hay
fibrilación. Se contrae menos cuando la bomba se debilita. Cambia de color
según la perfusión.

**La cadena causal** se enciende eslabón por eslabón en cascada cuando los
valores cambian. Es lo que hace visible que hay un motor calculando de verdad,
sin que nadie tenga que explicar nada.

**Los agentes** escriben en streaming, palabra por palabra. Tres, no cinco.
Uno interpreta el estado, otro explica los escenarios, el orquestador sintetiza.

**Las intervenciones** muestran su trayectoria proyectada al pasar el mouse
por encima, en fantasma sobre el gráfico, sin aplicar nada. Ver el futuro antes
de elegirlo.

---

### 6 · Comparar escenarios — P0

No es pantalla aparte: es un overlay que se despliega sobre el gráfico de
trayectoria del monitor.

Muestra las 3 o 4 ramas superpuestas, cada una con su color, su resultado y su
tiempo hasta estado crítico. La rama "no intervenir" siempre visible como línea
base.

Este es el momento del *"mismo paciente, distinta decisión, distinta trayectoria"*.
Es la imagen que el jurado se tiene que llevar.

---

### 7 · Preguntar en lenguaje natural — P0

Un campo de texto en el monitor donde el usuario escribe cosas como:

> *"¿y si le doy volumen y lo cardiovierto en 2 minutos?"*
> *"¿qué pasa si esperamos 5 minutos más?"*
> *"¿y si el medicamento no le hace efecto?"*

La IA traduce la frase a parámetros del motor, corre la simulación, y la nueva
trayectoria aparece dibujada en el gráfico.

**Esta es la justificación entera de la IA en el proyecto.** Sin ella tenemos
cuatro botones; con ella tenemos escenarios infinitos en lenguaje natural.
Si hay que sacrificar algo visual para que esto funcione, se sacrifica.

Cuando la pregunta está fuera del modelo, el sistema lo dice explícitamente:
*"Fuera del alcance. Este gemelo simula 4 intervenciones sobre fibrilación
auricular."* Reconocer los límites es una ventaja ante el jurado, no un bache.

---

### 8 · Cierre / resumen — P2

Después de la intervención: qué se decidió, cómo cambió la trayectoria, qué
habría pasado con las otras opciones.

Solo si sobra tiempo. Probablemente no sobre.

---

## 6. Sistema de diseño

**Referencia mental:** un monitor de cuidados intensivos diseñado por alguien
que sabe de tipografía. Oscuro, denso, con aire. No dashboard corporativo.

Extrae los valores exactos de `design/ref-01-seleccionar-paciente.png` y déjalos
como variables CSS. Como guía:

- Fondo casi negro con tinte frío, superficies apenas más claras
- Dorado como color de acento y de acción
- Verde para normal, ámbar para advertencia, rojo para crítico
- Números en fuente monoespaciada, grandes, con peso
- Etiquetas humanas en sans, más pequeñas, gris medio
- Separación por espacio y contraste, no por bordes gruesos ni sombras
- Todo se mueve con suavidad. Nada aparece de golpe, nada salta

Resolución objetivo: **1840×1230**. Es la de la demo. No inviertas en móvil.

## 7. Reglas transversales

1. **Lo simulado nunca se ve como lo medido.** Toda proyección va punteada, más
   tenue, etiquetada `PROYECTADO`. Si alguien confunde una proyección con una
   medición, el proyecto falla en su premisa.

2. **El frontend no calcula fisiología.** El motor vive aislado. Los componentes
   solo dibujan lo que reciben.

3. **Lenguaje humano primero**, técnico al lado.

4. **Todos los datos son sintéticos o de-identificados.** Que se vea en pantalla.

## 8. Qué NO construir

Historia clínica completa · catálogo de medicamentos · múltiples patologías ·
diagnóstico · integración hospitalaria · login o cuentas · panel de
administración · responsive móvil · corazón en 3D · modo claro.

Una patología, pocas variables, pocas intervenciones, y un tiempo real
impecable. La calidad de la experiencia vale más que la cantidad de features.
