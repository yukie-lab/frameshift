import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'

const candidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
]
const exec = process.env.CHROME_PATH || candidates.find(existsSync)
if (!exec) { console.error('No Chrome-compatible browser found'); process.exit(1) }

mkdirSync('shots', { recursive: true })
const scenes = (process.argv[2] || 'start,rings,sc,jump,cockpit').split(',')
const browser = await puppeteer.launch({
  executablePath: exec,
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader',
    '--window-size=1920,1080', '--hide-scrollbars', '--disable-gpu-sandbox'
  ]
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })

const waits = { jump: 5100, default: 7000 }
for (const sc of scenes) {
  await page.goto(`http://localhost:5173/?scene=${sc}&seed=1337`, { waitUntil: 'networkidle0', timeout: 90000 })
  await new Promise(r => setTimeout(r, waits[sc] ?? waits.default))
  await page.screenshot({ path: `shots/${sc}.png` })
  console.log('captured', sc)
}
await browser.close()
