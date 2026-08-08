/** Recoge errores y warnings del navegador en cada ruta. */
import puppeteer from 'puppeteer'

const BASE = process.env.SHOT_URL ?? 'http://localhost:3210'
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/monitor']

const browser = await puppeteer.launch({
  defaultViewport: { width: 1840, height: 1230 },
})
const page = await browser.newPage()

const found = []
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type()))
    found.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => found.push(`[pageerror] ${e.message}`))

for (const route of ROUTES) {
  found.push(`\n===== ${route} =====`)
  await page.goto(BASE + route, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 2500))
}

console.log(found.join('\n'))
await browser.close()
