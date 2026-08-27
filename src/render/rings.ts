import * as THREE from 'three'
import type { CelestialBody } from '../engine/types'

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
    f += a*snoise(p); n += a; p = p*2.05 + vec3(4.13,8.27,1.59); a *= .5;
  }
  return f/max(n, 1e-5);
}
float hash1(float n){ return fract(sin(n*127.1)*43758.5453123); }`

export function createRing(body: CelestialBody): THREE.Mesh {
  const geo = new THREE.RingGeometry(body.ringInnerM, body.ringOuterM, 512, 1)
  geo.rotateX(-Math.PI / 2)

  const seed = (body.name.length * 7 + Math.floor(body.radiusM % 97)) * .137
  const gaps: number[] = [.235 + (seed % .05), .468 + ((seed * 3) % .05), .715 + ((seed * 7) % .05)]

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uPlanetR: { value: body.radiusM },
      uInner: { value: body.ringInnerM },
      uOuter: { value: body.ringOuterM },
      uSeed: { value: seed },
      uGaps: { value: new THREE.Vector3(gaps[0], gaps[1], gaps[2]) }
    },
    vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vLocal;
varying vec3 vWp;
varying vec3 vCenter;
varying vec3 vNw;
void main(){
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWp = wp.xyz;
  vCenter = (modelMatrix * vec4(0.,0.,0.,1.)).xyz;
  vNw = normalize(mat3(modelMatrix) * vec3(0.,1.,0.));
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform float uPlanetR;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
uniform vec3 uGaps;
varying vec3 vLocal;
varying vec3 vWp;
varying vec3 vCenter;
varying vec3 vNw;
${NOISE}

float ringlets(float t, float freq, float sd, float aa){
  float x = t*freq + sd;
  float c = floor(x);
  float f = fract(x);
  float w = .30 + .55*hash1(c + sd*3.1);
  float soft = clamp(aa*freq*2.2, .04, .60);
  float e = smoothstep(0., w*.5 + soft, f) * (1. - smoothstep(1. - w*.5 - soft, 1., f));
  float amp = .30 + .70*hash1(c*1.7 + sd);
  float lod = 1. - smoothstep(.35, 1.1, aa*freq);
  return mix(.5, mix(.5, e, amp), lod);
}

void main(){
  #include <logdepthbuf_fragment>
  float r = length(vLocal.xz);
  float t = clamp((r - uInner)/(uOuter - uInner), 0., 1.);

  float aa = max(fwidth(t), 1e-6);
  float b1 = ringlets(t, 11., uSeed, aa);
  float b2 = ringlets(t, 38., uSeed*2.3 + 5., aa);
  float b3 = ringlets(t, 129., uSeed*3.7 + 11., aa);
  float b4 = ringlets(t, 380., uSeed*5.1 + 23., aa);
  float macro = fbm(vec3(t*6.2, uSeed, 0.), 4)*.5 + .5;

  float density = .40 + .38*macro + .30*b1 + .20*b2 + .13*b3 + .07*b4;
  density *= smoothstep(.0, .05, t) * (1. - smoothstep(.88, 1., t));
  density *= mix(.05, 1., smoothstep(.006, .034, abs(t - uGaps.x)));
  density *= mix(.34, 1., smoothstep(.004, .017, abs(t - uGaps.y)));
  density *= mix(.52, 1., smoothstep(.003, .011, abs(t - uGaps.z)));
  density = clamp(density*.95, 0., 1.);

  vec3 L = normalize(uLightDir);
  vec3 N = normalize(vNw);
  vec3 V = normalize(-vWp);
  float sunSide = dot(N, L);
  float viewSide = dot(N, V);

  vec3 toC = vCenter - vWp;
  float proj = dot(toC, L);
  float shadow = 1.;
  if (proj > 0.) {
    float perp = length(toC - L*proj);
    shadow = smoothstep(uPlanetR*.94, uPlanetR*1.20, perp);
    shadow = shadow*shadow*(3. - 2.*shadow);
  }

  float inc = clamp(abs(sunSide), .12, 1.);
  float sameSide = step(0., sunSide*viewSide);
  float tau = pow(density, 1.6)*3.0/inc;
  float trans = exp(-tau);

  float back = sameSide * (1. - trans) * (.40 + .40*pow(clamp(dot(L, V), 0., 1.), 3.));
  float fwd = (1. - sameSide) * (1. - trans) * trans * (1.15 + 3.2*pow(clamp(dot(-L, V), 0., 1.), 6.));
  float lit = (back + fwd) * mix(.045, 1., shadow);

  vec3 icy = vec3(.92, .88, .80);
  vec3 dusty = vec3(.66, .55, .42);
  vec3 pale = vec3(.80, .82, .88);
  vec3 col = mix(dusty, icy, smoothstep(.18, .72, macro));
  col = mix(col, pale, smoothstep(.62, 1., t)*.45);
  col *= .82 + .34*(fbm(vec3(t*90., uSeed*2., 0.), 3)*.5 + .5);
  col *= uSunColor * lit * .95;
  col += uSunColor * vec3(.30, .34, .40) * density * shadow * .012;

  float alpha = clamp(1. - trans, 0., 1.);
  alpha = clamp(alpha*(.55 + .45*abs(viewSide)), 0., 1.)*.97;
  if (alpha < .002) discard;
  gl_FragColor = vec4(col, alpha);
}`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 4
  mesh.onBeforeRender = () => {
    ;(mat.uniforms.uLightDir.value as THREE.Vector3).copy(body.pos).negate().normalize()
  }
  return mesh
}
