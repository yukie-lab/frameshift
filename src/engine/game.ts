import * as THREE from 'three'
import { RenderStack } from './renderer'
import { InputManager } from './input'
import type {
  Universe, HUDState, HUDLike, SupercruiseLike, FlightModelLike,
  HyperspaceLike, CelestialBody, TargetInfo
} from './types'

export class Game {
  rs: RenderStack
  input = new InputManager()
  ship: FlightModelLike | null = null
  universe: Universe | null = null
  hud: HUDLike | null = null
  sc: SupercruiseLike | null = null
  fx: HyperspaceLike | null = null
  showHelp = false

  private sun = new THREE.DirectionalLight(0xffffff, 3.2)
  private amb = new THREE.AmbientLight(0x1a2434, 1.1)
  private lastT = performance.now()
  private absT = 0
  throttleLevel = 0
  private fuel = 1
  private lastFov = 0
  private tmpV = new THREE.Vector3()
  private tmpQ = new THREE.Quaternion()
  private shakeQ = new THREE.Quaternion()
  private shakeE = new THREE.Euler()

  constructor(container: HTMLElement) {
    this.rs = new RenderStack(container)
    this.rs.scene.add(this.sun)
    this.rs.scene.add(this.sun.target)
    this.rs.scene.add(this.amb)
    window.addEventListener('resize', () => this.resize())
  }

  start(): void {
    requestAnimationFrame(this.tick)
  }

