import * as THREE from 'three'

const R = 9e11

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIMPLEX = `
vec3 mod289(vec3 x){return x - floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x - floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = 1./7.;
  vec3 ns = n_*D.wyz - D.xzx;
  vec4 j = p - 49.*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2. + 1.;
  vec4 s1 = floor(b1)*2. + 1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  m = m*m;
  return 42.*dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p, int oct){
  float f = 0.; float a = .5; float n = 0.;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    f += a*snoise(p); n += a; p = p*2.03 + vec3(7.31,4.17,9.73); a *= .5;
  }
  return f/max(n, 1e-5);
}
float ridged(vec3 p, int oct){
  float f = 0.; float a = .5; float n = 0.;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    f += a*(1.-abs(snoise(p))); n += a; p = p*2.11 + vec3(3.17,8.42,1.93); a *= .5;
  }
  return f/max(n, 1e-5);
}`

const GALAXY_VERT = `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`

const GALAXY_FRAG = `
precision highp float;
uniform vec3 uPlaneN;
uniform vec3 uCoreDir;
uniform vec3 uOff;
uniform float uBright;
varying vec3 vDir;
${SIMPLEX}

void main(){
  vec3 d = normalize(vDir);
  float y = dot(d, uPlaneN);
  float coreAng = acos(clamp(dot(d, uCoreDir), -1., 1.));

  float along = smoothstep(3.05, .18, coreAng);
  float halfWidth = .070 + .050*along;
  float disc = exp(-(y*y)/(halfWidth*halfWidth));
  float halo = exp(-(y*y)/.115) * .30;
  float bulge = exp(-pow(coreAng/.30, 2.0)) * exp(-(y*y)/.0125);

  vec3 fl = (d - uPlaneN*y) + uPlaneN*y*2.1;
  float n1 = fbm(fl*4.4 + uOff, 5)*.5 + .5;
  float n2 = fbm(fl*11.0 + uOff*1.9, 4)*.5 + .5;
  float n3 = ridged(fl*21.0 + uOff*.6, 3);
  float clump = clamp(n1*.62 + n2*.30 + n3*.34 - .18, 0., 1.);
  clump = pow(clump, 1.75);
  float knot = smoothstep(.60, .93, n1*.6 + n2*.55);

  float density = (disc*(.22 + 1.00*along) + halo*(.30 + .70*along)) * (.16 + 1.30*clump + .85*knot);
  density += bulge*(.80 + .50*clump)*1.10;

  float lane = smoothstep(.54, .92, ridged(fl*6.1 + uOff*1.7, 4));
  float laneFine = smoothstep(.50, .90, ridged(fl*14.5 - uOff*1.3, 3));
  float dustMask = exp(-(y*y)/(halfWidth*halfWidth*1.5)) * (.28 + .72*along);
  float dust = clamp(1. - dustMask*(lane*.90 + laneFine*.40), .04, 1.);

  float hue = fbm(fl*2.6 - uOff*2.2, 4)*.5 + .5;
  vec3 warm = vec3(1.00, .700, .420);
  vec3 mid  = vec3(.980, .900, .800);
  vec3 cool = vec3(.470, .640, 1.00);
  vec3 tint = mix(cool, mid, smoothstep(.24, .70, hue));
  tint = mix(tint, warm, clamp(bulge*1.15 + smoothstep(1.25, .15, coreAng)*.62, 0., 1.));

  vec3 col = tint * density * dust;

  float hA = smoothstep(.60, .95, fbm(fl*8.3 + uOff*2.3, 4)*.5+.5) * dustMask * (.25 + .75*along);
  col += vec3(1.00, .17, .24) * hA * hA * 2.10;
  float refl = smoothstep(.68, .97, fbm(fl*10.7 - uOff*1.1, 4)*.5+.5) * dustMask;
  col += vec3(.22, .42, 1.00) * refl * refl * 1.30;
  float oiii = smoothstep(.78, .99, fbm(fl*15.3 + uOff*3.7, 3)*.5+.5) * dustMask * along;
  col += vec3(.16, .95, .82) * oiii * oiii * 1.05;

  col *= .82 + .36*(fbm(d*300. + uOff, 2)*.5+.5);
  float micro = pow(clamp(fbm(d*680. + uOff*3.1, 2)*.5+.5, 0., 1.), 7.);
  col += tint * micro * density * 1.6;

  gl_FragColor = vec4(col * uBright, 1.);
}`

