import * as THREE from 'three'
import { Game } from './engine/game'
import { FlightModel } from './physics/flightModel'
import { generateSystem } from './universe/generator'
import { buildSkybox } from './universe/skybox'
import { buildCockpit } from './ship/cockpit'
import { HUD } from './ship/hud'
import { SupercruiseController } from './fx/supercruise'
import { HyperspaceFX } from './fx/hyperspaceFX'
import type { Universe, CelestialBody } from './engine/types'

const params = new URLSearchParams(location.search)
const sceneName = params.get('scene') ?? 'start'
let seed = Number(params.get('seed') ?? '1337')
const noSky = params.get('nosky') === '1'
const noCockpit = params.get('nocockpit') === '1'

const container = document.getElementById('app')!
const game = new Game(container)
if (params.get('nocomposer') === '1') game.rs.bypassPost = true

const fm = new FlightModel()
game.ship = fm

function attachUniverse(u: Universe): void {
  for (const e of u.entries) game.rs.scene.add(e.obj)
  game.universe = u
}

function detachUniverse(u: Universe): void {
  for (const e of u.entries) {
    game.rs.scene.remove(e.obj)
    e.obj.traverse(o => {
      const rt = o.userData?.cubeRT as { dispose(): void } | undefined
      if (rt) rt.dispose()
    })
  }
  u.dispose()
}

function pickBody(u: Universe, types: string[]): CelestialBody {
  for (const t of types) {
    const b = u.bodies.find(p => p.type === t)
    if (b) return b
  }
  return u.bodies[Math.min(1, u.bodies.length - 1)]
}

function orientShip(eye: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3): void {
  const m = new THREE.Matrix4().lookAt(eye, target, up)
  fm.quat.setFromRotationMatrix(m)
  fm.pos.copy(eye)
}

function placeStartScene(u: Universe): void {
  const body = pickBody(u, ['earthlike', 'water', 'rocky'])
  const starDir = u.starPos.clone().sub(body.pos).normalize()
  const tangent = new THREE.Vector3().crossVectors(starDir, new THREE.Vector3(0, 1, 0)).normalize()
  const eye = body.pos.clone()
    .addScaledVector(starDir, body.radiusM * 1.55)
    .addScaledVector(tangent, body.radiusM * 1.05)
  const up = eye.clone().sub(body.pos).normalize()
  const surfN = new THREE.Vector3()
    .addScaledVector(tangent, .92)
    .addScaledVector(up, -.42)
    .normalize()
  const target = body.pos.clone().addScaledVector(surfN, body.radiusM)
  orientShip(eye, target, up)
  fm.vel.copy(tangent).multiplyScalar(40)
}

function placeRingsScene(u: Universe): void {
  const gas = u.bodies.find(b => b.hasRings) ?? u.bodies.find(b => b.type === 'gas') ?? u.bodies[0]
  const starToPlanet = gas.pos.clone().sub(u.starPos).normalize()
  let rotAxis = new THREE.Vector3().crossVectors(starToPlanet, new THREE.Vector3(0, 1, 0))
  if (rotAxis.lengthSq() < 1e-6) rotAxis = new THREE.Vector3().crossVectors(starToPlanet, new THREE.Vector3(1, 0, 0))
  rotAxis.normalize()
  const viewDir = starToPlanet.clone().applyAxisAngle(rotAxis, 2.4).normalize()
  const eye = gas.pos.clone().addScaledVector(viewDir, gas.ringOuterM * 1.38)
  eye.y += gas.ringOuterM * .16
  orientShip(eye, gas.pos.clone(), new THREE.Vector3(0, 1, 0))
  fm.vel.set(0, 0, 0)
}

function placeSCScene(u: Universe): void {
  const dir = new THREE.Vector3(.6, .18, .75).normalize()
  const eye = u.starPos.clone().addScaledVector(dir, 8e10)
  const up = Math.abs(dir.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  orientShip(eye, u.starPos.clone(), up)
  fm.vel.set(0, 0, 0)
  if (game.sc) {
    game.sc.active = true
    fm.supercruise = true
  }
  game.throttleLevel = .85
}

function placeCockpitScene(u: Universe): void {
  const body = pickBody(u, ['earthlike', 'water', 'rocky'])
  const starDir = u.starPos.clone().sub(body.pos).normalize()
  const offDir = starDir.clone().applyAxisAngle(new THREE.Vector3(.3, 1, .2).normalize(), 1.15).normalize()
  const eye = body.pos.clone().addScaledVector(offDir, body.radiusM * 1.28)
  const up = eye.clone().sub(body.pos).normalize()
  const tangent = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize()
  const surfN = new THREE.Vector3()
    .addScaledVector(tangent, .88)
    .addScaledVector(up, -.34)
    .normalize()
  const target = body.pos.clone().addScaledVector(surfN, body.radiusM)
  orientShip(eye, target, up)
  fm.vel.set(0, 0, 0)
}

attachUniverse(generateSystem(seed))
game.universe!.update(0)
if (!noSky) {
  const sky = buildSkybox(seed, game.rs.renderer)
  game.universe!.entries.push({ obj: sky, body: null, sky: true })
  game.rs.scene.add(sky)
}

if (!noCockpit) game.rs.camera.add(buildCockpit(game.rs.camera))
if (!noCockpit) game.hud = new HUD(game.rs.camera)

const accCache = { starPos: new THREE.Vector3(), starRadiusM: 0, bodies: [] as { pos: THREE.Vector3; radiusM: number }[] }
const universeAccessor = () => {
  const u = game.universe!
  accCache.starPos = u.starPos
  accCache.starRadiusM = u.star.radiusM
  if (accCache.bodies.length !== u.bodies.length) accCache.bodies = u.bodies.map(b => ({ pos: b.pos, radiusM: b.radiusM }))
  else for (let i = 0; i < u.bodies.length; i++) { accCache.bodies[i].pos = u.bodies[i].pos; accCache.bodies[i].radiusM = u.bodies[i].radiusM }
  return accCache
}
const sc = new SupercruiseController(game.rs.camera, universeAccessor)
game.sc = sc

const fx = new HyperspaceFX(game.rs.camera)
game.fx = fx
fx.onArrive = (newSeed: number) => {
  const old = game.universe!
  detachUniverse(old)
  seed = newSeed
  const fresh = generateSystem(newSeed)
  const sky = buildSkybox(newSeed, game.rs.renderer)
  fresh.entries.push({ obj: sky, body: null, sky: true })
  game.rs.scene.add(sky)
  attachUniverse(fresh)
  fresh.update(0)
  placeStartScene(fresh)
}

switch (sceneName) {
  case 'rings': placeRingsScene(game.universe!); break
  case 'sc': placeSCScene(game.universe!); break
  case 'cockpit': placeCockpitScene(game.universe!); break
  case 'jump':
    placeStartScene(game.universe!)
    fx.trigger()
    break
  default: placeStartScene(game.universe!)
}

const boot = document.getElementById('boot')
requestAnimationFrame(() => requestAnimationFrame(() => {
  if (boot) {
    boot.style.opacity = '0'
    setTimeout(() => boot.remove(), 950)
  }
}))

game.start()

;(window as unknown as Record<string, unknown>).__fs = { game, THREE }
