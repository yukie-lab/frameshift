import * as THREE from 'three'

export interface InputState {
  pitch: number
  yaw: number
  roll: number
  lateral: number
  vertical: number
  throttle: number
  throttleUpHeld: boolean
  throttleDownHeld: boolean
  boost: boolean
  faToggle: boolean
  scToggle: boolean
  jump: boolean
  help: boolean
}

export interface StarInfo {
  name: string
  cls: string
  tempK: number
  radiusM: number
  color: THREE.Color
  luminosity: number
}

export type BodyType = 'earthlike' | 'rocky' | 'ice' | 'lava' | 'gas' | 'water'

export interface OrbitElements {
  aAU: number
  e: number
  incl: number
  node: number
  argP: number
  periodSec: number
  phase: number
}

export interface CelestialBody {
  name: string
  type: BodyType
  radiusM: number
  pos: THREE.Vector3
  orbit: OrbitElements
  spinPeriodSec: number
  axialTilt: number
  hasRings: boolean
  ringInnerM: number
  ringOuterM: number
  atmoColor?: THREE.Color
  cloudDensity?: number
  moons: CelestialBody[]
  mesh?: THREE.Object3D
  cloudMesh?: THREE.Object3D
}

export interface BeltInfo {
  innerM: number
  outerM: number
  count: number
}

export interface RegisterEntry {
  obj: THREE.Object3D
  body: CelestialBody | null
  sky: boolean
}

export interface Universe {
  star: StarInfo
  starPos: THREE.Vector3
  bodies: CelestialBody[]
  belt?: BeltInfo
  entries: RegisterEntry[]
  update(timeSec: number): void
  dispose(): void
}

export interface FlightModelLike {
  pos: THREE.Vector3
  vel: THREE.Vector3
  quat: THREE.Quaternion
  angVel: THREE.Vector3
  faOn: boolean
  boosting: boolean
  supercruise: boolean
  heat: number
  speed: number
  update(dt: number, input: InputState): void
}

export interface SupercruiseLike {
  active: boolean
  update(dt: number, ship: FlightModelLike, input: InputState): void
  speedLabel(): string
  fovMultiplier(): number
  currentSpeed(): number
  wellFactor(): number
}

export interface HyperspaceLike {
  phase: 'idle' | 'charging' | 'tunnel' | 'flash' | 'arrived'
  progress: number
  update(dt: number): void
  trigger(): void
  onArrive: (seed: number) => void
}

export interface HUDLike {
  draw(state: HUDState): void
  dispose(): void
}

export interface TargetInfo {
  name: string
  type: string
  distM: number
  ndcX: number | null
  ndcY: number | null
  radiusM: number
  relBearing: number
  relElev: number
}

export interface HUDState {
  speed: number
  throttlePct: number
  targetSpeedLabel: string
  faOn: boolean
  boosting: boolean
  heat: number
  fuel: number
  supercruise: boolean
  scLabel: string
  jumpPhase: HyperspaceLike['phase']
  jumpProgress: number
  nearestName: string
  nearestDistM: number
  altitudeM: number | null
  targets: TargetInfo[]
  progradeLocal: THREE.Vector3 | null
  retrogradeLocal: THREE.Vector3 | null
  headingDeg: number
}
