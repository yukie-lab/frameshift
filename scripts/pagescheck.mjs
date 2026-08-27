// Verifies that the production build runs as a plain static site under the
// GitHub Pages sub-path. Catches the class of failure where index.html still
// points at raw TypeScript, or where `base` does not match the Pages URL.
//
//   node scripts/pagescheck.mjs                 # serve ./dist locally and check
//   URL=https://yukie-lab.github.io/frameshift/ node scripts/pagescheck.mjs
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const BASE = '/frameshift/'
const PORT = 8099
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
}

let server = null
let target = process.env.URL

if (!target) {
  if (!existsSync('dist/index.html')) {
    console.error('dist/index.html missing — run `npm run build` first')
    process.exit(1)
  }
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end('outside base'); return }
    let rel = normalize(url.pathname.slice(BASE.length)) || 'index.html'
    if (rel.startsWith('..')) { res.writeHead(403).end(); return }
    let file = join('dist', rel)
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) { res.writeHead(404).end('not found'); return }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  await new Promise(r => server.listen(PORT, r))
  target = `http://localhost:${PORT}${BASE}`
}

const exec = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].find(existsSync)
if (!exec) { console.error('No Chrome-compatible browser found'); process.exit(1) }

const browser = await puppeteer.launch({
  executablePath: exec,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader',
    '--window-size=1280,720', '--hide-scrollbars', '--disable-gpu-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 720 })
const problems = []
page.on('pageerror', e => problems.push('PAGE ' + e.message))
page.on('console', m => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text()) })
page.on('requestfailed', r => problems.push('REQFAIL ' + r.url()))
page.on('response', r => { if (r.status() >= 400) problems.push('HTTP ' + r.status() + ' ' + r.url()) })

console.log('checking', target)
await page.goto(target, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise(r => setTimeout(r, 8000))
const state = await page.evaluate(() => ({
  canvas: !!document.querySelector('#app canvas'),
  bootCleared: !document.getElementById('boot'),
  bootError: document.getElementById('bootErr')?.textContent || null,
  star: window.__fs?.game?.universe?.star?.name ?? null,
  bodies: window.__fs?.game?.universe?.bodies?.length ?? null
}))
await browser.close()
server?.close()

console.log(JSON.stringify(state))
if (problems.length) console.log(problems.slice(0, 10).join('\n'))
const ok = state.canvas && state.bootCleared && !state.bootError && problems.length === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
