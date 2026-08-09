# Despliegue público en Vercel

TwinCardiaco se despliega como un único proyecto de **Vercel Services**:

- `frontend`: Next.js en `/`.
- `backend`: FastAPI en `/backend`.
- El navegador consume el backend por la ruta relativa que Vercel publica en
  `NEXT_PUBLIC_BACKEND_URL`, sin CORS ni una segunda plataforma.

## Variables de producción

Configurar en Vercel para `Production` y `Preview`:

### Privadas (solo servidor)

- `ANTHROPIC_API_KEY`
- `PORTAL_SECRET_KEY`
- `CARDIOTWIN_SIM_ID=demo`
- `CARDIOTWIN_TIME_SCALE=8`
- `CARDIOTWIN_ASYSTOLE_S=120`
- `CARDIOTWIN_ASK_MODEL=claude-opus-5`
- `CARDIOTWIN_AGENT_MODEL=claude-opus-5`
- `CARDIOTWIN_DELTA_MS=150`

### Públicas (incluidas en el bundle del navegador)

- `NEXT_PUBLIC_PORTAL_PK`
- `NEXT_PUBLIC_CARDIOTWIN_SIM_ID=demo`
- `NEXT_PUBLIC_CARDIOTWIN_USER=Equipo de guardia`

`PORTAL_SECRET_KEY` y `ANTHROPIC_API_KEY` nunca se comparten con los jurados,
no se escriben en Git y no llevan el prefijo `NEXT_PUBLIC_`. Los jurados solo
necesitan abrir la URL pública.

## Consideración del hackathon

El stream SSE del backend admite hasta 900 segundos por conexión en Vercel.
El cliente se reconecta automáticamente, mientras Portal mantiene la
sincronización entre pantallas. La demo debe probarse en producción antes de
presentarla porque Vercel Services está en beta.
