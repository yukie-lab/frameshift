import * as THREE from 'three'
import type { Universe, StarInfo, CelestialBody, RegisterEntry, OrbitElements } from '../engine/types'
import { createStarMesh } from '../render/starMaterial'
import { createPlanetMesh } from '../render/planetMaterial'
import { createRing } from '../render/rings'

const AU = 1.495978707e11
const GM_SUN = 1.32712440018e20

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function keplerPos(orbit: OrbitElements, tSec: number, out: THREE.Vector3): void {
  const n = (2 * Math.PI) / orbit.periodSec
  const M = orbit.phase + n * tSec
  let E = M
  for (let i = 0; i < 6; i++) {
    E = E - (E - orbit.e * Math.sin(E) - M) / (1 - orbit.e * Math.cos(E))
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + orbit.e) * Math.sin(E / 2), Math.sqrt(1 - orbit.e) * Math.cos(E / 2))
  const r = orbit.aAU * AU * (1 - orbit.e * Math.cos(E))
  const xp = r * Math.cos(nu)
  const yp = r * Math.sin(nu)
  const cw = Math.cos(orbit.argP), sw = Math.sin(orbit.argP)
  const x1 = xp * cw - yp * sw
  const y1 = xp * sw + yp * cw
  const ci = Math.cos(orbit.incl), si = Math.sin(orbit.incl)
  const x2 = x1
  const y2 = y1 * ci
  const z2 = y1 * si
  const cn = Math.cos(orbit.node), sn = Math.sin(orbit.node)
  out.set(x2 * cn + z2 * sn, y2, -x2 * sn + z2 * cn)
}

const SYL_A = ['Ker', 'Ach', 'Vor', 'Tal', 'Eri', 'Nym', 'Dra', 'Cal', 'Bel', 'Ori', 'Sol', 'Umb', 'Tha', 'Ryn']
const SYL_B = ['ion', 'ara', 'eth', 'os', 'una', 'ir', 'ax', 'ea', 'ym', 'or']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

