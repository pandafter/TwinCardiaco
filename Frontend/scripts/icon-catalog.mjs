/**
 * Renderiza todos los iconos a design/icons.png leyendo el propio código
 * fuente, sin arrancar el dev server. Sirve para comprobar de un vistazo que
 * cada icono representa lo que debe y que no hay dos iguales.
 *
 *   node scripts/icon-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer'

const src = readFileSync('src/components/icons.tsx', 'utf8')
const BASE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'

const icons = []
const re = /export (?:const|function) (\w+)\s*=?\s*\(?\{[^}]*\}: P\)\s*(?:=>\s*\(|\{\s*[\s\S]*?return \()([\s\S]*?)\n\)?;?\n(?=(?:\/\*|export|$))/g
let m
while ((m = re.exec(src))) {
  let [, name, body] = m
  body = body.replace(/\{\.\.\.base\}/g, BASE)
             .replace(/className=\{className\}/g, '')
             .replace(/style=\{style\}/g, '')
             .replace(/\{`\$\{uid\}-ecg`\}/g, '"ecg"')
             .replace(/\{`url\(#\$\{uid\}-ecg\)`\}/g, '"url(#ecg)"')
             .replace(/strokeWidth=/g, 'stroke-width=')
             .replace(/strokeLinecap=/g, 'stroke-linecap=')
             .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
             .replace(/strokeDasharray=/g, 'stroke-dasharray=')
             .replace(/fillRule=/g, 'fill-rule=')
             .replace(/\{[^}"]*\}/g, '')
             .replace(/^\s*\);?\s*$/gm, '')
             .trim()
  if (body.startsWith('<svg')) icons.push({ name, body })
}

const html = `<style>
body{background:#05070a;margin:0;padding:24px;font-family:system-ui;color:#e9eef3}
.g{display:grid;grid-template-columns:repeat(8,1fr);gap:14px}
.c{border:1px solid #1b222a;background:#0b0f14;border-radius:10px;padding:14px;
   display:flex;flex-direction:column;align-items:center;gap:8px}
svg{width:44px;height:44px;color:#e9eef3}
span{font-size:9px;color:#838d98;text-align:center}
</style><div class="g">${icons
  .map((i) => `<div class="c">${i.body}<span>${i.name}</span></div>`)
  .join('')}</div>`

writeFileSync('/tmp/claude-501/icons.html', html)
const b = await puppeteer.launch({ defaultViewport: { width: 1500, height: 1000 } })
const p = await b.newPage()
await p.goto('file:///tmp/claude-501/icons.html', { waitUntil: 'load' })
await p.screenshot({ path: 'design/icons.png', fullPage: true })
await b.close()
console.log(`✓ ${icons.length} iconos`)
