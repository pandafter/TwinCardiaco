import puppeteer from 'puppeteer'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL = process.env.SHOT_URL ?? 'http://localhost:3210'
const OUT = process.env.SHOT_OUT ?? 'design/current.png'
const W = Number(process.env.SHOT_W ?? 1840)
const H = Number(process.env.SHOT_H ?? 1230)

async function isUp() {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch {
    return false
  }
}

let server = null
if (!(await isUp())) {
  console.log('dev server no está arriba, lo levanto...')
  server = spawn('npm', ['run', 'dev'], { stdio: 'ignore', detached: true })
  server.unref()
  for (let i = 0; i < 60; i++) {
    await sleep(1000)
    if (await isUp()) break
  }
}

const browser = await puppeteer.launch({
  // Chrome pide un perfil temporal en /var/folders; en entornos con el temp
  // del sistema restringido eso falla con EACCES antes de abrir nada.
  userDataDir: 'design/.chrome-profile',
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
// el overlay de dev de Next se cuela en la captura
await page.addStyleTag({
  content: 'nextjs-portal,[data-nextjs-toast]{display:none!important}',
})
await sleep(800)

await page.screenshot({ path: OUT })
console.log(`✓ ${OUT} — ${W}×${H}`)

// Recortes por zona: a tamaño completo se pierden las diferencias finas.
const zones = await page.$$('[data-shot]')
for (const el of zones) {
  const name = await el.evaluate((n) => n.dataset.shot)
  await el.screenshot({ path: `design/crop-${name}.png` })
  console.log(`✓ design/crop-${name}.png`)
}

await browser.close()
if (server) {
  try {
    process.kill(-server.pid)
  } catch {
    /* el server ya no era nuestro */
  }
}
