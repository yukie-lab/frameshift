import * as THREE from 'three'
import type { HyperspaceLike } from '../engine/types'

const DUR = { charging: 3, tunnel: 5, flash: 0.45, arrived: 1 } as const
type PhaseName = 'idle' | 'charging' | 'tunnel' | 'flash' | 'arrived'
const PHASE_ID: Record<PhaseName, number> = { idle: 0, charging: 1, tunnel: 2, flash: 3, arrived: 4 }

const TUNNEL_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uPhase;
uniform float uProg;
uniform float uTime;
varying vec2 vUv;

float hash21(vec2 p){
  p = fract(p*vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x*p.y);
}
float vnoise(vec2 p, float wrapN){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f*f*(3. - 2.*f);
  float x0 = mod(i.x, wrapN);
  float x1 = mod(i.x + 1., wrapN);
  float a = hash21(vec2(x0, i.y));
  float b = hash21(vec2(x1, i.y));
  float c = hash21(vec2(x0, i.y + 1.));
  float d = hash21(vec2(x1, i.y + 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float streaks(float ang, float lr, float t, float shift){
  float s1 = vnoise(vec2(ang*72.,  lr*2.6 - t*1.55 + shift), 72.);
  float s2 = vnoise(vec2(ang*190., lr*4.8 - t*2.70 + shift), 190.);
  float s3 = vnoise(vec2(ang*430., lr*8.6 - t*4.10 + shift), 430.);
  float f = s1*.50 + s2*.32 + s3*.24;
  return pow(clamp(f*1.62 - .38, 0., 1.), 2.7);
}

void main(){
  #include <logdepthbuf_fragment>
  vec2 p = (vUv - .5)*2.;
  float r = length(p);
  float t = uTime;
  if (uPhase < .5 || uPhase > 4.5) { gl_FragColor = vec4(0.); return; }

  if (uPhase < 1.5) {
    float ang = atan(p.y, p.x)/6.2831853 + .5;
    float lr = log(max(r, .03));
    float f = streaks(ang, lr, t*.55, 0.);
    float ring = exp(-pow((r - (1. - uProg*.72))/.10, 2.));
    float conv = f * smoothstep(.04, .45, r) * (1. - smoothstep(.72, 1.02, r));
    float core = exp(-r*r*26.)*(.20 + .95*uProg);
    vec3 col = vec3(.10, .78, .82)*conv*uProg*1.15
             + vec3(.45, .92, 1.)*ring*uProg*.55
             + vec3(.72, .96, 1.)*core;
    gl_FragColor = vec4(col*1.15, 1.);
    return;
  }

  if (uPhase < 2.5) {
    float swirl = .14*uProg*sin(t*.35) + .085*r;
    float ang = atan(p.y, p.x)/6.2831853 + .5 + swirl;
    float lr = log(max(r, .025));
    float ca = (.010 + .045*uProg)*r;
    float fR = streaks(ang, lr + ca,  t, 0.);
    float fG = streaks(ang, lr,       t, 0.);
    float fB = streaks(ang, lr - ca,  t, 0.);

    float wall = smoothstep(.02, .30, r);
    float edge = 1. - smoothstep(.68, 1.18, r);
    float depth = pow(clamp(1. - r, 0., 1.), .55);

    vec3 hueA = mix(vec3(.10, .72, 1.), vec3(.42, .34, 1.), smoothstep(.10, .68, uProg));
    vec3 hueB = mix(hueA, vec3(1., .98, .94), smoothstep(.72, 1., uProg));

    vec3 col = vec3(fR, fG, fB) * hueB * (.55 + 1.05*uProg);
    col *= wall*edge*(.30 + .85*depth);

    float shear = vnoise(vec2((atan(p.y,p.x)/6.2831853 + .5)*24., lr*1.4 - t*.9), 24.);
    col *= .58 + .78*shear;

    float coreGlow = exp(-r*r*(46. - 20.*uProg));
    col += hueB * coreGlow * (.16 + 1.35*uProg*uProg);
    col += vec3(.80, .96, 1.) * exp(-r*r*260.) * (.30 + 3.4*uProg*uProg);
    col *= 1. - smoothstep(.92, 1.35, r)*.85;
    gl_FragColor = vec4(col, 1.);
    return;
  }

  if (uPhase < 3.5) {
    float a = 1. - uProg;
    gl_FragColor = vec4(vec3(1., .995, .985)*a*2.4, 1.);
    return;
  }

  float ang = atan(p.y, p.x)/6.2831853 + .5;
  float lr = log(max(r, .03));
  float burst = streaks(ang, lr, t*2.2, 3.7) * (1. - uProg) * smoothstep(.02, .3, r);
  float ring = exp(-pow((r - uProg*1.15)/.09, 2.))*(1. - uProg);
  float core = exp(-r*r*16.)*(1. - uProg)*1.4;
  gl_FragColor = vec4((vec3(.55, .95, 1.)*burst*1.5 + vec3(1., .99, .95)*ring + vec3(.85, .97, 1.)*core)*1.5, 1.);
}`

export class HyperspaceFX implements HyperspaceLike {
  phase: PhaseName = 'idle'
  progress = 0
  onArrive: (seed: number) => void = () => {}

  private elapsed = 0
  private arrivedFired = false
  private mat: THREE.ShaderMaterial
  private quad: THREE.Mesh
  private starLines: THREE.LineSegments
  private starPos: Float32Array
  private time = 0

  constructor(camera: THREE.PerspectiveCamera) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPhase: { value: 0 }, uProg: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`,
      fragmentShader: TUNNEL_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(.52, .34), this.mat)
    this.quad.position.z = -.12
    this.quad.renderOrder = 999
    this.quad.frustumCulled = false
    this.quad.visible = false
    camera.add(this.quad)

    const N = 300
    this.starPos = new Float32Array(N * 3)
    const lineArr = new Float32Array(N * 2 * 3)
    for (let i = 0; i < N; i++) {
      const u = Math.random()*2-1
      const ph = Math.random()*Math.PI*2
      const sq = Math.sqrt(1-u*u)
      const rr = 1.2 + Math.random()*5
      const x = rr*sq*Math.cos(ph), y = rr*u, z = rr*sq*Math.sin(ph)
      this.starPos[i*3] = x; this.starPos[i*3+1] = y; this.starPos[i*3+2] = z
      lineArr[i*6] = x; lineArr[i*6+1] = y; lineArr[i*6+2] = z
      lineArr[i*6+3] = x*.94; lineArr[i*6+4] = y*.94; lineArr[i*6+5] = z*.94
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(lineArr, 3))
    const lmat = new THREE.LineBasicMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
    this.starLines = new THREE.LineSegments(geo, lmat)
    this.starLines.frustumCulled = false
    this.starLines.renderOrder = 998
    this.starLines.visible = false
    camera.add(this.starLines)
  }

  trigger(): void {
    if (this.phase !== 'idle') return
    this.phase = 'charging'
    this.elapsed = 0
    this.progress = 0
    this.arrivedFired = false
  }

  update(dt: number): void {
    this.time += dt
    if (this.phase === 'idle') {
      this.quad.visible = false
      this.starLines.visible = false
      return
    }
    this.elapsed += dt
    const dur = DUR[this.phase as keyof typeof DUR]
    this.progress = Math.min(1, this.elapsed / dur)

    if (this.phase === 'charging' && this.progress >= 1) {
      this.phase = 'tunnel'; this.elapsed = 0; this.progress = 0
    } else if (this.phase === 'tunnel' && this.progress >= 1) {
      this.phase = 'flash'; this.elapsed = 0; this.progress = 0
    } else if (this.phase === 'flash' && this.progress >= 1) {
      this.phase = 'arrived'; this.elapsed = 0; this.progress = 0
    }

    this.quad.visible = true
    this.mat.uniforms.uPhase.value = PHASE_ID[this.phase]
    this.mat.uniforms.uProg.value = this.phase === 'flash' ? 1 - this.progress : this.progress
    this.mat.uniforms.uTime.value = this.time

    const lmat = this.starLines.material as THREE.LineBasicMaterial
    if (this.phase === 'tunnel') {
      this.starLines.visible = true
      lmat.opacity = .25 * Math.sin(Math.min(this.progress, 1) * Math.PI)
      const attr = this.starLines.geometry.attributes.position as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      const stretch = .55 - .35 * this.progress
      for (let i = 0; i < 300; i++) {
        const x = this.starPos[i*3], y = this.starPos[i*3+1], z = this.starPos[i*3+2]
        arr[i*6]   = x; arr[i*6+1] = y; arr[i*6+2] = z
        arr[i*6+3] = x*stretch; arr[i*6+4] = y*stretch; arr[i*6+5] = z*stretch
      }
      attr.needsUpdate = true
      this.starLines.rotation.z += dt * .12
      this.quad.scale.setScalar(1 + .025 * Math.sin(this.time * 9))
    } else {
      this.starLines.visible = false
    }

    if (this.phase === 'arrived' && !this.arrivedFired) {
      this.arrivedFired = true
      this.onArrive((Date.now() % 100000) | 0)
    }
    if (this.phase === 'arrived' && this.progress >= 1) {
      this.phase = 'idle'
      this.progress = 0
      this.quad.visible = false
    }
  }
}
