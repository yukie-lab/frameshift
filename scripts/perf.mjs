import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
const exec = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
const browser = await puppeteer.launch({ executablePath: exec, headless: true,
  args: ['--use-gl=angle','--use-angle=metal','--enable-unsafe-swiftshader','--window-size=1920,1080','--hide-scrollbars','--disable-gpu-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
page.on('console', m => { if (m.type()==='error') console.error('CONSOLE:', m.text()) })
for (const sc of (process.argv[2]||'start,rings,sc,cockpit').split(',')) {
  await page.goto(`http://localhost:5173/?scene=${sc.replace('|','&')}&seed=1337`, { waitUntil: 'networkidle0', timeout: 90000 })
  await new Promise(r => setTimeout(r, 6000))
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now()
    const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / ((performance.now()-t0)/1000)) }
    requestAnimationFrame(tick)
  }))
  const info = await page.evaluate(() => { const r = window.__fs.game.rs.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, progs: r.programs.length } })
  console.log(sc, 'fps=' + fps.toFixed(1), JSON.stringify(info))
}
await browser.close()
