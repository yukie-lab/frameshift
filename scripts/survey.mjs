import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
const exec = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
const OUT = process.env.OUT || 'shots/survey'
mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: exec, headless: true,
  args: ['--use-gl=angle','--use-angle=metal','--enable-unsafe-swiftshader','--window-size=1600,900','--hide-scrollbars','--disable-gpu-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 })
page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
page.on('console', m => { if (m.type()==='error') console.error('CONSOLE:', m.text()) })

await page.evaluateOnNewDocument(() => {
  window.__place = null
})
const url = 'http://localhost:5173/?scene=start&seed=' + (process.env.SEED||'1337') + (process.env.NOCOCKPIT ? '&nocockpit=1' : '')
await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 })
await new Promise(r => setTimeout(r, 5000))

await page.evaluate(() => {
  const { THREE } = window.__fs
  window.__aim = (eye, at, up) => {
    const { game } = window.__fs
    const m = new THREE.Matrix4().lookAt(eye, at, up || new THREE.Vector3(0,1,0))
    game.ship.quat.setFromRotationMatrix(m); game.ship.pos.copy(eye); game.ship.vel.set(0,0,0)
  }
  window.__pick = (t) => window.__fs.game.universe.bodies.find(b => b.type === t)
  window.__orbitView = (b, distMul, angleRad, elev) => {
    const u = window.__fs.game.universe
    const starDir = u.starPos.clone().sub(b.pos).normalize()
    const axis = new THREE.Vector3(0,1,0)
    const dir = starDir.clone().applyAxisAngle(axis, angleRad)
    dir.y += (elev||0)
    dir.normalize()
    const eye = b.pos.clone().addScaledVector(dir, b.radiusM*distMul)
    window.__aim(eye, b.pos.clone())
  }
})

const shots = [
  ['star', `(() => { const {THREE}=window.__fs; const u=window.__fs.game.universe;
      const eye = u.starPos.clone().add(new THREE.Vector3(.5,.15,.85).normalize().multiplyScalar(u.star.radiusM*26));
      window.__aim(eye, u.starPos.clone()); })()`],
  ['star-close', `(() => { const {THREE}=window.__fs; const u=window.__fs.game.universe;
      const eye = u.starPos.clone().add(new THREE.Vector3(.5,.15,.85).normalize().multiplyScalar(u.star.radiusM*3.4));
      window.__aim(eye, u.starPos.clone()); })()`],
  ['gas-rings', `(() => { const u=window.__fs.game.universe; const b=u.bodies.find(x=>x.hasRings)||u.bodies.find(x=>x.type==='gas'); window.__orbitView(b, 4.2, 1.9, .28); })()`],
  ['gas-front', `(() => { const u=window.__fs.game.universe; const b=u.bodies.find(x=>x.type==='gas'); window.__orbitView(b, 3.4, .5, .05); })()`],
  ['earthlike', `(() => { const b=window.__pick('earthlike')||window.__pick('water'); if(!b) return false; window.__orbitView(b, 3.2, 1.35, .1); return true })()`],
  ['rocky', `(() => { const b=window.__pick('rocky'); if(!b) return false; window.__orbitView(b, 3.0, 1.5, .05); return true })()`],
  ['lava', `(() => { const b=window.__pick('lava'); if(!b) return false; window.__orbitView(b, 3.0, 1.6, .05); return true })()`],
  ['ice', `(() => { const b=window.__pick('ice'); if(!b) return false; window.__orbitView(b, 3.0, 1.4, .05); return true })()`],
  ['sky', `(() => { const {THREE}=window.__fs; const u=window.__fs.game.universe;
      const eye = u.starPos.clone().add(new THREE.Vector3(1,.2,.3).normalize().multiplyScalar(3e12));
      window.__aim(eye, eye.clone().add(new THREE.Vector3(-.2,.05,1))); })()`],
  ['sky-core', `(() => { const {THREE}=window.__fs; const u=window.__fs.game.universe;
      const sky = u.entries.find(e=>e.sky);
      const cd = sky.obj.userData.galacticCoreDir.clone();
      const eye = u.starPos.clone().add(new THREE.Vector3(1,.2,.3).normalize().multiplyScalar(3e12));
      window.__aim(eye, eye.clone().add(cd), sky.obj.userData.galacticPlaneN.clone()); })()`],
  ['belt', `(() => { const {THREE}=window.__fs; const u=window.__fs.game.universe; const r=(u.belt.innerM+u.belt.outerM)/2;
      const eye = new THREE.Vector3(r, 4e8, 0); window.__aim(eye, new THREE.Vector3(r*.7, 0, r*.4)); })()`]
]
for (const [name, js] of shots) {
  const ok = await page.evaluate(js)
  if (ok === false) { console.log('skipped', name, '- not present in this system'); continue }
  await new Promise(r => setTimeout(r, 1400))
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('captured', name)
}
await browser.close()
