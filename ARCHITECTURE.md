# FRAMESHIFT — Architecture Contract v1 (FROZEN)

Elite Dangerous-class space flight simulator. Three.js + TypeScript + Vite. Strict TS (`tsc --noEmit` must pass at integration).
Physics first: real orbital mechanics, TRUE stellar scale, Newtonian inertia. Beauty within those constraints.

## Hard rules
- Right-handed coords, Y-up, METERS. Absolute world positions are plain JS doubles (safe to 2^53 m).
- Camera-relative rendering: `Game.syncScene()` re-bases every registered Object3D each frame. NEVER parent space objects to each other or set their scene positions yourself. Register via `Universe.entries` and update `body.pos` in `update()`.
- Only edit files you own (ownership map below). Shared contracts here are FROZEN. If you deviate, you MUST report the deviation.
- Do NOT run `npm install`, `tsc` on the whole project, or vite build — other agents work in parallel and node_modules may not exist yet. Write careful, strict-TS-clean code. You MAY create a scratch file under `/tmp` if you need to sanity-check syntax.
- NO code comments unless truly essential. No TODOs. Complete, production-quality implementations only — no stubs, no placeholder gradients, nothing "good enough".
- Quality bar: side-by-side with Elite Dangerous. If a detail looks cheap, redo it.

## Palette / style
- HUD orange `#ff8c2a`, cyan accent `#35d6ff`, warning red `#ff3b30`. Panels rgba(8,12,16,.55), 1px chamfered strokes, subtle scanlines only on HUD glass.
- ACESFilmic exposure 1.05, bloom threshold .82 strength .85 radius .6 (already configured).

## Controls (document these in HUD help card)
W/S pitch down/up · A/D yaw · Q/E roll · Shift throttle up · Z throttle down · ←/→ lateral thrust · ↑/↓ vertical thrust · Tab boost · X flight-assist toggle · J supercruise · Enter hyperspace jump · H help

