/**
 * Comprueba la sesión compartida de punta a punta, con dos navegadores.
 *
 *   node scripts/check-room.mjs        (con el servidor en el 3210)
 *
 * Verifica lo único que hace útil el multiusuario: que uno proponga, que
 * el otro lo vea, que NADIE resuelva su propia propuesta, y que al aprobar
 * el fármaco entre en las dos pantallas y quede el registro de quién fue.
 */
import puppeteer from 'puppeteer'
import { setTimeout as sleep } from 'node:timers/promises'

const S = process.env.OUT_DIR
const URL = 'http://localhost:3210/monitor?sala=uci-3'

const b = await puppeteer.launch({
  userDataDir: 'design/.chrome-profile',
  defaultViewport: { width: 1440, height: 900 },
})

// Dos contextos aislados = dos personas distintas (sessionStorage separado).
const c1 = await b.createBrowserContext()
const c2 = await b.createBrowserContext()
const ana = await c1.newPage()
const beto = await c2.newPage()

await Promise.all([
  ana.goto(URL, { waitUntil: 'domcontentloaded' }),
  beto.goto(URL, { waitUntil: 'domcontentloaded' }),
])
// presencia: hasta 5 s para el primer latido de cada uno
await sleep(6500)

const presence = await ana.evaluate(() =>
  document.body.innerText.match(/con \w+|\d+ en la sala/)?.[0] ?? 'sin presencia',
)
console.log('presencia vista por Ana:', presence)

// Ana propone "Subir la presión" (tercer botón del grupo)
const btns = await ana.$$('[role=group] button')
await btns[2].click()
await sleep(1500)
await ana.screenshot({ path: `${S}/room-ana.png` })

const betoSees = await beto.evaluate(
  () => document.body.innerText.match(/\w+ propone [^\n]+/)?.[0] ?? 'NADA',
)
console.log('Beto ve:', betoSees)

const anaCanVote = await ana.evaluate(() =>
  document.body.innerText.includes('Aprobar y aplicar'),
)
console.log('¿Ana puede votar su propia propuesta?', anaCanVote ? 'SÍ (mal)' : 'no (correcto)')

await beto.screenshot({ path: `${S}/room-beto.png` })

// Beto aprueba
const approve = await beto.$$('button')
for (const el of approve) {
  const t = await el.evaluate((n) => n.textContent)
  if (t?.includes('Aprobar y aplicar')) { await el.click(); break }
}
await sleep(2000)

const anaLog = await ana.evaluate(
  () => document.body.innerText.match(/REGISTRO[\s\S]{0,140}/)?.[0]?.replace(/\n/g, ' ') ?? 'sin registro',
)
console.log('Registro en la pantalla de Ana:', anaLog.trim())

const anaApplied = await ana.evaluate(() => document.body.innerText.includes('aplicada'))
console.log('¿Se aplicó en la pantalla de Ana?', anaApplied ? 'sí' : 'NO')

await ana.screenshot({ path: `${S}/room-after.png` })
await b.close()
