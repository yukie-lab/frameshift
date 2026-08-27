import * as THREE from 'three'
import type { HUDState } from '../engine/types'

const ORANGE = '#ff8c2a'
const CYAN = '#35d6ff'
const RED = '#ff3b30'
const GREEN = '#7cff9e'
const PANEL = 'rgba(8,12,16,.55)'
const STROKE = 'rgba(255,140,42,.8)'
const DIM = 'rgba(255,140,42,.45)'
const MONO = "'Consolas','Menlo',monospace"
const SANS = "'Segoe UI',system-ui,sans-serif"

const W = 2048
const H = 1024

export class HUD {
  private cam: THREE.PerspectiveCamera
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tex: THREE.CanvasTexture
  private mat: THREE.MeshBasicMaterial
  private mesh: THREE.Mesh
  private lastDraw = 0
  private helpVisible = false
  private sweep = 0

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyH' && !e.repeat) this.helpVisible = !this.helpVisible
  }

  constructor(camera: THREE.PerspectiveCamera) {
    this.cam = camera
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.ctx = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
    this.mesh.position.z = -.135
    this.mesh.renderOrder = 600
    this.mesh.frustumCulled = false
    camera.add(this.mesh)
    window.addEventListener('keydown', this.onKey)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.cam.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }

  draw(state: HUDState): void {
    const now = performance.now()
    const dt = Math.min(.1, (now - this.lastDraw) / 1000)
    if (now - this.lastDraw < 30) return
    this.lastDraw = now
    this.sweep += dt * 1.4

    const aspect = this.cam.aspect
    const planeH = .196
    this.mesh.scale.set(planeH * aspect, planeH, 1)

    const c = this.ctx
    c.clearRect(0, 0, W, H)
    const cx = W / 2
    const cy = H / 2

    const tunnelActive = state.jumpPhase === 'tunnel'
    c.globalAlpha = tunnelActive ? .25 : 1

    this.drawReticle(c, cx, cy, state)
    this.drawMarkers(c, cx, cy, state)
    this.drawSpeed(c, cx, cy, state)
    this.drawHeading(c, cx, state)
    this.drawNav(c, cx, cy, state)
    this.drawBars(c, cx, cy, state)
    this.drawRadar(c, cx, cy, state, dt)
    this.drawJump(c, cx, cy, state)
    this.drawSCExtras(c, cx, cy, state)

    c.globalAlpha = 1
    if (this.helpVisible) this.drawHelp(c, cx, cy)
    if (!state.faOn && !state.supercruise) {
      c.font = `600 26px ${SANS}`
      c.fillStyle = RED
      c.textAlign = 'center'
      c.globalAlpha = .55 + .45 * Math.sin(now / 180)
      c.fillText('FLIGHT ASSIST OFF', cx, cy + 150)
      c.globalAlpha = 1
    }
    this.tex.needsUpdate = true
  }

  private chamfer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number): void {
    c.beginPath()
    c.moveTo(x + cut, y)
    c.lineTo(x + w - cut, y)
    c.lineTo(x + w, y + cut)
    c.lineTo(x + w, y + h - cut)
    c.lineTo(x + w - cut, y + h)
    c.lineTo(x + cut, y + h)
    c.lineTo(x, y + h - cut)
    c.lineTo(x, y + cut)
    c.closePath()
  }

  private panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke = STROKE): void {
    this.chamfer(c, x, y, w, h, 14)
    c.fillStyle = PANEL
    c.fill()
    c.strokeStyle = stroke
    c.lineWidth = 1.6
    c.stroke()
  }

  private drawReticle(c: CanvasRenderingContext2D, cx: number, cy: number, _s: HUDState): void {
    c.strokeStyle = ORANGE
    c.lineWidth = 2
    c.beginPath(); c.arc(cx, cy, 20, 0, Math.PI*2); c.stroke()
    c.fillStyle = ORANGE
    c.beginPath(); c.arc(cx, cy, 2.6, 0, Math.PI*2); c.fill()
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI/2 + Math.PI/4
      c.beginPath()
      c.moveTo(cx + Math.cos(a)*24, cy + Math.sin(a)*24)
      c.lineTo(cx + Math.cos(a)*32, cy + Math.sin(a)*32)
      c.stroke()
    }
  }

  private projectDir(v: THREE.Vector3, cx: number, cy: number): [number, number] | null {
    const len = v.length()
    if (len < 1e-6 || v.z >= -.001) return null
    const cam = this.cam
    const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const tanX = tanY * cam.aspect
    const yaw = Math.atan2(v.x, -v.z)
    const pitch = Math.asin(THREE.MathUtils.clamp(v.y / len, -1, 1))
    const px = cx + (Math.tan(yaw) / tanX) * (W / 2)
    const py = cy - (Math.tan(pitch) / tanY) * (H / 2)
    if (Math.abs(px - cx) > W/2*.98 || Math.abs(py - cy) > H/2*.94) return null
    return [px, py]
  }

  private drawMarkers(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    if (s.supercruise) return
    const p = s.progradeLocal ? this.projectDir(s.progradeLocal, cx, cy) : null
    if (p) {
      const [x, y] = p
      c.strokeStyle = GREEN
      c.lineWidth = 2
      c.beginPath(); c.arc(x, y, 12, 0, Math.PI*2); c.stroke()
      c.beginPath()
      c.moveTo(x-19, y); c.lineTo(x-9, y)
      c.moveTo(x+9, y); c.lineTo(x+19, y)
      c.moveTo(x, y-19); c.lineTo(x, y-9)
      for (const a of [-Math.PI/2, Math.PI/2]) {
        c.moveTo(x + Math.cos(a)*12, y + Math.sin(a)*12)
        c.lineTo(x + Math.cos(a)*18, y + Math.sin(a)*18)
      }
      c.stroke()
      c.fillStyle = GREEN
      c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI*2); c.fill()
    }
    const rg = s.retrogradeLocal ? this.projectDir(s.retrogradeLocal, cx, cy) : null
    if (rg) {
      const [x, y] = rg
      c.strokeStyle = CYAN
      c.lineWidth = 2
      c.beginPath(); c.arc(x, y, 12, 0, Math.PI*2); c.stroke()
      c.beginPath()
      const k = 12 / Math.SQRT2 * .7
      c.moveTo(x-k, y-k); c.lineTo(x+k, y+k)
      c.moveTo(x+k, y-k); c.lineTo(x-k, y+k)
      c.moveTo(x, y-19); c.lineTo(x, y-9)
      c.stroke()
    }
  }

  private drawSpeed(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    const x = cx - 560
    const y = cy - 74
    this.panel(c, x, y, 310, 148)
    c.textAlign = 'left'
    c.font = `500 20px ${SANS}`
    c.fillStyle = DIM
    c.fillText(s.supercruise ? 'SUPERCRUISE' : 'SPEED', x + 18, y + 32)
    c.fillStyle = s.supercruise ? CYAN : ORANGE
    c.font = `600 54px ${MONO}`
    if (s.supercruise) {
      c.font = `600 38px ${MONO}`
      c.fillText(s.scLabel, x + 18, y + 88)
    } else {
      const spd = s.speed
      const label = spd < 1000 ? `${Math.round(spd)}` : spd < 1e6 ? `${(spd/1000).toFixed(1)} km/s` : `${(spd/299792458).toFixed(2)} c`
      c.fillText(label, x + 18, y + 92)
    }
    c.font = `500 18px ${SANS}`
    c.fillStyle = DIM
    c.fillText(`THR ${Math.round(s.throttlePct)}%`, x + 18, y + 124)
    const tbX = x + 258
    c.strokeStyle = DIM
    c.strokeRect(tbX, y + 44, 12, 84)
    const th = (s.throttlePct + 100) / 200
    c.fillStyle = ORANGE
    c.fillRect(tbX + 1, y + 44 + 82*(1-th), 10, Math.max(2, 82*th))
    c.strokeStyle = '#ffffff55'
    c.beginPath(); c.moveTo(tbX - 3, y + 86); c.lineTo(tbX + 15, y + 86); c.stroke()

    c.font = `600 22px ${MONO}`
    c.fillStyle = s.faOn ? GREEN : RED
    c.fillText(s.faOn ? 'FA ON' : 'FA OFF', x + 18, y + 178)
    if (s.boosting) {
      c.fillStyle = ORANGE
      c.globalAlpha = .6 + .4*Math.sin(performance.now()/90)
      c.fillText('BOOST', x + 110, y + 178)
      c.globalAlpha = 1
    }
  }

  private drawHeading(c: CanvasRenderingContext2D, cx: number, s: HUDState): void {
    const w = 720
    const x = cx - w/2
    const y = 34
    this.panel(c, x, y, w, 56)
    c.save()
    this.chamfer(c, x, y, w, 56, 14)
    c.clip()
    c.textAlign = 'center'
    const hdg = s.headingDeg
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((hdg + d) % 360 + 360) % 360
      const px = cx + d * (w / 130)
      if (deg % 30 === 0) {
        c.strokeStyle = ORANGE
        c.lineWidth = 2
        c.beginPath(); c.moveTo(px, y + 30); c.lineTo(px, y + 46); c.stroke()
        const labels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }
        c.fillStyle = labels[deg] ? CYAN : 'rgba(255,190,120,.85)'
        c.font = `600 22px ${MONO}`
        c.fillText(labels[deg] ?? `${deg}`, px, y + 26)
      } else {
        c.strokeStyle = DIM
        c.lineWidth = 1
        c.beginPath(); c.moveTo(px, y + 36); c.lineTo(px, y + 46); c.stroke()
      }
    }
    c.restore()
    c.fillStyle = CYAN
    c.beginPath()
    c.moveTo(cx, y + 58)
    c.lineTo(cx - 8, y + 70)
    c.lineTo(cx + 8, y + 70)
    c.closePath()
    c.fill()
    c.textAlign = 'center'
    c.font = `600 22px ${MONO}`
    c.fillStyle = ORANGE
    c.fillText(`${Math.round(hdg)}°`, cx, y + 92)
  }

  private fmtDist(m: number): string {
    if (m < 1e6) return `${(m/1e3).toFixed(1)} km`
    const ls = m / 299792458
    if (ls < 1000) return `${ls.toFixed(2)} Ls`
    return `${(m/1.495978707e11).toFixed(2)} AU`
  }

  private drawNav(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    const x = cx + 330
    const y = cy - 160
    const w = 420
    const hgt = 320
    this.panel(c, x, y, w, hgt)
    c.textAlign = 'left'
    c.font = `500 20px ${SANS}`
    c.fillStyle = DIM
    c.fillText('NAVIGATION', x + 18, y + 32)
    c.font = `600 24px ${MONO}`
    c.fillStyle = CYAN
    c.fillText(s.nearestName.toUpperCase(), x + 18, y + 66)
    c.font = `500 20px ${MONO}`
    c.fillStyle = ORANGE
    c.fillText(this.fmtDist(s.nearestDistM), x + 18, y + 96)
    if (s.altitudeM != null && s.altitudeM < 5e7) {
      c.fillStyle = GREEN
      c.fillText(`ALT ${(s.altitudeM/1e3).toFixed(1)} km`, x + 220, y + 96)
    }
    c.strokeStyle = 'rgba(53,214,255,.3)'
    c.lineWidth = 1
    c.beginPath(); c.moveTo(x + 14, y + 112); c.lineTo(x + w - 14, y + 112); c.stroke()
    let ty = y + 142
    for (const t of s.targets.slice(0, 5)) {
      if (t.name === s.nearestName) continue
      c.font = `500 19px ${MONO}`
      c.fillStyle = t.type === 'moon' ? CYAN : ORANGE
      c.fillText(t.name.toUpperCase().slice(0, 18), x + 18, ty)
      c.fillStyle = DIM
      c.textAlign = 'right'
      c.fillText(`${t.type}  ${this.fmtDist(t.distM)}`, x + w - 18, ty)
      c.textAlign = 'left'
      ty += 32
    }
  }

  private drawTargetBrackets(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    for (const t of s.targets) {
      if (t.ndcX == null || t.ndcY == null) continue
      if (Math.abs(t.ndcX) > .72 || Math.abs(t.ndcY) > .62) continue
      const px = cx + t.ndcX * (W/2)
      const py = cy - t.ndcY * (H/2)
      const sz = 16
      c.strokeStyle = 'rgba(53,214,255,.85)'
      c.lineWidth = 1.6
      const ex = THREE.MathUtils.clamp(px, 50, W - 50)
      const ey = THREE.MathUtils.clamp(py, 120, H - 220)
      if (ex !== px || ey !== py) continue
      c.beginPath()
      c.moveTo(ex-sz, ey-sz+7); c.lineTo(ex-sz, ey-sz); c.lineTo(ex-sz+7, ey-sz)
      c.moveTo(ex+sz-7, ey-sz); c.lineTo(ex+sz, ey-sz); c.lineTo(ex+sz, ey-sz+7)
      c.moveTo(ex+sz, ey+sz-7); c.lineTo(ex+sz, ey+sz); c.lineTo(ex+sz-7, ey+sz)
      c.moveTo(ex-sz+7, ey+sz); c.lineTo(ex-sz, ey+sz); c.lineTo(ex-sz, ey+sz-7)
      c.stroke()
    }
  }

  private drawBars(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    const x = 60
    const y = H - 150
    this.panel(c, x, y, 340, 96)
    c.font = `500 18px ${SANS}`
    c.fillStyle = DIM
    c.fillText('FUEL', x + 16, y + 30)
    c.strokeStyle = DIM
    c.strokeRect(x + 76, y + 16, 240, 14)
    c.fillStyle = ORANGE
    c.fillRect(x + 78, y + 18, Math.max(2, 236*s.fuel), 10)
    const hot = s.heat > .8
    c.fillStyle = hot ? RED : DIM
    c.fillText('HEAT', x + 16, y + 66)
    c.strokeStyle = DIM
    c.strokeRect(x + 76, y + 52, 240, 14)
    c.fillStyle = hot ? RED : CYAN
    c.fillRect(x + 78, y + 54, Math.max(2, 236*s.heat), 10)
    if (hot) {
      c.globalAlpha = .5 + .5*Math.sin(performance.now()/120)
      c.font = `600 18px ${MONO}`
      c.fillStyle = RED
      c.fillText('OVERHEAT', x + 76, y + 88)
      c.globalAlpha = 1
    }
  }

  private drawRadar(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState, _dt: number): void {
    if (s.supercruise) return
    const R = 165
    const rx = cx
    const ry = H - R - 46
    c.save()
    c.beginPath()
    c.arc(rx, ry, R, 0, Math.PI*2)
    c.fillStyle = 'rgba(8,12,16,.62)'
    c.fill()
    c.clip()
    const bgGrad = c.createRadialGradient(rx, ry, 0, rx, ry, R)
    bgGrad.addColorStop(0, 'rgba(53,214,255,.06)')
    bgGrad.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = bgGrad
    c.fillRect(rx-R, ry-R, R*2, R*2)
    c.strokeStyle = 'rgba(53,214,255,.28)'
    c.lineWidth = 1
    for (const f of [.33, .66]) {
      c.beginPath(); c.arc(rx, ry, R*f, 0, Math.PI*2); c.stroke()
    }
    c.strokeStyle = 'rgba(53,214,255,.14)'
    c.beginPath(); c.moveTo(rx-R, ry); c.lineTo(rx+R, ry); c.stroke()
    c.beginPath(); c.moveTo(rx, ry-R); c.lineTo(rx, ry+R); c.stroke()
    const sw = this.sweep % (Math.PI*2)
    c.fillStyle = 'rgba(53,214,255,.13)'
    c.beginPath()
    c.moveTo(rx, ry)
    c.arc(rx, ry, R*.97, sw - .9, sw)
    c.closePath()
    c.fill()
    c.strokeStyle = 'rgba(120,230,255,.75)'
    c.lineWidth = 1.6
    c.beginPath()
    c.moveTo(rx, ry)
    c.lineTo(rx + Math.cos(sw)*R*.97, ry + Math.sin(sw)*R*.97)
    c.stroke()
    for (const t of s.targets) {
      const rFrac = THREE.MathUtils.clamp(
        Math.log10(Math.max(t.distM, 1e6)) / Math.log10(1e13), .12, 1)
      const bx = Math.sin(t.relBearing) * R * .85 * rFrac
      const by = -Math.cos(t.relBearing) * R * .85 * rFrac
      const stem = THREE.MathUtils.clamp(t.relElev * 60, -20, 20)
      const dotR = THREE.MathUtils.clamp(2.5 + Math.log10(Math.max(t.radiusM, 1))/6, 2.5, 7)
      c.strokeStyle = 'rgba(53,214,255,.7)'
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(rx + bx, ry + by)
      c.lineTo(rx + bx, ry + by - stem)
      c.stroke()
      c.fillStyle = ORANGE
      c.beginPath()
      c.arc(rx + bx, ry + by - stem, dotR, 0, Math.PI*2)
      c.fill()
      c.strokeStyle = 'rgba(255,140,42,.55)'
      c.lineWidth = 1
      c.beginPath()
      c.arc(rx + bx, ry + by - stem, dotR+3.5, 0, Math.PI*2)
      c.stroke()
    }
    c.restore()
    c.strokeStyle = STROKE
    c.lineWidth = 2
    c.beginPath(); c.arc(rx, ry, R, 0, Math.PI*2); c.stroke()
    c.strokeStyle = 'rgba(53,214,255,.45)'
    c.lineWidth = 1
    c.beginPath(); c.arc(rx, ry, R-6, 0, Math.PI*2); c.stroke()
    c.font = `500 15px ${SANS}`
    c.fillStyle = DIM
    c.textAlign = 'center'
    c.fillText('RADAR', rx, ry + R + 26)
    c.textAlign = 'left'
  }

  private drawJump(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    if (s.jumpPhase === 'idle') return
    c.textAlign = 'center'
    if (s.jumpPhase === 'charging') {
      c.strokeStyle = CYAN
      c.lineWidth = 5
      c.beginPath()
      c.arc(cx, cy, 52, -Math.PI/2, -Math.PI/2 + Math.PI*2*s.jumpProgress)
      c.stroke()
      c.strokeStyle = 'rgba(53,214,255,.25)'
      c.lineWidth = 2
      c.beginPath(); c.arc(cx, cy, 52, 0, Math.PI*2); c.stroke()
      c.font = `600 26px ${SANS}`
      c.fillStyle = CYAN
      c.fillText('FRAME SHIFT DRIVE CHARGING', cx, cy + 110)
    } else if (s.jumpPhase === 'arrived') {
      c.font = `600 30px ${SANS}`
      c.fillStyle = ORANGE
      c.globalAlpha = 1 - s.jumpProgress
      c.fillText('ARRIVAL CONFIRMED', cx, cy - 120)
      c.globalAlpha = 1
    }
    c.textAlign = 'left'
  }

  private drawSCExtras(c: CanvasRenderingContext2D, cx: number, cy: number, s: HUDState): void {
    if (!s.supercruise) return
    const t = s.targets[0]
    if (t) {
      const fmtD = (m: number): string => {
        if (m < 1e6) return `${(m/1e3).toFixed(0)} km`
        const ls = m / 299792458
        if (ls < 1000) return `${ls.toFixed(2)} Ls`
        return `${(m/1.495978707e11).toFixed(2)} AU`
      }
      c.textAlign = 'center'
      c.font = `600 30px ${MONO}`
      c.fillStyle = CYAN
      c.fillText(fmtD(t.distM), cx, cy + 170)
      if (t.ndcX != null && t.ndcY != null && Math.abs(t.ndcX) < .95 && Math.abs(t.ndcY) < .9) {
        const px = cx + t.ndcX * (W / 2)
        const py = cy - t.ndcY * (H / 2)
        const angR = Math.asin(Math.min(1, t.radiusM / Math.max(t.distM, 1)))
        const orbR = THREE.MathUtils.clamp(
          Math.tan(angR) / (Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2))) * (H / 2),
          6, 260)
        const grad = c.createRadialGradient(px, py, 0, px, py, orbR*1.15)
        grad.addColorStop(0, 'rgba(180,240,255,.85)')
        grad.addColorStop(.35, 'rgba(90,200,255,.38)')
        grad.addColorStop(1, 'rgba(60,140,255,0)')
        c.fillStyle = grad
        c.beginPath(); c.arc(px, py, orbR*1.15, 0, Math.PI*2); c.fill()
        c.strokeStyle = 'rgba(53,214,255,.8)'
        c.lineWidth = 1.5
        c.beginPath(); c.arc(px, py, orbR+14, -.6, .6); c.stroke()
        this.drawTargetBrackets(c, cx, cy, s)
      } else {
        const bx = Math.sin(t.relBearing)
        const by = Math.cos(t.relBearing)
        const mx = W/2 - 130, my = H/2 - 110
        const sc = Math.min(mx/Math.max(Math.abs(bx),1e-4), my/Math.max(Math.abs(by),1e-4))
        const px = cx + bx*sc
        const py = cy + by*sc
        const ang = Math.atan2(by, bx)
        c.save()
        c.translate(px, py)
        c.rotate(ang)
        c.fillStyle = CYAN
        c.beginPath()
        c.moveTo(16, 0); c.lineTo(-10, 10); c.lineTo(-10, -10)
        c.closePath(); c.fill()
        c.restore()
        c.font = `500 20px ${MONO}`
        c.textAlign = 'center'
        c.fillStyle = 'rgba(53,214,255,.8)'
        c.fillText(t.name.toUpperCase(), px - bx*90, py - by*90 + 6)
      }
      c.textAlign = 'center'
      c.font = `600 24px ${SANS}`
      c.fillStyle = CYAN
      c.fillText('SUPERCRUISE ENGAGED', cx, cy - 90)
      c.textAlign = 'left'
    }
  }

  private drawHelp(c: CanvasRenderingContext2D, cx: number, cy: number): void {
    const lines = [
      'W/S pitch   A/D yaw   Q/E roll',
      'SHIFT/Z throttle   ARROWS lateral+vertical thrust',
      'TAB boost   X flight assist   J supercruise',
      'ENTER hyperspace jump   H toggle help'
    ]
    const w = 640
    const h = 40 + lines.length * 36
    this.panel(c, cx - w/2, cy - h/2 - 140, w, h, 'rgba(53,214,255,.7)')
    c.textAlign = 'center'
    c.font = `500 22px ${MONO}`
    c.fillStyle = CYAN
    let ly = cy - h/2 - 140 + 44
    for (const l of lines) {
      c.fillText(l, cx, ly)
      ly += 36
    }
    c.textAlign = 'left'
  }
}
