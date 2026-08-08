# Arquitectura de tiempo real y agentes

## El problema que mata la demo

Cinco agentes LLM por tick es imposible. Un tick de fisiologia debe correr
a 20 Hz; una llamada a Claude tarda 2-8 s. Si los acoplas, la simulacion se
congela cada vez que un agente piensa, y el jurado lo ve.

**Tres loops independientes, comunicados por un bus de eventos.**

```
LOOP 1 — Fisiologia          20 Hz    engine.step(0.05)   deterministico, sin IA
LOOP 2 — Publicacion          1 Hz    portal.publish()    vitales al front
LOOP 3 — Agentes          por evento  async              LLM, sin bloquear
```

La fisiologia nunca espera a un agente. Un agente que tarda 6 s publica su
conclusion 6 s tarde sobre un estado que ya avanzo — y eso esta bien, es lo
que pasa en una UCI real. Lo que NO puede pasar es que el monitor se congele.

---

## Bus de eventos

Todo lo que ocurre es un evento. El portal sincroniza el log, no el estado.

```python
EVENT_TYPES = [
    "vitals.tick",            # 1 Hz, estado fisiologico
    "state.transition",       # estable -> inestable -> critico
    "threshold.crossed",      # una variable cruzo un umbral
    "agent.started",          # "Analizando nuevo ritmo..."
    "agent.progress",         # pasos intermedios
    "agent.opinion",          # postura + confianza + evidencia
    "agent.conflict",         # dos agentes en desacuerdo
    "orchestrator.consensus", # resolucion
    "simulation.started",     # what-if corriendo
    "simulation.result",      # trayectorias proyectadas
    "human.intervention",     # el usuario actua
    "user.joined",            # presencia
]
```

**Los mensajes de actividad de agentes deben venir del ciclo de vida real,
no de un `setTimeout`.** Emite `agent.started` cuando arranca la llamada,
`agent.progress` cuando entra un chunk del stream, `agent.opinion` al
terminar. Un jurado tecnico detecta la diferencia entre un spinner real y
uno decorativo, y esa es la diferencia entre "IA central" y "IA de adorno".

### Que dispara a los agentes

No cada tick. Solo:

| Disparador | Agentes que despiertan |
|---|---|
| `state.transition` | todos |
| `threshold.crossed` | el especialista relevante |
| `human.intervention` | farmacologia + simulacion |
| Cambio >15% en una variable clave | fisiologia |
| Cada 30 s si hay inestabilidad | orquestador (re-consenso) |

Con debounce: si dos umbrales se cruzan en 2 s, es un solo despertar.

---

## Como conseguir desacuerdo REAL

Si le das los mismos datos y el mismo prompt a cinco Claudes, coinciden.
El desacuerdo fabricado (pedirle a un agente que "sea escéptico") es teatro
y se nota.

**El desacuerdo real sale de darles funciones objetivo distintas y vistas
distintas de los datos.**

| Agente | Optimiza | Ve | Ignora deliberadamente |
|---|---|---|---|
| Cardiologia | Balance de O2 miocardico, estabilidad del ritmo | FC, ritmo, `mvo2`, `myocardial_o2_balance`, PCWP | Lactato, DO2 sistemico |
| Fisiologia | DO2 y perfusion tisular | CO, DO2, O2ER, lactato, indice de perfusion | Costo miocardico |
| Farmacologia | Seguridad del farmaco | Dosis, contraindicaciones, `risks` de cada intervencion | Urgencia hemodinamica |
| Simulacion | Nada — no opina | Corre `project_scenario()` y reporta trayectorias | — |
| Orquestador | Resolver el conflicto explicitamente | Todas las posturas + los numeros del simulador | — |

**El conflicto que este modelo produce solo, sin guionizarlo:**

En shock cardiogenico el inotropico sube el gasto y el DO2 → Fisiologia lo
pide. Pero induce taquicardia que empeora `myocardial_o2_balance` → el
miocardio pierde contractilidad → Cardiologia se opone porque extiende el
infarto. Los dos tienen razon en su propia funcion objetivo. El orquestador
tiene que decidir con los numeros de `project_scenario()`, no con retorica.

Ese conflicto esta **en la fisica del modelo**, verificado: al agregar el
balance de O2 miocardico, el beneficio de la dobutamina a 15 min cayo de
+0.86 L/min de gasto a +0.04. No hay que actuarlo.