  resize(): void {
    this.rs.resize()
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick)
    const now = performance.now()
    const dt = Math.min((now - this.lastT) / 1000, 0.05)
    this.lastT = now
    this.absT += dt
    this.step(dt)
  }

  private step(dt: number): void {
    const inp = this.input.state
    this.input.refresh()

    if (this.input.consume('help')) this.showHelp = !this.showHelp
    if (this.ship) {
      if (this.input.consume('faToggle')) this.ship.faOn = !this.ship.faOn
      if (this.input.consume('scToggle')) {
        if (this.sc) {
          this.sc.active = !this.sc.active
          this.ship.supercruise = this.sc.active
          if (!this.sc.active) this.throttleLevel = Math.min(this.throttleLevel, 0.99)
        }
      }
      if (this.input.consume('jump') && this.fx && this.fx.phase === 'idle') this.fx.trigger()
    }

    if (inp.throttleUpHeld) this.throttleLevel = Math.min(1, this.throttleLevel + dt * 0.9)
    if (inp.throttleDownHeld) this.throttleLevel = Math.max(-1, this.throttleLevel - dt * 0.9)
    inp.throttle = this.throttleLevel

    if (this.fx) this.fx.update(dt)

    if (this.ship) {
      if (this.sc && this.sc.active) {
        this.ship.update(dt, inp)
        this.sc.update(dt, this.ship, inp)
        this.fuel = Math.max(0, this.fuel - dt * 0.0004)
      } else {
        this.ship.update(dt, inp)
        this.fuel = Math.max(0, this.fuel - dt * (0.0012 + (this.ship.boosting ? 0.02 : 0)))
      }
    }

    if (this.universe) {
      this.universe.update(this.absT)
      this.syncScene()
    }

    if (this.hud && this.ship && !this.rs.bypassPost) this.hud.draw(this.buildHUDState())

    const targetFov = this.rs.baseFov * (this.sc && this.sc.active ? this.sc.fovMultiplier() : 1)
    if (Math.abs(targetFov - this.lastFov) > 0.01) {
      this.lastFov = targetFov
      this.rs.camera.fov = targetFov
      this.rs.camera.updateProjectionMatrix()
    }

    this.rs.render()
  }

  private syncScene(): void {
    if (!this.universe || !this.ship) return
    const cam = this.rs.camera
    const cp = this.ship.pos
    cam.position.set(0, 0, 0)
    cam.quaternion.copy(this.ship.quat)
    if (this.fx && this.fx.phase === 'tunnel') {
      const amp = .004 * (0.4 + 0.6 * this.fx.progress)
      this.shakeQ.setFromEuler(this.shakeE.set(
        (Math.random()-.5)*amp, (Math.random()-.5)*amp, (Math.random()-.5)*amp*.6))
      cam.quaternion.multiply(this.shakeQ)
    }
    for (const e of this.universe.entries) {
      if (e.sky) { e.obj.position.set(0, 0, 0); continue }
      const bp = e.body ? e.body.pos : this.universe.starPos
      e.obj.position.copy(bp).sub(cp)
    }
    const d = this.tmpV.copy(this.universe.starPos).sub(cp).normalize()
    this.sun.position.copy(d).multiplyScalar(50000)
    this.sun.color.copy(this.universe.star.color).lerp(new THREE.Color(1, 1, 1), 0.35)
    const sunScale = Math.min(3.5, 90000 / Math.max(this.universe.star.radiusM, 1) + 1.2)
    this.sun.intensity = 2.6 * sunScale * 0.55 + 0.9
  }

  collectTargets(out: TargetInfo[]): void {
    out.length = 0
    if (!this.universe || !this.ship) return
    const cam = this.rs.camera
    const cp = this.ship.pos
    const invQ = this.tmpQ.copy(cam.quaternion).invert()
    const add = (b: CelestialBody, type: string, parentOff?: THREE.Vector3) => {
      const wp = this.tmpV.copy(b.pos)
      if (parentOff) wp.add(parentOff)
      const rel = wp.clone().sub(cp)
      const local = rel.clone().applyQuaternion(invQ)
      let ndcX: number | null = null
      let ndcY: number | null = null
      if (local.z < 0) {
        const v = new THREE.Vector4(local.x, local.y, local.z, 1).applyMatrix4(cam.projectionMatrix)
        if (v.w > 0) {
          const nx = v.x / v.w
          const ny = v.y / v.w
          if (Math.abs(nx) < 1.4 && Math.abs(ny) < 1.4) { ndcX = nx; ndcY = ny }
        }
      }
      out.push({
        name: b.name, type, distM: rel.length(), ndcX, ndcY, radiusM: b.radiusM,
        relBearing: Math.atan2(local.x, -local.z),
        relElev: Math.asin(THREE.MathUtils.clamp(local.y / Math.max(rel.length(), 1e-9), -1, 1))
      })
    }
    for (const b of this.universe.bodies) {
      add(b, b.type)
      for (const m of b.moons) add(m, 'moon', b.pos)
    }
    out.sort((a, b) => a.distM - b.distM)
    if (out.length > 6) out.length = 6
  }

  private buildHUDState(): HUDState {
    const ship = this.ship!
    const st = this.input.state
    const targets: TargetInfo[] = []
    this.collectTargets(targets)
    let nearestName = '—'
    let nearestDist = Infinity
    let altitude: number | null = null
    if (this.universe) {
      for (const b of [null, ...this.universe.bodies]) {
        const pos = b ? b.pos : this.universe.starPos
        const r = b ? b.radiusM : this.universe.star.radiusM
        const nm = b ? b.name : this.universe.star.name
        const d = pos.distanceTo(ship.pos)
        if (d < nearestDist) { nearestDist = d; nearestName = nm; altitude = Math.max(0, d - r) }
      }
      for (const p of this.universe.bodies) {
        for (const m of p.moons) {
          const d = m.pos.distanceTo(ship.pos)
          if (d < nearestDist) { nearestDist = d; nearestName = m.name; altitude = Math.max(0, d - m.radiusM) }
        }
      }
    }
    const prograde = ship.vel.lengthSq() > 1 ? ship.vel.clone().normalize() : null
    const invQ = this.tmpQ.copy(this.rs.camera.quaternion).invert()
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rs.camera.quaternion)
    const heading = (THREE.MathUtils.radToDeg(Math.atan2(fwd.x, -fwd.z)) + 360) % 360
    return {
      speed: ship.speed,
      throttlePct: st.throttle * 100,
      targetSpeedLabel: '',
      faOn: ship.faOn,
      boosting: ship.boosting,
      heat: ship.heat,
      fuel: this.fuel,
      supercruise: !!this.sc?.active,
      scLabel: this.sc && this.sc.active ? this.sc.speedLabel() : '',
      wellFactor: this.sc && this.sc.active ? this.sc.wellFactor() : 0,
      jumpPhase: this.fx ? this.fx.phase : 'idle',
      jumpProgress: this.fx ? this.fx.progress : 0,
      nearestName,
      nearestDistM: nearestDist === Infinity ? 0 : nearestDist,
      altitudeM: altitude,
      targets,
      progradeLocal: prograde ? prograde.applyQuaternion(invQ) : null,
      retrogradeLocal: prograde ? prograde.clone().negate().applyQuaternion(invQ) : null,
      headingDeg: heading
    }
  }
}
