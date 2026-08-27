import * as THREE from 'three'
import type { FlightModelLike, InputState } from '../engine/types'

const MAX_SPEED = 450
const BOOST_SPEED = 900
const APPROACH_TAU = 0.55
const ROT_SMOOTH_K = 9
const PITCH_RATE = 1.6
const YAW_RATE = 1.15
const ROLL_RATE = 2.3
const FA_OFF_ACCEL = 60
const BOOST_MULT = 4
const BOOST_DURATION = 3
const HEAT_PEAK = 0.85
const HEAT_RISE_K = 2
const HEAT_COOL_RATE = 0.08

const _thrust = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _spin = new THREE.Quaternion()

export class FlightModel implements FlightModelLike {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  quat = new THREE.Quaternion()
  angVel = new THREE.Vector3()
  faOn = true
  boosting = false
  supercruise = false
  heat = 0

  readonly maxSpeed = MAX_SPEED
  readonly boostSpeed = BOOST_SPEED
  readonly approachTau = APPROACH_TAU
  readonly rotSmoothK = ROT_SMOOTH_K
  readonly pitchRate = PITCH_RATE
  readonly yawRate = YAW_RATE
  readonly rollRate = ROLL_RATE
  readonly faOffAccel = FA_OFF_ACCEL

  private boostTimer = 0
  private prevBoost = false
  private prevFaToggle = false

  get speed(): number {
    return this.vel.length()
  }

  update(dt: number, input: InputState): void {
    if (input.faToggle && !this.prevFaToggle) this.faOn = !this.faOn
    this.prevFaToggle = input.faToggle

    if (this.supercruise) {
      this.prevBoost = input.boost
      return
    }

    if (input.boost && !this.prevBoost && this.boostTimer <= 0) this.boostTimer = BOOST_DURATION
    this.prevBoost = input.boost
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt)
    this.boosting = this.boostTimer > 0

    if (this.boosting) {
      this.heat += (HEAT_PEAK - this.heat) * (1 - Math.exp(-HEAT_RISE_K * dt))
    } else {
      this.heat -= HEAT_COOL_RATE * dt
    }
    this.heat = Math.min(1, Math.max(0, this.heat))

    const hasRotInput = input.pitch !== 0 || input.yaw !== 0 || input.roll !== 0
    if (this.faOn || hasRotInput) {
      const k = 1 - Math.exp(-ROT_SMOOTH_K * dt)
      this.angVel.x += (input.pitch * PITCH_RATE - this.angVel.x) * k
      this.angVel.y += (-input.yaw * YAW_RATE - this.angVel.y) * k
      this.angVel.z += (-input.roll * ROLL_RATE - this.angVel.z) * k
    }

    const wLen = this.angVel.length()
    if (wLen > 1e-9) {
      _axis.copy(this.angVel).divideScalar(wLen)
      _spin.setFromAxisAngle(_axis, wLen * dt)
      this.quat.multiply(_spin).normalize()
    }

    _thrust.set(input.lateral, input.vertical, -input.throttle)

    if (this.faOn) {
      const mag = Math.min(_thrust.length(), 1)
      if (mag > 1e-6) {
        const capMag = this.boosting ? this.boostSpeed : this.maxSpeed
        _thrust.normalize().multiplyScalar(mag * capMag)
        _thrust.applyQuaternion(this.quat)
      } else {
        _thrust.set(0, 0, 0)
      }
      const rate = ((this.boosting ? BOOST_MULT : 1) / APPROACH_TAU) * dt
      const k = 1 - Math.exp(-rate)
      this.vel.lerp(_thrust, k)
      if (this.boosting) {
        const s = this.vel.length()
        if (s > this.boostSpeed) this.vel.multiplyScalar(this.boostSpeed / s)
      }
    } else {
      if (_thrust.lengthSq() > 0) {
        const accel = FA_OFF_ACCEL * (this.boosting ? BOOST_MULT : 1)
        _thrust.applyQuaternion(this.quat).multiplyScalar(accel * dt)
        this.vel.add(_thrust)
        if (this.boosting) {
          const s = this.vel.length()
          if (s > this.boostSpeed) this.vel.multiplyScalar(this.boostSpeed / s)
        }
      }
    }

    this.pos.addScaledVector(this.vel, dt)
  }
}