## Ownership map
| Owner | Files |
|---|---|
| lead | src/engine/*, src/main.ts, index.html, package.json, scripts/* |
| agent-physics | src/physics/flightModel.ts |
| agent-universe | src/universe/generator.ts, src/universe/skybox.ts |
| agent-planets | src/render/planetMaterial.ts, src/render/rings.ts, src/render/starMaterial.ts |
| agent-cockpit | src/ship/cockpit.ts, src/ship/hud.ts |
| agent-sc | src/fx/supercruise.ts, src/fx/hyperspaceFX.ts |

## Frozen types (src/engine/types.ts — read it; do NOT modify)
`InputState, StarInfo, BodyType, OrbitElements, CelestialBody, BeltInfo, RegisterEntry, Universe, FlightModelLike, SupercruiseLike, HyperspaceLike, TargetInfo, HUDState`

## Module contracts

### agent-physics → `src/physics/flightModel.ts`
```ts
export class FlightModel implements FlightModelLike {
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); quat = new THREE.Quaternion()
  angVel = new THREE.Vector3() // LOCAL rad/s [x pitch, y yaw, z roll]
  faOn = true; boosting = false; supercruise = false; heat = 0
  get speed(): number
  update(dt: number, input: InputState): void // when this.supercruise === true, return immediately (SC controller drives ship)
}
```
ED small-ship feel, tuned constants (expose as public readonly): maxSpeed=450 m/s, boostSpeed=900, FA-on accel response τ≈0.55s exponential approach per axis; rotation rates pitch 1.6, yaw 1.15, roll 2.3 rad/s with smoothing k≈9 (rate ramps toward commanded rate); FA OFF: pure Newtonian — thrust adds accel 60 m/s² along local axes (forward*throttle + right*lateral + up*vertical), rotation integrates angVel with zero damping, velocity persists (drift). Boost: rising edge of input.boost starts 3s burn: accel×4, speed cap boostSpeed, heat += fast toward 0.85 then cools (heat decays 0.08/s). Heat clamp 0..1. Deterministic. FA ON behavior: commanded velocity = thrustDir * |throttleInput| * maxSpeed where thrustDir combines forward(throttle)+lateral+vertical; when no thrust input, command = zero vector (auto-brake). Rotation identical in both modes but FA-on damps angVel to commanded rate.

### agent-universe → `src/universe/generator.ts`, `src/universe/skybox.ts`
```ts
export function generateSystem(seed: number): Universe
export function buildSkybox(seed: number): THREE.Object3D // register with sky:true entries
```
6–9 planets, log-spaced semi-major axes 0.4–40 AU, e∈[0,.15], incl ≤4°, Kepler solved EXACTLY each frame: M→E via Newton–Raphson (≥5 iters) → true anomaly → position in orbital plane → rotate by Ω,i,ω. G2V star default (radiusM=6.957e8, tempK=5772). Planet radii REAL scale (Earth 6.371e6 m, gas giants ~7e7 m). Periods via Kepler's third law (real seconds). Types distributed sensibly vs distance (inner rocky/lava, habitable zone earthlike/water chance, outer gas/ice). 40% of planets have moons (1–4, orbiting parent, moon.pos ABSOLUTE after update). One asteroid belt between two adjacent planets: InstancedMesh ~1500 rocks (dodecahedron/icosahedron deformed variants, standard material roughness .95), pseudo-body entry so Game syncs it centered on starPos. Spin: rotate planet meshes by spinPeriodSec (register tilted group, spin inner mesh; store mesh refs on body.mesh/body.cloudMesh). Star mesh + belt + all planet meshes go into entries (body set; star/belt body:null, sky:false). Skybox: ≥80,000 point stars (sizeAttenuation:false, varied color temp + brightness, few bright w/ tiny cross-flare sprites), Milky Way band (soft additive canvas-generated texture strip, tilted), 2–3 large nebula sprites (procedural radial noise canvas textures, additive, very low opacity, hue-varied). Sky object is camera-centered by Game; build it around origin with huge radius (e.g. 1e12) — never move it yourself.

### agent-planets → `src/render/planetMaterial.ts`, `src/render/rings.ts`, `src/render/starMaterial.ts`
```ts
export function createPlanetMesh(body: CelestialBody, star: StarInfo, rand: () => number): THREE.Group
export function createRing(body: CelestialBody, star: StarInfo): THREE.Mesh
export function createStarMesh(star: StarInfo, rand?: () => number): THREE.Group
```
TRUE SCALE meters. All custom ShaderMaterials. Lighting self-contained: each mesh's `onBeforeRender` computes uLightDir = normalize(starPos − body.pos) from closures (star pos is star-relative-to-camera? NO — use body.pos minus... CAREFUL: meshes are re-based each frame by Game; compute light dir from WORLD data not object transforms: closure over body & universe star position getter is impossible — instead export `updateSpaceLighting(starRelDir: THREE.Vector3)` module-level function that Game calls? Game does NOT know about your module. SOLUTION: store per-material uniforms and update them inside onBeforeRender using `body.pos.clone().sub(camera.position...)` — WRONG because camera at origin-ish. Correct approach: onBeforeRender(renderer, scene, camera) gives camera whose position ≈ (0,0,0) in render space and body.pos is ABSOLUTE while mesh.position is relative — so uLightDirWorld = normalize(body.pos - star.pos) computed in WORLD space is CONSTANT regardless of camera. Compute once at creation + refresh cheaply each onBeforeRender (positions change slowly). Lighting dir uniform = normalize(starPos - bodyPos) in world; since shader works in view space, transform: `(viewMatrix * vec4(uLightDirWorld,0)).xyz`. Use that.)
- Rocky: fbm(6 octaves) cratered/albedo variation, normal perturbation from height derivative, terminator softness, slight specular.
- Earthlike: continents (fbm threshold), ocean specular + deep/shallow coloring, ice caps by latitude+noise, faint night-side city lights near coasts (emissive speckle), cloud sphere r×1.013 (alpha fbm animated slow rotation, density from body.cloudDensity).
- Water: ocean world, heavy clouds, high specular.
- Gas giant: banded palette (latitude domain-warped turbulence, 8–14 bands from rand), optional storm vortex oval, limb darkening.
- Ice: bright blue-white fractured cracks pattern.
- Lava: dark basalt crust + emissive crack veins (bloom feeds on these), heat shimmer glow near terminator.
- ALL: atmosphere shell r×1.045 BackSide additive fresnel scattering tinted atmoColor (earthlike pale blue, gas varies, lava dim orange haze), brighter on lit limb, subtle forward-scatter toward star.
- Rings: annulus (ringInnerM..ringOuterM) shader: hundreds of radial noise bands + 2–3 Cassini-style gaps, alpha varies, unlit-side darkening, PLANET SHADOW projected analytically (cylinder test against light dir) with soft penumbra, back-scatter brightening when viewing lit face. DoubleSide.
- Star: core sphere with animated granulation fbm (color by tempK blackbody), limb darkening; corona = 2–3 billboard layers additive radial falloff + animated flare noise; subtle pulsation. Must look BREATHTAKING with bloom.

### agent-cockpit → `src/ship/cockpit.ts`, `src/ship/hud.ts`
```ts
export function buildCockpit(camera: THREE.PerspectiveCamera): THREE.Group // caller adds to camera
export class HUD {
  constructor(camera: THREE.PerspectiveCamera)
  draw(state: HUDState): void   // call every frame; internally throttles canvas redraws to ~30fps
  dispose(): void
}
```
Cockpit (child of camera): Elite-grade interior — canopy struts/beams (beveled, chamfered), slim A-pillars angled for max visibility like ED Sidewinder/Cobra hybrid, dashboard trapezoid console below view with emissive button strips + two small screens (static emissive textures ok), side consoles, ceiling panel lines with thin emissive strips, floor edge visible at bottom. Materials: MeshStandardMaterial graphite #16181d metalness .85 roughness .35; emissive accents orange/cyan LOW intensity (they bloom); canopy glass MeshPhysicalMaterial transparent opacity .10-.14 roughness .04 slight cyan tint envMapIntensity 1.4 + procedural scratch/smudge normal map from canvas. Geometry from primitives but DENSELY detailed (greebles, vents, bolts via small boxes/cylinders instanced). Nothing intersects camera near plane 0.05.
HUD: curved plane(s) ~0.65m ahead, CanvasTexture 2048×1024, ED visual language EXACTLY: center reticle + off-axis prograde marker (circle+cross w/ 3 spokes when progradeLocal on screen), speed box left-of-center (m/s below 1000, else km/s), heading tape top, FA lamp (green ORANGE text style), fuel/heat bars bottom-left chamfered, target panel right (name/type/dist auto units km/Mm/AU/Ls), 3D radar top-center hex grid: bodies as dots sized ∝ log radius, stems showing vertical offset, sweep line rotating, range rings labeled; SC mode swaps center cluster to SC speed readout (scLabel big) + gravity-well bar; jump overlay: charge ring around reticle during charging, tunnel vignette handled elsewhere. Draw crisp: 2px lines, glow via shadowBlur sparingly, chamfered corner paths everywhere, font 'Segoe UI'/monospace mix. Include help card (toggle H → state.jumpPhase unused; add helpVisible flag internally listening keydown H itself is fine BUT game owns H edge… simplest: HUD listens to window keydown for KeyH itself and toggles its own help overlay showing controls list above).

### agent-sc → `src/fx/supercruise.ts`, `src/fx/hyperspaceFX.ts`
```ts
export class SupercruiseController implements SupercruiseLike {
  active = false
  constructor(universe: () => { starPos: THREE.Vector3; starRadiusM: number; bodies: { pos: THREE.Vector3; radiusM: number }[] }) // lazy accessor fn
  update(dt, ship, input): void
  speedLabel(): string // '450 km/s' … '12.4 kc'
  fovMultiplier(): number // 1..1.18 eased with speed
  currentSpeed(): number
  wellFactor(): number // 0..1 how deep in gravity well (for HUD)
}
export class HyperspaceFX implements HyperspaceLike {
  phase: 'idle'|'charging'|'tunnel'|'flash'|'arrived' = 'idle'; progress = 0
  onArrive: (seed:number)=>void = () => {}
  trigger(): void; update(dt): void
  constructor(camera: THREE.PerspectiveCamera)
}
```
Supercruise: steering = same rotation model as FA-on (pitch/yaw/roll input rotates ship.quat, smoothed). Speed: throttle maps exponentially 30 km/s → 2001·c; gravity wells: for each body compute cap = smoothstep(dist/radius between 6r→1.5r) mapping max allowed speed from full down to ~5 km/s escape crawl; effective speed approaches min(commanded, cap) quickly (τ .8s) — creates ED's iconic "gravity brake". Advance ship.pos along ship forward × speed × dt. Star streaks: LineSegments ~500 segments in shell around camera (radius 50–400m), stretched along velocity dir ∝ speed, additive white-blue alpha .25, recycled when behind; visible only when active; intensity scales with speed. FOV multiplier eased.
Hyperspace: charging 3s (HUD shows progress via phase), then tunnel 5s: fullscreen shader quad attached to camera (renderOrder high, depthTest false): polar streak tunnel — thousands of anisotropic streaks flowing inward, chromatic aberration RGB split growing, core white-out increasing, hue shift teal→violet→white, subtle rolling distortion; flash 0.4s pure white quad fade; then onArrive(newSeed) fired once (seed = (Date.now()%100000)|0) and brief arrival particle burst + speed dump effect 1s ('arrived'), then idle. During tunnel also stretch existing star streak field hard (do via own particles independent of SC). MUST be spectacular.

## Integration notes (lead)
main.ts wires: boot fade → generateSystem(1337) → FlightModel spawn 25,000 km above chosen earthlike/rocky planet facing horizon → cockpit+HUD attach → sc, fx (fx.onArrive replaces universe + repositions) → Game.start(). URL ?scene=start|rings|sc|jump|cockpit&seed=N QA presets. Screenshot harness: scripts/screenshot.mjs (puppeteer-core + system Chrome) → shots/*.png.

---

# v2 — Quality pass (deviations from the frozen contract, as required)

The v1 contract above is left intact for reference. The following changes were made during the
quality pass; each one deviates from the frozen text and is reported here.

## Signature changes
| Contract (v1) | Actual (v2) | Why |
|---|---|---|
| `createPlanetMesh(body, star, rand)` | `createPlanetMesh(body, rand, starTint?)` | The shader only needs the star's colour, not the whole `StarInfo`. `starTint` is blended 45% toward white and drives `uSunColor` on the surface/cloud/atmosphere materials. |
| `createRing(body, star)` | `createRing(body)` | Ring illumination is derived from `body.pos` (star is at the origin); no `StarInfo` needed. |
| `createStarMesh(star, rand?)` | `createStarMesh(star)` | Variation is derived deterministically from `star.tempK`. |
| `buildSkybox(seed)` | `buildSkybox(seed, renderer?)` | The galaxy is baked to a cubemap once at build time (see below). Without a renderer it falls back to evaluating the procedural shader every frame. |

## Rendering changes

**Skybox.** The v1 canvas-texture Milky Way band on a `DoubleSide` sphere produced hard latitude
seams and a flat grey wash, and the 28 bright-star sprites read as grey discs. Replaced with:
- a procedural galaxy fragment shader (galactic-plane density, spiral filaments, dust lanes,
  H-alpha / reflection / O-III emission regions, star grain) evaluated **once** into a
  1024² `WebGLCubeRenderTarget`, then sampled by a cheap `samplerCube` lookup each frame;
- 3 `Points` layers (~80k stars) with a plane-biased spatial distribution and blackbody colours;
- 34 bright stars as small sprites (~0.4° across) with 8-point diffraction spikes.
- `group.userData.galacticPlaneN` / `.galacticCoreDir` expose the orientation for QA framing.

The bake is the single largest performance win in the project: full-screen procedural noise cost
~38 simplex evaluations per pixel per frame.

**Atmospheres.** The fixed `r×1.045` back-side fresnel shell produced a uniform outline ring around
every body, including airless ones. Replaced with an analytic single-scattering shell
(`FrontSide`, additive): the view ray's impact parameter and chord through the shell are computed
in units of planet radii (numerically stable at 1e11 m world coordinates), optical depth uses an
exponential altitude profile, and illumination is sampled at the actual surface point for rays that
hit the body. Rayleigh phase + Mie forward lobe + a separate sunset term. Shell radius is per type
(earthlike 1.028 … gas 1.045); **rocky and ice bodies get no atmosphere at all**.

**Planet surfaces.** Added a cellular `craterField` (8-cell neighbourhood, radius-bounded so it is
exact) plus derivative-based bump normals (`dFdx`/`dFdy`, faded out at grazing angles to avoid
silhouette artefacts). Gas-giant band turbulence was reduced ~5× (v1's warp amplitude exceeded the
latitude range and destroyed the bands). Terminators use a soft `smoothstep` wrap; night sides get a
small starlight ambient instead of pure black.

**Rings.** World-space ring normal (v1 used the local `(0,1,0)`, which is wrong for a tilted ring).
Density is now additive across 4 ringlet octaves with `fwidth`-based LOD, with three named
divisions; lighting uses transmittance `exp(-τ/|cos i|)` split into back-scatter (same side as the
sun) and forward-scatter (opposite side), with a soft-penumbra planet shadow.

**Star.** The canvas corona (90 random radial strokes, visible as hard spokes) was replaced with a
billboarded shader corona: ridged-noise filaments in polar space, chromosphere ring, prominences,
plus a separate wide glow billboard. The photosphere gained convection granulation, sunspots,
faculae and a physical limb-darkening curve.

**Hyperspace tunnel.** The v1 `fract()`-based streaks produced hard rectangular blocks. Replaced
with wrap-safe value noise in (angle, log r) space at three octaves, per-channel radial offset for
chromatic aberration, swirl, and a hot core added after the shear modulation.

**Post.** `UnrealBloomPass` now runs at half resolution (strength .62, radius .62, threshold 1.02).

## Bug fixes
- **Supercruise streaks (`fx/supercruise.ts`).** Anchors were stored as *absolute* world positions
  in a `Float32Array`. At ~1e11 m the float32 quantum is ~8 km, so `anchor - shipPos` collapsed to
  zero and every streak rendered on top of the camera. The field is now maintained in a
  ship-relative frame and advanced by a log-compressed virtual flow speed.
- **`main.ts` universe accessor** no longer allocates an array of body wrappers every frame.
- **`generator.dispose()`** now disposes textures and baked cube render targets. Verified stable
  over 5 consecutive hyperspace jumps (`npm run jumptest`): geometry and texture counts flat.

## QA tooling (`scripts/`)
| Command | What it does |
|---|---|
| `npm run shot` | 5 preset scenes → `shots/*.png` |
| `npm run survey` | 11 framings (star close/far, gas giant ± rings, each planet type, deep sky, galactic core, belt) → `shots/survey/*.png`. Env: `SEED`, `NOCOCKPIT=1`, `OUT`. |
| `npm run perf` | FPS + draw-call counts per scene. Accepts `a,b,c` scene list; `scene|flag=1` appends a URL flag. |
| `npm run jumptest` | 5 consecutive hyperspace jumps; reports console errors and GPU resource counts. |

The four above require `npm run dev` to be running.

| Command | What it does |
|---|---|
| `npm run build` | `tsc --noEmit` + vite build → `dist/` (`base` is `/frameshift/` for builds only) |
| `npm run pagescheck` | Serves `dist/` under `/frameshift/` from its own static server and asserts the renderer starts with no console errors. `URL=…` checks a deployed site instead. |
| `npm run deploy` | Build, then publish `dist/` to the `gh-pages` branch that GitHub Pages serves |

## Deployment

GitHub Pages serves the **`gh-pages` branch root**, not `main`. Serving `main` directly fails:
`index.html` references `/src/main.ts`, which browsers cannot execute, so the boot overlay never
clears. `index.html` now surfaces startup failures (uncaught errors, unhandled rejections, or no
canvas after 20s) as red text on the boot screen instead of hanging silently.

A `.github/workflows/pages.yml` that builds and deploys on every push to `main` is prepared but not
committed: pushing it needs a token with the `workflow` scope (`gh auth refresh -s workflow`).
Until then, `npm run deploy` is the publish path.
