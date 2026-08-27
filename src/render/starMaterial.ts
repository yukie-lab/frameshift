import * as THREE from 'three'
import type { StarInfo } from '../engine/types'

const NOISE = `
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
    f += a*snoise(p); n += a; p = p*2.07 + vec3(6.11,2.53,8.97); a *= .5;
  }
  return f/max(n, 1e-5);
}
float ridged(vec3 p, int oct){
  float f = 0.; float a = .5; float n = 0.;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    f += a*(1.-abs(snoise(p))); n += a; p = p*2.17 + vec3(1.73,5.29,3.41); a *= .5;
  }
  return f/max(n, 1e-5);
}`

export function tempToColor(tempK: number): THREE.Color {
  const stops: [number, number[]][] = [
    [2500, [255, 140, 60]], [3500, [255, 180, 110]], [4500, [255, 205, 150]],
    [5772, [255, 244, 232]], [6500, [240, 244, 255]], [8000, [205, 215, 255]],
    [12000, [175, 190, 255]], [20000, [155, 173, 255]]
  ]
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (tempK >= stops[i][0] && tempK <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break }
  }
  const t = Math.min(1, Math.max(0, (tempK - lo[0]) / Math.max(hi[0] - lo[0], 1)))
  return new THREE.Color().setRGB(
    (lo[1][0] + (hi[1][0] - lo[1][0]) * t) / 255,
    (lo[1][1] + (hi[1][1] - lo[1][1]) * t) / 255,
    (lo[1][2] + (hi[1][2] - lo[1][2]) * t) / 255,
    THREE.SRGBColorSpace
  )
}

const CORE_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;
varying vec3 vNw;
varying vec3 vWp;
void main(){
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWp = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`

const CORE_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uHot;
uniform vec3 uCool;
uniform vec3 uDeep;
uniform float uTime;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vNw;
varying vec3 vWp;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  vec3 sp = normalize(vObj);
  vec3 N = normalize(vNw);
  vec3 V = normalize(-vWp);
  float mu = clamp(dot(N, V), 0., 1.);

  float t = uTime*.045;
  vec3 drift = vec3(t*.12, t*.07, -t*.09);
  float superG = fbm(sp*3.4 + drift + uSeed, 4)*.5 + .5;
  float gran = ridged(sp*22. + drift*2.4 + uSeed*1.7, 3);
  float granFine = ridged(sp*58. + drift*4.1 + uSeed*2.9, 2);
  float cell = clamp(gran*.62 + granFine*.38, 0., 1.);
  cell = pow(cell, 2.4);
  float mixv = clamp(cell*.92 + superG*.46 - .20, 0., 1.);

  vec3 col = mix(uCool, uHot, mixv);
  col = mix(uDeep, col, smoothstep(.02, .38, mixv));

  float spot = smoothstep(.70, .90, fbm(sp*5.1 - drift*.4 + uSeed*3.3, 4)*.5+.5);
  float umbra = smoothstep(.80, .95, fbm(sp*5.1 - drift*.4 + uSeed*3.3, 4)*.5+.5);
  col = mix(col, uDeep*.45, spot*.72);
  col = mix(col, uDeep*.16, umbra*.85);

  float limb = 1. - .86*(1. - pow(max(mu, 1e-4), .40));
  col *= limb;

  float facula = smoothstep(.55, .95, cell) * (1. - mu) * (1. - spot);
  col += uHot * facula * .55;

  col *= 1.62;
  gl_FragColor = vec4(col, 1.);
}`

const BILLBOARD_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vP;
void main(){
  vP = position.xy;
  vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
  mv.xy += position.xy;
  vec4 pos = projectionMatrix * mv;
  gl_Position = pos;
  #include <logdepthbuf_vertex>
}`

const CORONA_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
uniform float uTime;
uniform float uSeed;
uniform float uStarR;
varying vec2 vP;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  float r = length(vP)/uStarR;
  if (r > 11.5) discard;
  vec2 dir = vP/max(length(vP), 1e-6);
  float t = uTime;

  vec3 q = vec3(dir*2.6, r*.55 - t*.020);
  float fil = ridged(q*1.0 + uSeed, 4);
  float filFine = ridged(vec3(dir*7.4, r*1.1 - t*.035) + uSeed*1.9, 3);
  float streak = clamp(fil*.62 + filFine*.44 - .18, 0., 1.);
  streak = pow(streak, 2.2);

  float inner = exp(-(r - 1.)*8.5);
  float outer = 1./(1. + pow(max(r - .55, .05)*1.55, 3.1));
  float halo = exp(-(r - 1.)*1.05)*.16;

  float chromo = exp(-pow((r - 1.012)/.035, 2.)) * .48;
  float pulse = .92 + .08*sin(t*.55 + uSeed*3.);

  float prom = smoothstep(.68, .96, ridged(vec3(dir*4.1, t*.055 + uSeed*4.), 3))
             * exp(-pow((r - 1.09)/.11, 2.)) * .62;

  float body = (inner*.30 + outer*.42 + halo) * (.26 + 1.30*streak) * pulse * .58;
  vec3 col = mix(uCool, uMid, clamp(streak*1.2, 0., 1.));
  col = mix(col, uHot, smoothstep(1.35, .95, r));
  vec3 outc = col*body;
  outc += uHot*chromo*.95;
  outc += mix(uMid, uHot, .4)*prom;
  outc *= smoothstep(11.5, 8.5, r);
  gl_FragColor = vec4(outc, 1.);
}`

const GLOW_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uTint;
uniform float uStarR;
varying vec2 vP;
void main(){
  #include <logdepthbuf_fragment>
  float r = length(vP)/uStarR;
  float a = 1./(1. + pow(r*.42, 2.9));
  a *= smoothstep(34., 22., r);
  gl_FragColor = vec4(uTint*a*.058, 1.);
}`

export function createStarMesh(star: StarInfo): THREE.Group {
  const group = new THREE.Group()
  const base = tempToColor(star.tempK)
  const hot = base.clone().lerp(new THREE.Color(1, 1, 1), .62)
  const mid = base.clone()
  const cool = base.clone().multiplyScalar(.66)
  const deep = base.clone().multiplyScalar(.30)
  const seed = (star.tempK % 97) * .11

  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: hot },
      uCool: { value: cool },
      uDeep: { value: deep },
      uTime: { value: 0 },
      uSeed: { value: seed }
    },
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG
  })
  const core = new THREE.Mesh(new THREE.SphereGeometry(star.radiusM, 128, 64), coreMat)
  group.add(core)

  const coronaSpan = star.radiusM * 11.5
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: hot },
      uMid: { value: mid },
      uCool: { value: cool },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uStarR: { value: star.radiusM }
    },
    vertexShader: BILLBOARD_VERT,
    fragmentShader: CORONA_FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true
  })
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(coronaSpan * 2, coronaSpan * 2), coronaMat)
  corona.frustumCulled = false
  corona.renderOrder = 3
  group.add(corona)

  const glowSpan = star.radiusM * 34
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: base.clone().lerp(new THREE.Color(1, 1, 1), .3) },
      uStarR: { value: star.radiusM }
    },
    vertexShader: BILLBOARD_VERT,
    fragmentShader: GLOW_FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false
  })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowSpan * 2, glowSpan * 2), glowMat)
  glow.frustumCulled = false
  glow.renderOrder = 2
  group.add(glow)

  core.onBeforeRender = () => {
    const t = performance.now() / 1000
    coreMat.uniforms.uTime.value = t
    coronaMat.uniforms.uTime.value = t
  }

  return group
}
