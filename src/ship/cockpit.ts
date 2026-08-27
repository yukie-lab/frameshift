import * as THREE from 'three'

function panelTextures(): { rough: THREE.CanvasTexture; normal: THREE.CanvasTexture; ao: THREE.CanvasTexture } {
  const S = 512
  const rc = document.createElement('canvas')
  rc.width = rc.height = S
  const r = rc.getContext('2d')!
  r.fillStyle = '#9c9c9c'
  r.fillRect(0, 0, S, S)
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const w = 2 + Math.random() * 40
    const h = 2 + Math.random() * 40
    r.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},0,0,${.02 + Math.random() * .05})`
    r.fillRect(x, y, w, h)
  }
  const ac = document.createElement('canvas')
  ac.width = ac.height = S
  const a = ac.getContext('2d')!
  a.fillStyle = '#ffffff'
  a.fillRect(0, 0, S, S)

  const nc = document.createElement('canvas')
  nc.width = nc.height = S
  const n = nc.getContext('2d')!
  n.fillStyle = '#8080ff'
  n.fillRect(0, 0, S, S)

  const seam = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
    const g = n.createLinearGradient(x0 === x1 ? x0 - 2 : x0, y0 === y1 ? y0 - 2 : y0,
      x0 === x1 ? x0 + 2 : x1, y0 === y1 ? y0 + 2 : y1)
    if (x0 === x1) {
      g.addColorStop(0, `rgba(60,128,255,${depth})`)
      g.addColorStop(.5, 'rgba(128,128,255,0)')
      g.addColorStop(1, `rgba(196,128,255,${depth})`)
    } else {
      g.addColorStop(0, `rgba(128,60,255,${depth})`)
      g.addColorStop(.5, 'rgba(128,128,255,0)')
      g.addColorStop(1, `rgba(128,196,255,${depth})`)
    }
    n.strokeStyle = g
    n.lineWidth = 4
    n.beginPath()
    n.moveTo(x0, y0)
    n.lineTo(x1, y1)
    n.stroke()
    r.strokeStyle = 'rgba(255,0,0,.55)'
    r.lineWidth = 3
    r.beginPath(); r.moveTo(x0, y0); r.lineTo(x1, y1); r.stroke()
    a.strokeStyle = 'rgba(0,0,0,.55)'
    a.lineWidth = 5
    a.beginPath(); a.moveTo(x0, y0); a.lineTo(x1, y1); a.stroke()
  }

  for (const x of [0, 128, 256, 384]) seam(x, 0, x, S, .75)
  for (const y of [0, 96, 224, 352, 448]) seam(0, y, S, y, .7)
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const len = 30 + Math.random() * 120
    if (Math.random() > .5) seam(x, y, x, y + len, .45)
    else seam(x, y, x + len, y, .45)
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const rad = 1.2 + Math.random() * 2.2
    const g = n.createRadialGradient(x - rad * .4, y - rad * .4, 0, x, y, rad * 2)
    g.addColorStop(0, 'rgba(180,180,255,.75)')
    g.addColorStop(1, 'rgba(128,128,255,0)')
    n.fillStyle = g
    n.beginPath(); n.arc(x, y, rad * 2, 0, Math.PI * 2); n.fill()
    r.fillStyle = 'rgba(0,0,0,.35)'
    r.beginPath(); r.arc(x, y, rad, 0, Math.PI * 2); r.fill()
  }
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const len = 4 + Math.random() * 34
    const ang = Math.random() * Math.PI
    n.strokeStyle = Math.random() > .5 ? 'rgba(150,150,255,.13)' : 'rgba(105,105,235,.12)'
    n.lineWidth = .6
    n.beginPath()
    n.moveTo(x, y)
    n.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    n.stroke()
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { rough: mk(rc, false), normal: mk(nc, false), ao: mk(ac, false) }
}

function scannerWellTexture(): THREE.CanvasTexture {
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const c = cv.getContext('2d')!
  const h = S / 2
  const bg = c.createRadialGradient(h, h, 0, h, h, h)
  bg.addColorStop(0, '#01050a')
  bg.addColorStop(.72, '#03080e')
  bg.addColorStop(1, '#0a1017')
  c.fillStyle = bg
  c.fillRect(0, 0, S, S)
  c.strokeStyle = 'rgba(255,140,42,.16)'
  for (let i = 1; i <= 4; i++) {
    c.lineWidth = i === 4 ? 3 : 1.4
    c.beginPath()
    c.arc(h, h, h * (.18 + i * .19), 0, Math.PI * 2)
    c.stroke()
  }
  c.strokeStyle = 'rgba(53,214,255,.10)'
  c.lineWidth = 1
  for (let a = 0; a < 12; a++) {
    const th = (a / 12) * Math.PI * 2
    c.beginPath()
    c.moveTo(h + Math.cos(th) * h * .16, h + Math.sin(th) * h * .16)
    c.lineTo(h + Math.cos(th) * h * .93, h + Math.sin(th) * h * .93)
    c.stroke()
  }
  c.strokeStyle = 'rgba(255,140,42,.34)'
  c.lineWidth = 4
  c.beginPath()
  c.arc(h, h, h * .955, 0, Math.PI * 2)
  c.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function screenTexture(kind: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 256
  const c = cv.getContext('2d')!
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const draw = (t: number) => {
    c.fillStyle = '#01060b'
    c.fillRect(0, 0, 512, 256)
    c.strokeStyle = 'rgba(53,214,255,.14)'
    c.lineWidth = 1
    for (let gx = 0; gx <= 512; gx += 32) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, 256); c.stroke() }
    for (let gy = 0; gy <= 256; gy += 32) { c.beginPath(); c.moveTo(0, gy); c.lineTo(512, gy); c.stroke() }
    c.font = "600 13px 'Consolas','Menlo',monospace"
    if (kind === 0) {
      c.fillStyle = 'rgba(53,214,255,.75)'
      c.fillText('PWR DIST', 14, 26)
      c.fillText('SYS  ENG  WEP', 14, 240)
      for (let i = 0; i < 3; i++) {
        const lvl = [.62, .88, .34][i] + .08 * Math.sin(t * 1.3 + i)
        const x = 26 + i * 92
        c.strokeStyle = 'rgba(53,214,255,.5)'
        c.strokeRect(x, 46, 56, 172)
        c.fillStyle = i === 1 ? 'rgba(255,140,42,.72)' : 'rgba(53,214,255,.55)'
        c.fillRect(x + 4, 214 - 164 * lvl, 48, 164 * lvl)
      }
      c.strokeStyle = 'rgba(53,214,255,.6)'
      c.beginPath()
      for (let x = 300; x <= 500; x += 3) {
        const y = 130 + Math.sin(x * .07 + t * 2.4) * 30 * Math.sin(x * .012 + t)
        if (x === 300) c.moveTo(x, y); else c.lineTo(x, y)
      }
      c.stroke()
      c.fillStyle = 'rgba(53,214,255,.5)'
      c.fillText('FSD  ONLINE', 300, 40)
      c.fillText('HULL 100%', 300, 220)
    } else {
      c.fillStyle = 'rgba(53,214,255,.75)'
      c.fillText('SUBSYSTEMS', 14, 26)
      for (let row = 0; row < 5; row++) {
        const y = 52 + row * 34
        c.fillStyle = 'rgba(53,214,255,.35)'
        c.fillRect(14, y, 6, 18)
        const segs = 6 + ((row * 3 + Math.floor(t * 1.6)) % 8)
        for (let s = 0; s < segs; s++) {
          c.fillStyle = s > 10 ? 'rgba(255,140,42,.7)' : 'rgba(53,214,255,.6)'
          c.fillRect(30 + s * 18, y, 12, 18)
        }
      }
      c.strokeStyle = 'rgba(255,140,42,.5)'
      c.strokeRect(360, 46, 132, 168)
      c.fillStyle = 'rgba(255,140,42,.55)'
      const bar = 20 + ((Math.floor(t * 4)) % 140)
      c.fillRect(366, 208 - bar, 120, bar)
      c.fillStyle = 'rgba(53,214,255,.5)'
      c.fillText('THERMAL', 366, 40)
    }
    tex.needsUpdate = true
  }
  draw(0)
  setInterval(() => draw(performance.now() / 1000), 120)
  return tex
}

export function buildCockpit(camera: THREE.PerspectiveCamera): THREE.Group {
  const g = new THREE.Group()
  const det = panelTextures()

  const mkPanel = (color: number, metal: number, rough: number, rep: number) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: metal,
      roughness: rough,
      roughnessMap: det.rough,
      normalMap: det.normal,
      normalScale: new THREE.Vector2(.85, .85),
      envMapIntensity: .55
    })
    m.roughnessMap!.repeat.set(rep, rep)
    return m
  }

  const hull = mkPanel(0x232932, .48, .62, 2)
  const hullDark = mkPanel(0x191d24, .42, .74, 3)
  const bezel = new THREE.MeshStandardMaterial({ color: 0x0d1014, metalness: .5, roughness: .78 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0x545c66, metalness: .92, roughness: .34, envMapIntensity: .9 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, metalness: .1, roughness: .95 })
  const orangeLit = new THREE.MeshStandardMaterial({ color: 0x160b03, emissive: 0xff8c2a, emissiveIntensity: .42, toneMapped: true })
  const cyanLit = new THREE.MeshStandardMaterial({ color: 0x03101a, emissive: 0x35d6ff, emissiveIntensity: .34 })
  const dimLit = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xff8c2a, emissiveIntensity: .14 })

  const box = (mat: THREE.Material, w: number, h: number, d: number,
    x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = g): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    parent.add(m)
    return m
  }

  const lamp = (color: number, intensity: number, dist: number, x: number, y: number, z: number) => {
    const l = new THREE.PointLight(color, intensity, dist, 2)
    l.position.set(x, y, z)
    g.add(l)
    return l
  }
  lamp(0xffc08a, .110, 2.0, 0, -.14, -.56)
  lamp(0x4fb8ff, .075, 1.8, -.84, -.28, -.32)
  lamp(0x4fb8ff, .075, 1.8, .84, -.28, -.32)
  lamp(0xffb070, .060, 1.3, 0, .38, -.72)
  g.add(new THREE.HemisphereLight(0x2a374a, 0x090b0e, .38))

  const DASH_Y = -.50
  const DASH_Z = -.66
  const DASH_TILT = .30

  const dash = new THREE.Group()
  dash.position.set(0, DASH_Y, DASH_Z)
  dash.rotation.x = DASH_TILT
  g.add(dash)

  box(hull, 1.46, .17, .52, 0, 0, 0, 0, 0, 0, dash)
  box(hullDark, 1.50, .045, .55, 0, .096, .004, 0, 0, 0, dash)
  box(chrome, 1.50, .012, .020, 0, .120, -.262, 0, 0, 0, dash)
  box(orangeLit, 1.28, .006, .010, 0, .124, -.268, 0, 0, 0, dash)
  for (const sx of [-.62, -.38, -.14, .14, .38, .62]) {
    box(hullDark, .014, .050, .46, sx, .098, .01, 0, 0, 0, dash)
  }
  for (const sx of [-.50, -.26, .26, .50]) {
    box(cyanLit, .16, .004, .008, sx, .123, -.10, 0, 0, 0, dash)
  }

  const stack = new THREE.Group()
  stack.position.set(0, .055, .02)
  dash.add(stack)
  box(hull, .60, .085, .28, 0, .03, 0, 0, 0, 0, stack)
  box(bezel, .50, .012, .24, 0, .072, 0, 0, 0, 0, stack)
  const well = new THREE.Mesh(
    new THREE.PlaneGeometry(.30, .30),
    new THREE.MeshBasicMaterial({ map: scannerWellTexture(), toneMapped: true })
  )
  well.position.set(0, .078, -.005)
  well.rotation.x = -Math.PI / 2
  stack.add(well)
  box(hullDark, .12, .016, .22, -.22, .080, 0, 0, 0, 0, stack)
  box(hullDark, .12, .016, .22, .22, .080, 0, 0, 0, 0, stack)
  for (const sx of [-1, 1]) {
    box(cyanLit, .07, .004, .008, sx * .22, .090, -.06, 0, 0, 0, stack)
    box(dimLit, .07, .004, .008, sx * .22, .090, .06, 0, 0, 0, stack)
  }
  box(chrome, .58, .010, .016, 0, .080, -.138, 0, 0, 0, stack)

  for (const sx of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(sx * .72, .06, -.02)
    wing.rotation.set(0, -sx * .34, sx * .10)
    dash.add(wing)
    box(hull, .52, .11, .40, 0, 0, 0, 0, 0, 0, wing)
    box(bezel, .44, .014, .30, 0, .062, 0, 0, 0, 0, wing)
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(.40, .25),
      new THREE.MeshBasicMaterial({ map: screenTexture(sx < 0 ? 1 : 0), toneMapped: true })
    )
    scr.position.set(0, .072, 0)
    scr.rotation.x = -Math.PI / 2
    wing.add(scr)
    box(chrome, .46, .008, .014, 0, .074, -.158, 0, 0, 0, wing)
    box(sx < 0 ? cyanLit : orangeLit, .30, .004, .008, 0, .073, .176, 0, 0, 0, wing)
  }

  const btnGeo = new THREE.BoxGeometry(.020, .009, .014)
  const btnDark = new THREE.InstancedMesh(btnGeo, rubber, 180)
  const btnLit = new THREE.InstancedMesh(btnGeo, orangeLit, 34)
  const btnCyan = new THREE.InstancedMesh(btnGeo, cyanLit, 26)
  const m4 = new THREE.Matrix4()
  let di = 0, li = 0, ci = 0
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 26; col++) {
      const bx = -.60 + col * .048
      const bz = .04 + row * .050
      if (Math.abs(bx) < .30 && bz < .12) continue
      m4.makeTranslation(bx, .098, bz)
      const k = (col * 7 + row * 5) % 13
      if (k === 0 && li < 34) btnLit.setMatrixAt(li++, m4)
      else if (k === 4 && ci < 26) btnCyan.setMatrixAt(ci++, m4)
      else if (di < 180) btnDark.setMatrixAt(di++, m4)
    }
  }
  btnDark.count = di; btnLit.count = li; btnCyan.count = ci
  dash.add(btnDark, btnLit, btnCyan)

  const pillarShape = (sx: number) => {
    const p = new THREE.Group()
    p.position.set(sx * .60, .06, -.50)
    p.rotation.set(.10, 0, -sx * .285)
    g.add(p)
    const beam = box(hull, .062, 1.24, .11, 0, 0, 0, 0, 0, 0, p)
    beam.geometry.translate(0, 0, 0)
    box(chrome, .020, 1.20, .012, -sx * .034, 0, .052, 0, 0, 0, p)
    box(orangeLit, .010, .96, .010, -sx * .034, -.02, .062, 0, 0, 0, p)
    box(hullDark, .086, .075, .13, 0, .615, .004, 0, 0, 0, p)
    box(hullDark, .098, .085, .14, 0, -.615, .008, 0, 0, 0, p)
    box(chrome, .070, .012, .016, 0, .565, .058, 0, 0, 0, p)
    for (let i = 0; i < 5; i++) {
      box(hullDark, .070, .016, .015, 0, .42 - i * .19, .056, 0, 0, 0, p)
    }
    const boltGeo = new THREE.CylinderGeometry(.0055, .0055, .010, 6)
    const bolts = new THREE.InstancedMesh(boltGeo, chrome, 12)
    const bm = new THREE.Matrix4()
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
    const one = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < 12; i++) {
      bm.compose(new THREE.Vector3(sx * .022 * (i % 2 ? 1 : -1), .55 - i * .10, .057), rot, one)
      bolts.setMatrixAt(i, bm)
    }
    p.add(bolts)
  }
  pillarShape(-1)
  pillarShape(1)

  const roof = new THREE.Group()
  roof.position.set(0, .56, -.44)
  roof.rotation.x = -.10
  g.add(roof)
  box(hull, 1.86, .05, .92, 0, 0, 0, 0, 0, 0, roof)
  for (const z of [-.32, -.10, .12, .32]) {
    box(hullDark, 1.80, .036, .055, 0, -.040, z, 0, 0, 0, roof)
  }
  for (const sx of [-.66, -.22, .22, .66]) {
    box(cyanLit, .26, .006, .016, sx, -.058, -.21, 0, 0, 0, roof)
  }
  box(orangeLit, 1.52, .005, .010, 0, -.058, .21, 0, 0, 0, roof)
  const ovPanel = box(hull, .92, .050, .30, 0, -.052, -.36, 0, 0, 0, roof)
  const ovBtnDark = new THREE.InstancedMesh(new THREE.BoxGeometry(.020, .009, .014), rubber, 36)
  const ovBtnLit = new THREE.InstancedMesh(new THREE.BoxGeometry(.020, .009, .014), dimLit, 12)
  const ovM = new THREE.Matrix4()
  let oi = 0
  let ol = 0
  for (let r0 = 0; r0 < 3; r0++) {
    for (let c0 = 0; c0 < 12; c0++) {
      ovM.makeTranslation(-.40 + c0 * .073, -.029, -.09 + r0 * .085)
      if ((c0 * 5 + r0 * 3) % 7 === 0 && ol < 12) ovBtnLit.setMatrixAt(ol++, ovM)
      else if (oi < 36) ovBtnDark.setMatrixAt(oi++, ovM)
    }
  }
  ovBtnDark.count = oi
  ovBtnLit.count = ol
  ovPanel.add(ovBtnDark, ovBtnLit)
  const ovRib = box(hullDark, .96, .016, .020, 0, -.070, -.20, 0, 0, 0, roof)
  ovRib.name = 'ovrib'
  for (const sx of [-1, 1]) {
    box(chrome, .014, .014, .84, sx * .90, -.028, 0, 0, 0, 0, roof)
  }

  for (const sx of [-1, 1]) {
    const side = new THREE.Group()
    side.position.set(sx * .98, -.30, -.20)
    side.rotation.set(0, -sx * .40, 0)
    g.add(side)
    box(hull, 1.05, .62, .09, 0, 0, 0, 0, 0, 0, side)
    box(hullDark, .92, .40, .03, 0, .02, .058, 0, 0, 0, side)
    for (let i = 0; i < 7; i++) {
      box(rubber, .56, .012, .016, -.10, .16 - i * .050, .078, 0, 0, 0, side)
    }
    box(sx < 0 ? cyanLit : orangeLit, .60, .005, .010, -.10, -.22, .078, 0, 0, 0, side)
    box(chrome, .015, .58, .014, .44, 0, .062, 0, 0, 0, side)
    box(hullDark, .26, .18, .035, .30, .14, .062, 0, 0, 0, side)
    for (let i = 0; i < 5; i++) {
      box(chrome, .20, .006, .012, .30, .20 - i * .028, .082, 0, 0, 0, side)
    }
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.020, .026, .16, 12), rubber)
    grip.position.set(-.30, -.05, .12)
    grip.rotation.set(-.42, 0, sx * .10)
    side.add(grip)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.030, 16, 12), rubber)
    knob.position.set(-.30, .028, .155)
    side.add(knob)
    box(sx < 0 ? cyanLit : orangeLit, .020, .008, .016, -.30, .050, .175, 0, 0, 0, side)
  }

  box(hullDark, 2.10, .07, 1.05, 0, -.90, -.12)
  box(hull, 1.30, .09, .34, 0, -.66, -.56, -.24)
  box(chrome, 1.20, .010, .016, 0, -.612, -.585, -.24)
  box(rubber, .34, .40, .40, 0, -.72, -.40)

  for (const sx of [-1, 1]) {
    box(hull, .30, .11, .46, sx * .50, -.60, -.44, -.10, -sx * .18, 0)
    box(chrome, .012, .012, .40, sx * .36, -.556, -.44, -.10, 0, 0)
  }

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x101a20,
    transparent: true,
    opacity: .075,
    roughness: .035,
    metalness: 0,
    envMapIntensity: .35,
    clearcoat: .55,
    clearcoatRoughness: .12,
    normalMap: det.normal,
    normalScale: new THREE.Vector2(.05, .05),
    side: THREE.DoubleSide,
    depthWrite: false
  })
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(1.44, 64, 36, 0, Math.PI * 2, 0, 1.44),
    glassMat
  )
  glass.position.y = -.05
  glass.renderOrder = 20
  g.add(glass)

  return g
}
