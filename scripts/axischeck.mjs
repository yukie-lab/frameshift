// Asserts that every control moves the ship the way the manual says it does.
// Yaw and roll shipped inverted once because the sign that turns a pilot
// command into an angular velocity about the local axis is easy to get wrong
// in a right-handed Y-up frame with forward -Z. Requires `npm run dev`.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const exec = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].find(existsSync)
if (!exec) { console.error('No Chrome-compatible browser found'); process.exit(1) }

const browser = await puppeteer.launch({
  executablePath: exec, headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader',
    '--window-size=900,600', '--hide-scrollbars', '--disable-gpu-sandbox']
})
const page = await browser.newPage()
page.on('pageerror', e => console.error('PAGE', e.message))
await page.goto('http://localhost:5173/?scene=start&seed=42&nocockpit=1', { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise(r => setTimeout(r, 5000))

const reset = () => page.evaluate(() => {
  const g = window.__fs.game
  g.ship.quat.set(0, 0, 0, 1); g.ship.vel.set(0, 0, 0); g.ship.angVel.set(0, 0, 0); g.throttleLevel = 0
})
const hold = async (c, ms) => {
  await page.keyboard.down(c); await new Promise(r => setTimeout(r, ms))
  await page.keyboard.up(c); await new Promise(r => setTimeout(r, 600))
}

const ROTATIONS = [
  ['KeyA', 'A', 'yaw', 'nose left'], ['KeyD', 'D', 'yaw', 'nose right'],
  ['KeyW', 'W', 'pitch', 'nose down'], ['KeyS', 'S', 'pitch', 'nose up'],
  ['KeyQ', 'Q', 'roll', 'bank left'], ['KeyE', 'E', 'roll', 'bank right']
]
const THRUSTERS = [
  ['ArrowLeft', 'Left', 'left'], ['ArrowRight', 'Right', 'right'],
  ['ArrowUp', 'Up', 'up'], ['ArrowDown', 'Down', 'down']
]

let failed = 0
const check = (label, got, want) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(6)} ${got.padEnd(11)} ${ok ? '' : `(expected ${want})`}`)
}

console.log('rotation')
for (const [key, label, , want] of ROTATIONS) {
  await reset()
  await new Promise(r => setTimeout(r, 250))
  const b0 = await page.evaluate(() => {
    const { game, THREE } = window.__fs
    const q = game.ship.quat
    return { r: new THREE.Vector3(1, 0, 0).applyQuaternion(q).toArray(),
             u: new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray() }
  })
  await hold(key, 900)
  const m = await page.evaluate((b0) => {
    const { game, THREE } = window.__fs
    const q = game.ship.quat
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    const d = (a, b) => a.x * b[0] + a.y * b[1] + a.z * b[2]
    return { yaw: d(f, b0.r), pitch: d(f, b0.u), roll: d(u, b0.r) }
  }, b0)
  const axis = Math.abs(m.yaw) > Math.abs(m.pitch) && Math.abs(m.yaw) > Math.abs(m.roll) ? 'yaw'
    : Math.abs(m.pitch) > Math.abs(m.roll) ? 'pitch' : 'roll'
  const got = axis === 'yaw' ? (m.yaw > 0 ? 'nose right' : 'nose left')
    : axis === 'pitch' ? (m.pitch > 0 ? 'nose up' : 'nose down')
    : (m.roll > 0 ? 'bank right' : 'bank left')
  check(label, got, want)
}

console.log('thrusters')
for (const [key, label, want] of THRUSTERS) {
  await reset()
  await new Promise(r => setTimeout(r, 250))
  await hold(key, 800)
  const v = await page.evaluate(() => {
    const { game, THREE } = window.__fs
    const q = game.ship.quat
    const vel = game.ship.vel
    return { right: vel.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(q)),
             up: vel.dot(new THREE.Vector3(0, 1, 0).applyQuaternion(q)) }
  })
  const got = Math.abs(v.right) > Math.abs(v.up)
    ? (v.right > 0 ? 'right' : 'left') : (v.up > 0 ? 'up' : 'down')
  check(label, got, want)
}

await browser.close()
console.log(failed ? `FAIL (${failed})` : 'PASS')
process.exit(failed ? 1 : 0)
