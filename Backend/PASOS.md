 # Paso a paso: exponer las APIs y montar la demo

## 0. Dependencias

```bash
pip install -r requirements.txt
```

`numba` compila el kernel al arrancar (~5 s). Si no lo tienes, todo corre
igual pero lento.

## 1. Levantar el servidor

```bash
export CARDIOTWIN_TIME_SCALE=8      # 8x: un deterioro de 40 min en 5
uvicorn server:app --host 0.0.0.0 --port 8000
```

Sin `ANTHROPIC_API_KEY` los agentes corren en **modo offline**: posturas
deterministas con las mismas funciones objetivo escritas en codigo. Sirve
para desarrollar el front y ensayar sin quemar cuota ni depender de la red.
Actívalo con la key solo cuando vayas a ensayar el guion completo.

Sin `PORTAL_SECRET_KEY`, Portal se desactiva y queda SSE. **Empieza asi.**

Verifica: `curl localhost:8000/api/health`

## 2. Conectar el front por SSE (antes que Portal)

```js
const es = new EventSource("http://localhost:8000/api/stream");
es.addEventListener("vitals.tick",  e => renderVitals(JSON.parse(e.data).payload));
es.addEventListener("state.transition", e => showBanner(JSON.parse(e.data).payload));
es.addEventListener("agent.started", e => showSpinner(JSON.parse(e.data).payload));
es.addEventListener("agent.opinion", e => showOpinion(JSON.parse(e.data).payload));
es.addEventListener("agent.conflict", e => showConflict(JSON.parse(e.data).payload));
es.addEventListener("orchestrator.consensus", e => showConsensus(JSON.parse(e.data).payload));
```

Con esto ya tienes demo completa sin Portal. **Congela aqui antes de seguir.**

## 3. Guion, por endpoint

```bash
curl -XPOST localhost:8000/api/scenario/shock \
     -H 'Content-Type: application/json' \
     -d '{"type":"cardiogenic","severity":1.0}'
```

Espera. Cuando CI cruza 2.2 sale `state.transition` con el banner
**INESTABILIDAD HEMODINAMICA** y `time_to_critical_s`.

```bash
curl -XPOST localhost:8000/api/whatif -H 'Content-Type: application/json' \
     -d '{"horizon_s":900}'
```

Ese es el momento que se van a acordar: noradrenalina sube la MAP mas que
nadie **y** hunde el gasto mas que nadie.

```bash
curl -XPOST localhost:8000/api/intervention \
     -H 'Content-Type: application/json' -d '{"key":"inotrope"}'
curl -XPOST localhost:8000/api/scenario/reset     # para volver a ensayar
```

## 4. Portal encima (no en lugar de)

```bash
export PORTAL_SECRET_KEY=sk_...
```

El backend publica solo. El browser pide su JWT:

```js
const r = await fetch("/api/portal/token", {
  method: "POST", headers: {"Content-Type": "application/json"},
  body: JSON.stringify({ user_id: "medico-1", display_name: "Dra. Ruiz" })
});
const { token, realtime_host, channels } = await r.json();
```

Y se suscribe a `channels.vitals|events|agents` contra `realtime_host`.
Publica **solo** en `channels.actions`, y ese canal es de PROPUESTAS: el
listener del backend valida y llama a `POST /api/intervention`, que
republica el resultado autoritativo. Nunca apliques una accion directo
desde el mensaje del cliente.

**Antes de escribir el cliente**, lee el wire protocol de Portal: los
endpoints WebSocket no estan en el OpenAPI. Y confirma `PUBLISH_PATH` en
`cardiotwin/sync.py`, que es una suposicion marcada con TODO.

## 5. El corazon 3D

```bash
git clone https://github.com/simonreisinger/Interactive-3D-Human-Heart-Visualization heart3d
cp cardiotwin-bridge.js heart3d/
```

Agrega al final de `heart3d/index.html`, antes de `</body>`:

```html
<script>window.CARDIOTWIN_API = "http://localhost:8000";</script>
<script src="cardiotwin-bridge.js"></script>
```

El servidor ya lo sirve en `/heart3d` si la carpeta existe. Embebe con
iframe y reenvia desde el padre:

```js
iframe.contentWindow.postMessage(
  { type: "cardiotwin:heart3d", payload: heart3dState }, "*");
```

**Lo primero que hay que arreglar:** abre la consola. El bridge imprime
todos los nombres de malla que encontro. Los patrones en `PATTERNS` son una
suposicion sobre la nomenclatura de BodyParts3D; ajustalos con lo que veas.
Toma dos minutos y sin eso no se colorea nada.

**Atribucion obligatoria** (CC BY-SA 2.1 JP): "Modelo anatomico: BodyParts3D,
Database Center for Life Science". Visible en el demo, no en un README.

## Orden de trabajo

| # | Tarea | Se puede demostrar al terminar |
|---|---|---|
| 1 | Servidor + `curl` al guion completo | no |
| 2 | Monitor de vitales por SSE | **si — demo minima** |
| 3 | Banner de inestabilidad + tiempo a critico | si |
| 4 | Panel de agentes con evidencia | **si — demo fuerte** |
| 5 | What-if con las cuatro trayectorias | **si — demo completa** |
| 6 | Portal encima del SSE | si |
| 7 | Corazon 3D coloreado | si |

Del 5 en adelante todo es opcional. Si vas corto, para en el 5 y ensaya.

## Endpoints

| Metodo | Ruta | Para que |
|---|---|---|
| GET | `/api/health` | estado de portal, llm, agentes |
| GET | `/api/state` | snapshot (plan B si cae el stream) |
| GET | `/api/stream` | **SSE con todos los eventos** |
| GET | `/api/events?since=` | replay del log |
| GET | `/api/interventions` | construir los botones dinamicamente |
| GET | `/api/agents` | que ve y que optimiza cada agente |
| GET | `/api/heart3d` | colores derivados para la malla |
| POST | `/api/scenario/shock` | disparar el deterioro |
| POST | `/api/scenario/reset` | reiniciar para ensayar |
| POST | `/api/intervention` | aplicar (valida y republica) |
| POST | `/api/whatif` | proyectar las ramas |
| POST | `/api/deliberate` | forzar ronda de agentes |
| POST | `/api/portal/token` | acuñar JWT del browser |

Documentacion interactiva en `/docs`.