function starSpriteTexture(): THREE.CanvasTexture {
  const s = 256
  const h = s / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, s, s)
  ctx.globalCompositeOperation = 'lighter'

  const glow = ctx.createRadialGradient(h, h, 0, h, h, s * .46)
  glow.addColorStop(0, 'rgba(255,255,255,.55)')
  glow.addColorStop(.06, 'rgba(210,228,255,.20)')
  glow.addColorStop(.22, 'rgba(150,185,255,.05)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, s, s)

  for (const [dx, dy, len, wid] of [[1, 0, .48, 1.5], [-1, 0, .48, 1.5], [0, 1, .48, 1.5], [0, -1, .48, 1.5],
    [.707, .707, .19, .9], [-.707, .707, .19, .9], [.707, -.707, .19, .9], [-.707, -.707, .19, .9]] as const) {
    const fg = ctx.createLinearGradient(h, h, h + dx * s * len, h + dy * s * len)
    fg.addColorStop(0, 'rgba(255,255,255,.85)')
    fg.addColorStop(.12, 'rgba(220,235,255,.30)')
    fg.addColorStop(.45, 'rgba(170,200,255,.06)')
    fg.addColorStop(1, 'rgba(120,160,255,0)')
    ctx.strokeStyle = fg
    ctx.lineWidth = wid
    ctx.beginPath()
    ctx.moveTo(h, h)
    ctx.lineTo(h + dx * s * len, h + dy * s * len)
    ctx.stroke()
  }

  const core = ctx.createRadialGradient(h, h, 0, h, h, s * .055)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(.45, 'rgba(255,252,246,.75)')
  core.addColorStop(1, 'rgba(255,240,220,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, s, s)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const TEMP_STOPS: [number, number, number][] = [
  [.62, .72, 1.00],
  [.74, .82, 1.00],
  [.86, .90, 1.00],
  [1.00, .97, .93],
  [1.00, .90, .74],
  [1.00, .80, .58],
  [1.00, .68, .46]
]

function starColor(roll: number, out: THREE.Color): THREE.Color {
  const f = Math.pow(roll, 1.5) * (TEMP_STOPS.length - 1)
  const i = Math.min(TEMP_STOPS.length - 2, Math.floor(f))
  const t = f - i
  const a = TEMP_STOPS[i]
  const b = TEMP_STOPS[i + 1]
  return out.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

const BAKED_VERT = `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`

const BAKED_FRAG = `
precision highp float;
uniform samplerCube uMap;
varying vec3 vDir;
void main(){
  gl_FragColor = vec4(textureCube(uMap, normalize(vDir)).rgb, 1.);
}`

export function buildSkybox(seed: number, renderer?: THREE.WebGLRenderer): THREE.Group {
  const rand = mulberry32(seed ^ 0xBEEF)
  const group = new THREE.Group()

  const planeN = new THREE.Vector3(
    (rand() - .5) * .55, 1, (rand() - .5) * .55
  ).normalize()
  let coreDir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1)
  if (coreDir.lengthSq() < 1e-6) coreDir.set(1, 0, 0)
  coreDir.addScaledVector(planeN, -coreDir.dot(planeN)).normalize()

  const galaxyMat = new THREE.ShaderMaterial({
    uniforms: {
      uPlaneN: { value: planeN },
      uCoreDir: { value: coreDir },
      uOff: { value: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6) },
      uBright: { value: .088 }
    },
    vertexShader: GALAXY_VERT,
    fragmentShader: GALAXY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false
  })
  const galaxyGeo = new THREE.SphereGeometry(R * 1.04, 64, 40)
  let galaxy: THREE.Mesh
  if (renderer) {
    const rt = new THREE.WebGLCubeRenderTarget(1024, {
      type: THREE.HalfFloatType,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    })
    const bakeScene = new THREE.Scene()
    const bakeGeo = new THREE.SphereGeometry(4, 64, 40)
    const bakeMesh = new THREE.Mesh(bakeGeo, galaxyMat)
    bakeMesh.frustumCulled = false
    bakeScene.add(bakeMesh)
    const cubeCam = new THREE.CubeCamera(.1, 10, rt)
    cubeCam.update(renderer, bakeScene)
    bakeGeo.dispose()
    galaxyMat.dispose()
    galaxy = new THREE.Mesh(galaxyGeo, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: rt.texture } },
      vertexShader: BAKED_VERT,
      fragmentShader: BAKED_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    }))
    galaxy.userData.cubeRT = rt
  } else {
    galaxy = new THREE.Mesh(galaxyGeo, galaxyMat)
  }
  galaxy.renderOrder = -1000
  galaxy.frustumCulled = false
  group.add(galaxy)

  const layers: { n: number; size: number; op: number; mag: number }[] = [
    { n: 54000, size: 1.0, op: .62, mag: 4.2 },
    { n: 22000, size: 1.7, op: .80, mag: 3.0 },
    { n: 4200, size: 2.6, op: .95, mag: 2.0 }
  ]
  const tmpC = new THREE.Color()
  for (const layer of layers) {
    const N = layer.n
    const posArr = new Float32Array(N * 3)
    const colArr = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      let x = 0, y = 0, z = 0
      for (let tries = 0; tries < 24; tries++) {
        const u = rand() * 2 - 1
        const ph = rand() * Math.PI * 2
        const sq = Math.sqrt(1 - u * u)
        x = sq * Math.cos(ph); y = u; z = sq * Math.sin(ph)
        const yy = x * planeN.x + y * planeN.y + z * planeN.z
        const p = .22 + .78 * Math.exp(-(yy * yy) / .045)
        if (rand() < p) break
      }
      posArr[i * 3] = R * x
      posArr[i * 3 + 1] = R * y
      posArr[i * 3 + 2] = R * z
      starColor(rand(), tmpC)
      const mag = Math.pow(rand(), layer.mag) * .92 + .08
      colArr[i * 3] = tmpC.r * mag
      colArr[i * 3 + 1] = tmpC.g * mag
      colArr[i * 3 + 2] = tmpC.b * mag
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3))
    const starMat = new THREE.PointsMaterial({
      size: layer.size,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: layer.op,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    })
    const pts = new THREE.Points(starGeo, starMat)
    pts.frustumCulled = false
    pts.renderOrder = -900
    group.add(pts)
  }

  group.userData.galacticPlaneN = planeN
  group.userData.galacticCoreDir = coreDir

  const spriteTex = starSpriteTexture()
  for (let i = 0; i < 34; i++) {
    const bright = Math.pow(rand(), 1.8)
    const mat = new THREE.SpriteMaterial({
      map: spriteTex,
      transparent: true,
      opacity: .30 + bright * .70,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: starColor(rand(), new THREE.Color()),
      fog: false
    })
    const sp = new THREE.Sprite(mat)
    let x = 0, y = 0, z = 0
    for (let tries = 0; tries < 16; tries++) {
      const u = rand() * 2 - 1
      const ph = rand() * Math.PI * 2
      const sq = Math.sqrt(1 - u * u)
      x = sq * Math.cos(ph); y = u; z = sq * Math.sin(ph)
      const yy = x * planeN.x + y * planeN.y + z * planeN.z
      if (rand() < .3 + .7 * Math.exp(-(yy * yy) / .08)) break
    }
    sp.position.set(R * x, R * y, R * z)
    const sz = R * (.0065 + bright * .0075)
    sp.scale.set(sz, sz, 1)
    sp.renderOrder = -880
    group.add(sp)
  }

  return group
}