### El Agente de Simulacion no opina

Es una tool, no un opinador. Corre `compare_scenarios()` y devuelve
trayectorias. Si opina, duplica a Fisiologia y el consenso se vuelve una
votacion 2-1 amañada.

---

## Regla dura para todos los agentes

**Ningun agente emite una cifra que no vino de una tool.**

Cada `agent.opinion` debe incluir:

```json
{
  "agent": "cardiologia",
  "stance": "oponerse|apoyar|condicionar",
  "intervention": "inotrope",
  "confidence": 0.72,
  "evidence": [
    {"metric": "myocardial_o2_balance", "value": -0.08, "source": "vitals.tick"},
    {"metric": "delta_co_15min", "value": 0.04, "source": "simulation.result"}
  ],
  "reasoning": "..."
}
```

El frontend muestra `evidence` junto a la postura. Es la prueba de que no
se invento el numero, y es tu activo mas fuerte frente a un jurado.

---

## Portal

No se que es Portal en su contexto, asi que la capa de sincronizacion esta
como adaptador:

```python
class SyncAdapter:
    async def publish(self, event_type: str, payload: dict) -> None: ...
    async def subscribe(self, event_types: list[str], handler) -> None: ...
    async def presence(self) -> list[dict]: ...
```

Lo que debe sincronizar: el **log de eventos**, no el estado. El estado se
deriva del log. Asi un usuario que se conecta tarde reconstruye todo, y dos
usuarios ven la misma linea de tiempo aunque uno tenga lag.

Un solo servidor es dueño del motor de fisiologia. Los clientes nunca
simulan localmente: divergirian.

---

## Lo que hay que recortar

Con las horas que quedan, esto NO cabe completo. En orden de que cortar
primero:

1. **El modelo celular de EP.** Ya no es el nucleo. Dejalo como pestaña
   opcional o quitalo. No lo integres.
2. **El 3D.** Si no esta ya corriendo, no empieces. Una malla coloreada por
   `perfusion_index` es lo maximo, y solo si sobra tiempo.
3. **Cinco agentes.** Con TRES (Cardiologia, Fisiologia, Orquestador) ya
   tienes conflicto real y consenso. Farmacologia y Simulacion pueden ser
   tools del orquestador en vez de agentes con voz propia.
4. **Multiples escenarios de shock.** Uno solo, cardiogenico, bien contado.

Lo que NO se recorta, porque es lo que califican: fisiologia coherente,
eventos en tiempo real visibles, conflicto entre agentes con evidencia
numerica, y what-if antes de decidir.

---

## Guion de demo (5 minutos)

| t | Que pasa |
|---|---|
| 0:00 | Paciente estable. Monitor vivo, vitales fluctuando. |
| 0:30 | Se dispara el insulto. Nada visible aun — MAP 86, lactato 1.0. |
| 1:00 | **Fase compensada.** HR sube, SVR sube, MAP casi normal. "El paciente se ve bien." |
| 1:30 | `threshold.crossed`: CI 2.1 < 2.2. Banner **INESTABILIDAD HEMODINAMICA**. Los agentes despiertan en pantalla. |
| 2:00 | **Tiempo estimado a estado critico: 6 min.** Rotulado como proyeccion del modelo. |
| 2:30 | Fisiologia pide inotropico. Cardiologia se opone: balance de O2 miocardico negativo. `agent.conflict`. |
| 3:00 | El usuario pide **what-if**. Cuatro trayectorias en paralelo. |
| 3:30 | **El momento clave:** noradrenalina sube la MAP mas que no hacer nada, y hunde el gasto MAS que no hacer nada. El numero que todos miran mejora mientras el que importa empeora. |
| 4:00 | Orquestador resuelve con los numeros del simulador. El usuario decide. |
| 4:30 | Se aplica. El monitor reacciona. Los agentes re-evaluan sobre el estado nuevo. |

El minuto 3:30 es lo que se van a acordar. Ensayalo.

---

## Advertencias

Modelo de parametros agrupados, no validado contra pacientes. El "tiempo a
estado critico" es la trayectoria del propio modelo, no una prediccion
clinica: si un jurado pregunta contra que esta validado, la respuesta
honesta es "contra nada". Rotularlo asi da credibilidad; presentarlo como
prediccion la destruye.

