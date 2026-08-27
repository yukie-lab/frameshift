import * as THREE from 'three'
import type { SupercruiseLike, FlightModelLike, InputState } from '../engine/types'

const C = 299792458
const MIN_SPEED = 3e4
const MAX_SPEED = 2001 * C
const TAU_RESP = 0.8
const PITCH_RATE = 1.6
const YAW_RATE = 1.15
const ROLL_RATE = 2.3
const ROT_K = 9
const STREAK_COUNT = 900
const SHELL_MIN = 60
const SHELL_MAX = 650

export interface UniverseAccessor {
  starPos: THREE.Vector3
  starRadiusM: number
  bodies: { pos: THREE.Vector3; radiusM: number }[]
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _fwd = new THREE.Vector3()

export class SupercruiseController implements SupercruiseLike {
  active = false
  private acc: () => UniverseAccessor
  private speed = MIN_SPEED
  private rotRates = new THREE.Vector3()
  private well = 0
  private fovMul = 1
  private streaks: THREE.LineSegments
  private anchors: Float32Array
  private rand = mulberry32(1337)
  private lastActive = false

  constructor(camera: THREE.PerspectiveCamera, acc: () => UniverseAccessor) {
    this.acc = acc
    const geo = new THREE.BufferGeometry()
    this.anchors = new Float32Array(STREAK_COUNT * 3)
    const positions = new Float32Array(STREAK_COUNT * 2 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xbcd4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    })
    this.streaks = new THREE.LineSegments(geo, mat)
    this.streaks.frustumCulled = false
    this.streaks.renderOrder = 50
    this.streaks.visible = false
    camera.add(this.streaks)
  }

  private spawnAhead(i: number, fwd: THREE.Vector3): void {
    const u = this.rand()*2 - 1
    const ph = this.rand()*Math.PI*2
    const sq = Math.sqrt(1-u*u)
    const r = SHELL_MIN + Math.pow(this.rand(), .55)*(SHELL_MAX-SHELL_MIN)
    _v2.set(r*sq*Math.cos(ph), r*u, r*sq*Math.sin(ph))
    const ahead = _v2.dot(fwd)
    if (ahead < 0) _v2.addScaledVector(fwd, -2*ahead)
    this.anchors[i*3]   = _v2.x
    this.anchors[i*3+1] = _v2.y
    this.anchors[i*3+2] = _v2.z
  }

  private speedForThrottle(t: number): number {
    const tc = Math.min(1, Math.max(0, t))
    return MIN_SPEED * Math.pow(MAX_SPEED/MIN_SPEED, tc)
  }

  update(dt: number, ship: FlightModelLike, input: InputState): void {
    const rr = this.rotRates
    rr.x += ((input.pitch*PITCH_RATE) - rr.x) * Math.min(1, dt*ROT_K)
    rr.y += ((-input.yaw*YAW_RATE) - rr.y) * Math.min(1, dt*ROT_K)
    rr.z += ((-input.roll*ROLL_RATE) - rr.z) * Math.min(1, dt*ROT_K)
    _v1.set(rr.x, rr.y, rr.z)
    if (_v1.lengthSq() > 0) {
      _q1.setFromAxisAngle(_v1.clone().normalize(), _v1.length()*dt)
      ship.quat.multiply(_q1).normalize()
    }

    let cap = MAX_SPEED
    this.well = 0
    const uni = this.acc()
    const wells: { pos: THREE.Vector3; radiusM: number }[] = [
      { pos: uni.starPos, radiusM: uni.starRadiusM },
      ...uni.bodies
    ]
    for (const w of wells) {
      const dist = ship.pos.distanceTo(w.pos)
      const ratio = dist / Math.max(w.radiusM, 1)
      const depth = THREE.MathUtils.clamp((8 - ratio) / (8 - 1.5), 0, 1)
      if (depth > this.well) this.well = depth
      const tEase = Math.pow(depth, 2.2)
      const wcap = THREE.MathUtils.lerp(MAX_SPEED, MIN_SPEED * 2.5, tEase)
      if (wcap < cap) cap = wcap
    }

    const commanded = Math.min(this.speedForThrottle(input.throttle), cap)
    const entering = this.active && !this.lastActive
    this.lastActive = this.active
    if (entering) this.speed = commanded
    this.speed += (commanded - this.speed) * (1 - Math.exp(-dt / TAU_RESP))
    if (this.speed < MIN_SPEED) this.speed = MIN_SPEED

    const fwd = _v1.set(0, 0, -1).applyQuaternion(ship.quat)
    ship.pos.addScaledVector(fwd, this.speed * dt)

    const norm = THREE.MathUtils.clamp(
      Math.log(Math.max(this.speed, 1e6) / 1e6) / Math.log(MAX_SPEED / 1e6), 0, 1)
    const targetFov = 1 + .16 * norm
    this.fovMul += (targetFov - this.fovMul) * Math.min(1, dt * 3)

    this.updateStreaks(ship, norm, dt)
  }

  private updateStreaks(ship: FlightModelLike, norm: number, dt: number): void {
    const vis = this.active && norm > .004
    this.streaks.visible = vis
    const mat = this.streaks.material as THREE.LineBasicMaterial
    mat.opacity = vis ? .16 + .40 * norm : 0
    if (!vis) return

    const fwd = _fwd.set(0, 0, -1).applyQuaternion(ship.quat)
    const fx = fwd.x, fy = fwd.y, fz = fwd.z
    const cam = this.streaks.parent as THREE.Camera
    _q1.copy(cam.quaternion).invert()

    const flow = Math.min((140 + 3400 * Math.pow(norm, 1.4)) * dt, SHELL_MAX * .9)
    const len = THREE.MathUtils.clamp(12 + 660 * Math.pow(norm, 1.5), 8, 660)
    const shellHi = SHELL_MAX * SHELL_MAX
    const shellLo = SHELL_MIN * SHELL_MIN * .16

    const posAttr = this.streaks.geometry.attributes.position as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array

    for (let i = 0; i < STREAK_COUNT; i++) {
      let ax = this.anchors[i*3] - fx * flow
      let ay = this.anchors[i*3+1] - fy * flow
      let az = this.anchors[i*3+2] - fz * flow
      const dSq = ax*ax + ay*ay + az*az
      if (dSq > shellHi || dSq < shellLo) {
        this.spawnAhead(i, fwd)
        ax = this.anchors[i*3]; ay = this.anchors[i*3+1]; az = this.anchors[i*3+2]
      } else {
        this.anchors[i*3] = ax; this.anchors[i*3+1] = ay; this.anchors[i*3+2] = az
      }
      _v1.set(ax, ay, az).applyQuaternion(_q1)
      const tail = Math.min(len, Math.max(_v1.length() - SHELL_MIN * .5, 2))
      arr[i*6]   = _v1.x
      arr[i*6+1] = _v1.y
      arr[i*6+2] = _v1.z
      arr[i*6+3] = _v1.x
      arr[i*6+4] = _v1.y
      arr[i*6+5] = _v1.z + tail
    }
    posAttr.needsUpdate = true
  }

  speedLabel(): string {
    const s = this.speed
    if (s < C * .01) return `${Math.round(s / 1000).toLocaleString()} km/s`
    if (s < 100 * C) return `${(s / C).toFixed(1)} c`
    return `${(s / C / 1000).toFixed(2)} kc`
  }

  fovMultiplier(): number { return this.fovMul }
  currentSpeed(): number { return this.speed }
  wellFactor(): number { return this.well }
}