export function generateSystem(seed: number): Universe {
  const rand = mulberry32(seed)
  const entries: RegisterEntry[] = []
  const bodies: CelestialBody[] = []

  const classRoll = rand()
  const cls = classRoll < .15 ? 'F' : classRoll < .65 ? 'G' : 'K'
  const starInfo: Record<string, { tempK: number; radiusM: number; color: number }> = {
    F: { tempK: 6500, radiusM: 9.04e8, color: 0xcad8ff },
    G: { tempK: 5772, radiusM: 6.957e8, color: 0xfff2dd },
    K: { tempK: 4500, radiusM: 5.2e8, color: 0xffc98a }
  }
  const si = starInfo[cls]
  const starName = SYL_A[Math.floor(rand() * SYL_A.length)] + SYL_B[Math.floor(rand() * SYL_B.length)]
  const star: StarInfo = {
    name: starName,
    cls,
    tempK: si.tempK,
    radiusM: si.radiusM,
    color: new THREE.Color(si.color),
    luminosity: 1
  }

  const count = 6 + Math.floor(rand() * 4)
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? .5 : i / (count - 1)
    const aAU = Math.exp(Math.log(.4) + (Math.log(40) - Math.log(.4)) * f + (rand() - .5) * .18)
    const e = rand() * .12
    const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(aAU * AU, 3) / GM_SUN)
    let type: CelestialBody['type']
    if (aAU < .8) type = rand() < .55 ? 'lava' : 'rocky'
    else if (aAU < 2.4) {
      const r = rand()
      type = r < .45 ? 'earthlike' : r < .7 ? 'water' : 'rocky'
    } else if (aAU < 3.6) type = 'rocky'
    else if (aAU < 15) type = 'gas'
    else type = rand() < .8 ? 'ice' : 'gas'

    let radiusM: number
    if (type === 'gas') radiusM = 2.5e7 + rand() * 5.5e7
    else if (type === 'earthlike') radiusM = 6e6 + rand() * .8e6
    else if (type === 'water') radiusM = 5.5e6 + rand() * .7e6
    else if (type === 'ice') radiusM = 2e6 + rand() * 2e6
    else radiusM = 2.5e6 + rand() * 4.2e6

    const body: CelestialBody = {
      name: `${starName} ${ROMAN[i]}`,
      type,
      radiusM,
      pos: new THREE.Vector3(),
      orbit: {
        aAU, e,
        incl: rand() * .07,
        node: rand() * Math.PI * 2,
        argP: rand() * Math.PI * 2,
        periodSec,
        phase: rand() * Math.PI * 2
      },
      spinPeriodSec: 20000 + rand() * 100000,
      axialTilt: (rand() - .5) * .8,
      hasRings: type === 'gas' && rand() < .45,
      ringInnerM: radiusM * 1.4,
      ringOuterM: radiusM * 2.4,
      cloudDensity: type === 'earthlike' ? .55 : type === 'water' ? .85 : type === 'gas' ? .4 : undefined,
      moons: [],
      mesh: undefined
    }
    bodies.push(body)
  }

  const gasIdx = bodies.findIndex(b => b.type === 'gas')
  if (gasIdx === -1) {
    const b = bodies[bodies.length - 1]
    b.type = 'gas'
    b.radiusM = 3e7 + rand() * 4e7
    b.ringInnerM = b.radiusM * 1.4
    b.ringOuterM = b.radiusM * 2.4
    b.cloudDensity = .4
  }
  if (!bodies.some(b => b.hasRings)) {
    const g = bodies.filter(b => b.type === 'gas')
    if (g.length > 0) g[Math.floor(rand() * g.length)].hasRings = true
  }

  for (const body of bodies) {
    if (rand() < .4 && body.type !== 'lava') {
      const moonCount = 1 + Math.floor(rand() * 4)
      for (let m = 0; m < moonCount; m++) {
        const mr = (8e5 + rand() * 2.2e6)
        const aM = body.radiusM * (4 + rand() * 26)
        const suffix = String.fromCharCode(97 + m)
        body.moons.push({
          name: `${body.name} ${suffix}`,
          type: rand() < .3 ? 'ice' : 'rocky',
          radiusM: mr,
          pos: new THREE.Vector3(),
          orbit: {
            aAU: aM / AU,
            e: rand() * .05,
            incl: rand() * .2,
            node: rand() * Math.PI * 2,
            argP: rand() * Math.PI * 2,
            periodSec: 2 * Math.PI * Math.sqrt(Math.pow(aM, 3) / GM_SUN),
            phase: rand() * Math.PI * 2
          },
          spinPeriodSec: 50000 + rand() * 90000,
          axialTilt: (rand() - .5) * .5,
          hasRings: false,
          ringInnerM: 0,
          ringOuterM: 0,
          moons: [],
          mesh: undefined
        })
      }
    }
  }

  const starGroup = createStarMesh(star)
  entries.push({ obj: starGroup, body: null, sky: false })

  for (const body of bodies) {
    const group = createPlanetMesh(body, rand, star.color)
    if (body.hasRings) group.add(createRing(body))
    entries.push({ obj: group, body, sky: false })
    if (body.moons.length > 0) {
      for (const moon of body.moons) {
        const mg = createPlanetMesh(moon, rand, star.color)
        entries.push({ obj: mg, body: moon, sky: false })
      }
    }
  }

  const beltIdx = Math.min(bodies.length - 2, 2 + Math.floor(rand() * (bodies.length - 3)))
  const beltInner = bodies[beltIdx].orbit.aAU * AU * 1.18
  const beltOuter = bodies[beltIdx + 1].orbit.aAU * AU * .82
  const rockGeo = new THREE.DodecahedronGeometry(1, 0)
  const rp = rockGeo.attributes.position as THREE.BufferAttribute
  for (let v = 0; v < rp.count; v++) {
    const s = .75 + Math.random() * .5
    rp.setXYZ(v, rp.getX(v) * s, rp.getY(v) * s, rp.getZ(v) * s)
  }
  rp.needsUpdate = true
  rockGeo.computeVertexNormals()
  const beltCount = 1500
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, roughness: .95, metalness: .05 })
  const beltMesh = new THREE.InstancedMesh(rockGeo, beltMat, beltCount)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const eu = new THREE.Euler()
  const sc = new THREE.Vector3()
  for (let k = 0; k < beltCount; k++) {
    const ang = rand() * Math.PI * 2
    const rad = beltInner + rand() * (beltOuter - beltInner)
    const size = 5e2 + Math.pow(rand(), 2.2) * 3e3
    sc.set(size, size * (.7 + rand() * .6), size * (.7 + rand() * .6))
    eu.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)
    q.setFromEuler(eu)
    m4.compose(new THREE.Vector3(Math.cos(ang) * rad, (rand() - .5) * beltOuter * .05, Math.sin(ang) * rad), q, sc)
    beltMesh.setMatrixAt(k, m4)
  }
  beltMesh.instanceMatrix.needsUpdate = true
  entries.push({ obj: beltMesh, body: null, sky: false })

  const lastT = { value: 0 }

  function update(timeSec: number): void {
    const dt = Math.max(0, timeSec - lastT.value)
    lastT.value = timeSec
    for (const body of bodies) {
      keplerPos(body.orbit, timeSec, body.pos)
      for (const moon of body.moons) {
        keplerPos(moon.orbit, timeSec, moon.pos)
        moon.pos.add(body.pos)
      }
    }
    const spinAll = (b: CelestialBody) => {
      if (b.mesh) b.mesh.rotation.y += (dt * 2 * Math.PI) / b.spinPeriodSec
      if (b.cloudMesh) b.cloudMesh.rotation.y += (dt * 2 * Math.PI * 1.3) / b.spinPeriodSec
      for (const m of b.moons) spinAll(m)
    }
    for (const b of bodies) spinAll(b)
  }

  function disposeMaterial(mat: THREE.Material): void {
    for (const key of Object.keys(mat) as (keyof THREE.Material)[]) {
      const v = (mat as unknown as Record<string, unknown>)[key as string]
      if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
    }
    const uniforms = (mat as THREE.ShaderMaterial).uniforms
    if (uniforms) {
      for (const u of Object.values(uniforms)) {
        const v = u.value as THREE.Texture | undefined
        if (v && v.isTexture) v.dispose()
      }
    }
    mat.dispose()
  }

  function dispose(): void {
    for (const e of entries) {
      e.obj.traverse(o => {
        const rt = o.userData?.cubeRT as { dispose(): void } | undefined
        if (rt) rt.dispose()
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(disposeMaterial)
        else if (mat) disposeMaterial(mat)
      })
    }
    entries.length = 0
  }

  return {
    star,
    starPos: new THREE.Vector3(),
    bodies,
    belt: { innerM: beltInner, outerM: beltOuter, count: beltCount },
    entries,
    update,
    dispose
  }
}