No usar datos de pacientes reales sin IRB. Los perfiles son sinteticos.

---

# Portal: decisiones concretas

## Particion de canales (derivada del modelo de credenciales)

`api.useportal.co` usa secret key `sk_...` y **rechaza requests con header
`Origin`**: el browser fisicamente no puede publicar ahi. `realtime.useportal.co`
usa un JWT de usuario que tu backend acuña via `/v1/tokens`.

| Canal | Escribe | Contenido |
|---|---|---|
| `sim:{id}:vitals` | solo servidor | 1 Hz, estado fisiologico |
| `sim:{id}:events` | solo servidor | transiciones, umbrales, simulaciones |
| `sim:{id}:agents` | solo servidor | ciclo de vida y opiniones |
| `sim:{id}:actions` | clientes | intervenciones humanas |

**Toda accion publicada por un cliente es una PROPUESTA, nunca estado.** El
backend valida, aplica al motor y republica el resultado autoritativo en
`events`. Si Portal no expone ACL de escritura por canal, esta validacion es
la unica defensa — y de todos modos deberia existir.

## Lo que NO se manda por Portal

La onda del ECG. A 250 Hz son 75.000 mensajes en 5 minutos: limites de tasa y
costo sin ganar nada. Publica FC y ritmo a 1 Hz y **sintetiza la onda en el
cliente**. Igual con el suavizado de curvas: interpola en el front entre ticks.

## Degradacion

El `EventBus` es en proceso; Portal es un suscriptor mas. Si Portal falla, la
simulacion y los agentes siguen y el front cae a polling de `/api/state`.
Acoplar la logica al transporte es como se pierde una demo por una caida de
red ajena. `PortalSync.health()` expone el contador de fallos.

## Pendiente de verificar en la doc

- Ruta y cuerpo exactos de publicacion desde servidor (`PUBLISH_PATH` en
  `sync.py` es una suposicion marcada con TODO).
- El **wire protocol** de los WebSocket (`GET /v1/channels/{id}`, `/inbox`) NO
  esta en el OpenAPI: va documentado aparte como prosa, con handshake, tipos
  de frame y codigos de rechazo. Leelo antes de escribir el cliente.
- Si "emoji reactions" existe. La copy del sitio menciona *typing indicators*.
  No diseñes contando con una feature sin confirmarla.
- Errores: el codigo va en el cuerpo `{code, reason}` **y** en el header
  `x-portal-error`. No ramifiques por status HTTP: varios codigos comparten
  status.

`portal.emit('agent:run', {runId, status:'tool_call', tool:'...'})` es el
patron que Portal documenta para estado de agentes. Uselo para el ciclo de
vida: es exactamente lo que necesitan los spinners.

---

# Verdicto sobre los workers de Go

**No.** El cuello de botella es latencia de LLM (segundos), no concurrencia.
Un paciente, ~5 agentes, ~3 usuarios: `asyncio.gather()` lo resuelve en una
linea. Lo que compras con Go es un limite de lenguaje justo donde mas duele:
el motor de fisiologia y el SDK de Anthropic son Python, y cada what-if
cruzaria IPC serializando el estado completo.

Excepcion unica: si el equipo es mucho mas fuerte en Go que en Python, la
velocidad de tipeo gana. En ese caso, Go como relay delgado de Portal y
webhooks, Python dueño de fisiologia y agentes, un solo endpoint HTTP entre
ambos. Pero no partas la orquestacion.

---

# Estado del codigo

| Modulo | Estado |
|---|---|
| `physiology.py` | Validado. Deterioro y compensacion correctos. |
| `interventions.py` | Validado. La trampa del vasopresor reproduce. |
| `runtime.py` | Corre. Tres loops verificados, 11.9 min fisiologicos en 12 s. |
| `agents.py` | Corre en modo offline (sin LLM). Conflicto real verificado. |
| `sync.py` | Estructura lista. `PUBLISH_PATH` sin verificar. |

El modo offline (`Orchestrator(bus, client=None)`) da posturas
deterministicas con las mismas funciones objetivo en codigo. Sirve para
desarrollar el front y ensayar la demo sin quemar cuota ni depender de red.
