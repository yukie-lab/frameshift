import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
const exec = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
const OUT = process.env.OUT || 'shots/jumptest'
mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: exec, headless: true,
  args: ['--use-gl=angle','--use-angle=metal','--enable-unsafe-swiftshader','--window-size=1600,900','--hide-scrollbars','--disable-gpu-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
const errs = []
page.on('pageerror', e => errs.push('PAGE ' + e.message))
page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text()) })
await page.goto('http://localhost:5173/?scene=jump&seed=1337', { waitUntil: 'networkidle0', timeout: 90000 })
await new Promise(r => setTimeout(r, 12000))
const st = await page.evaluate(() => ({
  phase: window.__fs.game.fx.phase,
  star: window.__fs.game.universe.star.name,
  bodies: window.__fs.game.universe.bodies.length,
  sceneChildren: window.__fs.game.rs.scene.children.length
}))
await page.screenshot({ path: OUT + '/arrived.png' })
console.log('after jump 1:', JSON.stringify(st))
for (let i = 2; i <= 5; i++) {
  await page.evaluate(() => window.__fs.game.fx.trigger())
  await new Promise(r => setTimeout(r, 11000))
  const s2 = await page.evaluate(() => ({
    star: window.__fs.game.universe.star.name,
    bodies: window.__fs.game.universe.bodies.length,
    entries: window.__fs.game.universe.entries.length,
    sceneChildren: window.__fs.game.rs.scene.children.length,
    geoms: window.__fs.game.rs.renderer.info.memory.geometries,
    texs: window.__fs.game.rs.renderer.info.memory.textures
  }))
  console.log('after jump ' + i + ':', JSON.stringify(s2))
}
await page.screenshot({ path: OUT + '/arrived2.png' })
console.log('errors:', errs.length ? errs.slice(0,8).join('\n') : 'none')
await browser.close()
