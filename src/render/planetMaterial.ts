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
    f += a*snoise(p); n += a; p = p*2.03 + vec3(5.17,9.31,2.73); a *= .5;
  }
  return f/max(n, 1e-5);
}
float ridged(vec3 p, int oct){
  float f = 0.; float a = .5; float n = 0.;
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    f += a*(1.-abs(snoise(p))); n += a; p = p*2.13 + vec3(3.19,7.41,1.87); a *= .5;
  }
  return f/max(n, 1e-5);
}
vec3 hash33(vec3 p){
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx)*p.zyx);
}
float craterField(vec3 p, float rmin, float rspan, float thresh){
  vec3 c0 = floor(p - .5);
  float acc = 0.;
  for(int x=0;x<2;x++)
  for(int y=0;y<2;y++)
  for(int z=0;z<2;z++){
    vec3 cell = c0 + vec3(float(x), float(y), float(z));
    vec3 o = hash33(cell);
    if (o.x < thresh) continue;
    float rad = rmin + rspan*o.z*o.z;
    float d = length(cell + o - p) / rad;
    if (d > 1.) continue;
    float bowl = -(1. - smoothstep(0., .74, d));
    float rim = exp(-pow((d - .86)/.15, 2.));
    float amp = .30 + .70*o.y;
    acc += (bowl*.80 + rim*.95) * amp;
  }
  return acc;
}`

const VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vCen;
varying vec3 vPlaneN;
void main(){
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWp = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * normal);
  vCen = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
  vPlaneN = normalize(mat3(modelMatrix) * vec3(0., 1., 0.));
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`

const SURF_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform float uSeed;
uniform float uTime;
uniform float uDetail;
uniform float uRingInner;
uniform float uRingOuter;
uniform float uRadius;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uColC;
uniform vec3 uAtmoTint;
uniform float uBandK;
uniform float uTurb;
uniform float uStormL;
uniform float uStormLat;
uniform float uStormW;
uniform float uStormH;
varying vec3 vObj;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vCen;
varying vec3 vPlaneN;
${NOISE}

float terrainH(vec3 p, float seed, float detail){
  float h = fbm(p*2.4 + seed, 5)*.62 + ridged(p*4.1 + seed*1.3, 4)*.38;
  h += craterField(p*5.6 + seed*3.1, .21, .26, .52) * .32;
  if (detail > .04) {
    h += craterField(p*15.0 + seed*1.7, .19, .24, .66) * .14 * detail;
    h += fbm(p*34. + seed*2.2, 3) * .045 * detail;
  }
  return h;
}

vec3 bumpNormal(vec3 N, vec3 V, vec3 wp, float h, float scale){
  float graze = smoothstep(.02, .30, dot(N, V));
  if (graze <= 0.) return N;
  vec3 dpx = dFdx(wp);
  vec3 dpy = dFdy(wp);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpy, N);
  vec3 r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  if (abs(det) < 1e-12) return N;
  vec3 grad = (dhx*r1 + dhy*r2) / det;
  vec3 p = N - grad*scale*graze;
  float l = length(p);
  return l > 1e-9 ? p/l : N;
}

void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vNw);
  vec3 V = normalize(-vWp);
  vec3 L = normalize(uLightDir);
  vec3 sp = normalize(vObj);
  float lat = asin(clamp(sp.y, -1., 1.));
  float lon = atan(sp.z, sp.x);
  vec3 col = vec3(0.);
  vec3 shN = N;
  float amb = 0.0035;

#ifdef TYPE_EARTHLIKE
  float cont = fbm(sp*1.9 + uSeed, 5)*.5 + .5;
  float detailH = fbm(sp*6.4 + uSeed*1.9, 4)*.5 + .5;
  float hn = cont*.72 + detailH*.28;
  float shore = smoothstep(.485, .512, hn);
  float land = smoothstep(.500, .560, hn);
  float depth = smoothstep(.50, .26, hn);
  vec3 deepC = vec3(.006, .028, .075);
  vec3 shelfC = vec3(.020, .132, .215);
  vec3 oceanC = mix(shelfC, deepC, depth);
  float elev = smoothstep(.50, .78, hn);
  float arid = fbm(sp*3.1 - uSeed*2.3, 4)*.5 + .5;
  float latAbs = abs(lat)*57.2958;
  float desertBand = exp(-pow((latAbs - 25.)/13., 2.));
  float boreal = smoothstep(42., 62., latAbs);
  vec3 forest = vec3(.085, .155, .072);
  vec3 steppe = vec3(.235, .215, .120);
  vec3 sand = vec3(.480, .375, .215);
  vec3 rockC = vec3(.235, .208, .180);
  vec3 landC = mix(forest, steppe, smoothstep(.40, .66, arid));
  landC = mix(landC, sand, clamp(desertBand*1.15*smoothstep(.44, .70, arid), 0., 1.));
  landC = mix(landC, vec3(.108, .132, .085), boreal*.55);
  landC = mix(landC, rockC, elev*.55);
  float snowLine = .58 + .30*(1. - boreal) - .10*desertBand;
  float snow = smoothstep(snowLine, snowLine + .09, hn) * (.35 + .65*boreal);
  float polar = smoothstep(.68, .84, abs(sp.y) + (fbm(sp*4.2 + uSeed, 4)*.5+.5)*.10);
  float ice = clamp(max(snow, polar*(land*.55 + .45)), 0., 1.);
  vec3 alb = mix(oceanC, landC, land);
  alb = mix(alb, vec3(.760, .800, .845), ice);
  float hgt = (land > .02 ? hn : .5);
  shN = bumpNormal(N, V, vWp, hgt, uRadius*.10*uDetail*land);
  float nl = dot(shN, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.09, .16, nl);
  vec3 H = normalize(L + V);
  float ocean = (1. - land)*(1. - ice);
  float rough = .030 + .05*(fbm(sp*90. + uSeed, 1)*.5+.5);
  float ndh = max(dot(N, H), 0.);
  float glint = pow(ndh, 2./(rough*rough)) * ocean * soft;
  float fres = .02 + .98*pow(1. - max(dot(N, V), 0.), 5.);
  float lights = smoothstep(.55, .86, fbm(sp*17. + uSeed*2.7, 4)*.5+.5)
               * land * (1. - ice) * smoothstep(.10, .035, abs(hn - .545))
               * smoothstep(.55, .18, latAbs/90.);
  float night = smoothstep(.05, -.16, nl);
  col = alb * (soft*dif*1.05 + amb) * uSunColor;
  col += uSunColor * glint * fres * 26.;
  col += vec3(1., .68, .30) * lights * night * 1.35;
#elif defined(TYPE_ROCKY)
  float h = terrainH(sp, uSeed, uDetail);
  float basin = fbm(sp*1.3 + uSeed*.7, 3)*.5 + .5;
  vec3 alb = mix(uTintA, uTintB, smoothstep(.35, .70, fbm(sp*2.7 + uSeed, 4)*.5+.5));
  alb = mix(alb, uTintA*.58, smoothstep(.38, .62, basin)*.70);
  alb *= .80 + .34*smoothstep(-.25, .45, h);
  alb *= .92 + .16*(fbm(sp*44. + uSeed*2.1, 2)*.5+.5);
  shN = bumpNormal(N, V, vWp, h, uRadius*(.030 + .055*uDetail));
  float nl = dot(shN, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.055, .085, nl);
  float ndv = max(dot(shN, V), 0.);
  float backsc = pow(clamp(dot(L, V), 0., 1.), 3.) * .22;
  col = alb * uSunColor * (soft*(dif*(1. - .28*ndv) + backsc) + amb*1.4);
#elif defined(TYPE_WATER)
  float wv = fbm(sp*2.2 + uSeed, 5)*.5 + .5;
  float shallow = smoothstep(.44, .60, wv);
  vec3 alb = mix(vec3(.005, .022, .062), vec3(.030, .190, .265), shallow);
  float polar = smoothstep(.70, .85, abs(sp.y) + (fbm(sp*4.4 + uSeed, 4)*.5+.5)*.11);
  float berg = smoothstep(.62, .78, fbm(sp*9. + uSeed*3., 4)*.5+.5)*polar;
  alb = mix(alb, vec3(.78, .84, .89), clamp(polar*.85 + berg*.4, 0., 1.));
  float nl = dot(N, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.09, .16, nl);
  vec3 H = normalize(L + V);
  float rough = .024 + .04*(fbm(sp*110. + uSeed, 1)*.5+.5);
  float glint = pow(max(dot(N, H), 0.), 2./(rough*rough)) * (1. - polar) * soft;
  float fres = .02 + .98*pow(1. - max(dot(N, V), 0.), 5.);
  col = alb * uSunColor * (soft*dif*1.02 + amb);
  col += uSunColor * glint * fres * 34.;
#elif defined(TYPE_GAS)
  float warp = fbm(vec3(sp.x*2.2, sp.y*7.5, sp.z*2.2) + uSeed, 5) * uTurb;
  float shear = fbm(vec3(sp.x*5.5, sp.y*20., sp.z*5.5) + uSeed*1.7, 4) * uTurb * .42;
  float latW = lat + warp*.26 + shear*.08;
  float band = sin(latW*uBandK) * .5 + .5;
  float band2 = sin(latW*uBandK*2.37 + 1.1) * .5 + .5;
  vec3 alb = mix(uTintA, uTintB, smoothstep(.04, .96, band));
  alb = mix(alb, uColC*.80, smoothstep(.55, .97, band2)*.46);
  alb *= .78 + .44*(fbm(vec3(sp.x*7., latW*26., sp.z*7.) + uSeed, 4)*.5+.5);
  alb *= .86 + .28*(fbm(vec3(sp.x*17., latW*58., sp.z*17.) + uSeed*2.3, 4)*.5+.5);
  alb *= .92 + .16*(ridged(vec3(sp.x*11., latW*90., sp.z*11.) + uSeed*3.1, 3));
  float hood = smoothstep(.62, .92, abs(sp.y));
  alb = mix(alb, mix(uTintA, uColC, .5)*.72, hood*.65);
  float dLon = lon - uStormL;
  dLon = atan(sin(dLon), cos(dLon));
  float sw = atan(dLon/uStormW, (lat - uStormLat)/uStormH);
  float ell = length(vec2(dLon/uStormW, (lat - uStormLat)/uStormH));
  float swirlN = fbm(vec3(cos(sw + ell*3.4)*2., sin(sw + ell*3.4)*2., ell*3.) + uSeed, 4)*.5+.5;
  float swirl = smoothstep(1., .18, ell);
  alb = mix(alb, uColC*(.82 + .5*swirlN), swirl*.88);
  float nl = dot(N, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.14, .22, nl);
  float mu = clamp(dot(N, V), 0., 1.);
  alb *= .40 + .60*pow(mu, .42);
  col = alb * uSunColor * (soft*pow(dif, .78)*1.06 + amb*2.);
#elif defined(TYPE_ICE)
  float h = fbm(sp*2.6 + uSeed, 4)*.55 + ridged(sp*5.5 + uSeed*1.4, 4)*.45;
  h += craterField(sp*7.6 + uSeed*2.7, .20, .25, .62)*.24;
  float crk = ridged(sp*7.3 + uSeed*2.1, 4);
  float fracture = smoothstep(.72, .93, crk);
  vec3 alb = mix(vec3(.545, .655, .760), vec3(.900, .935, .975), smoothstep(.30, .70, fbm(sp*3.3 + uSeed, 5)*.5+.5));
  alb = mix(alb, vec3(.230, .360, .500), fracture*.72);
  alb *= .90 + .18*(fbm(sp*40. + uSeed, 2)*.5+.5);
  shN = bumpNormal(N, V, vWp, h - fracture*.35, uRadius*(.022 + .04*uDetail));
  float nl = dot(shN, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.05, .08, nl);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(shN, H), 0.), 60.) * soft * .35;
  float sss = pow(clamp(dot(-L, V)*.5 + .5, 0., 1.), 2.) * .10;
  col = alb * uSunColor * (soft*dif*1.10 + amb*2.2 + sss);
  col += uSunColor * spec;
#elif defined(TYPE_LAVA)
  float h = fbm(sp*3.0 + uSeed, 5)*.6 + ridged(sp*6.5 + uSeed*1.5, 4)*.4;
  float plate = fbm(sp*2.2 - uSeed, 4)*.5 + .5;
  float vein = ridged(sp*4.4 + uSeed, 4);
  float crackv = smoothstep(.86, .965, vein) * smoothstep(.28, .58, plate);
  float crackFine = smoothstep(.90, .985, ridged(sp*15. + uSeed*1.8, 3)) * .55;
  float pools = smoothstep(.80, .95, fbm(sp*3.6 + uSeed*2.9, 4)*.5+.5) * .40;
  float hot = clamp(crackv + crackFine*.55 + pools, 0., 1.);
  vec3 alb = mix(vec3(.028, .024, .022), vec3(.085, .070, .062), smoothstep(.35, .70, plate));
  alb *= .82 + .30*(fbm(sp*28. + uSeed, 2)*.5+.5);
  shN = bumpNormal(N, V, vWp, h, uRadius*(.030 + .05*uDetail));
  float nl = dot(shN, L);
  float dif = clamp(nl, 0., 1.);
  float soft = smoothstep(-.05, .09, nl);
  float pulse = .78 + .22*sin(uTime*.35 + fbm(sp*5. + uSeed, 3)*11.);
  vec3 emis = vec3(3.4, .52, .055) * hot * pulse;
  emis += vec3(2.6, 1.55, .38) * pow(hot, 3.2) * pulse * .75;
  col = alb * uSunColor * (soft*dif*1.05 + amb*3.) + emis;
#endif

#ifdef RINGED
  vec3 relC = vWp - vCen;
  float hh = dot(relC, vPlaneN);
  float denom = dot(L, vPlaneN);
  if (abs(denom) > 1e-4) {
    float tt = -hh/denom;
    if (tt > 0.) {
      vec3 hitP = relC + L*tt;
      float rr = length(hitP - vPlaneN*dot(hitP, vPlaneN));
      float t = clamp((rr - uRingInner)/(uRingOuter - uRingInner), 0., 1.);
      float inB = smoothstep(uRingInner*.985, uRingInner*1.07, rr) * (1. - smoothstep(uRingOuter*.93, uRingOuter, rr));
      inB *= smoothstep(.010, .055, abs(t - .32));
      inB *= smoothstep(.008, .045, abs(t - .61));
      col *= mix(1., .22, inB*.88);
    }
  }
#endif
  gl_FragColor = vec4(col, 1.);
}`

const CLOUD_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform float uSeed;
uniform float uTime;
uniform float uCov;
uniform float uSpin;
varying vec3 vObj;
varying vec3 vNw;
varying vec3 vWp;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vNw);
  vec3 V = normalize(-vWp);
  vec3 L = normalize(uLightDir);
  float ang = uTime*uSpin;
  float ca = cos(ang), sa = sin(ang);
  vec3 sp = normalize(vObj);
  vec3 rot = vec3(ca*sp.x + sa*sp.z, sp.y, -sa*sp.x + ca*sp.z);

  float lat = asin(clamp(rot.y, -1., 1.));
  float itcz = (exp(-pow(lat*3.4, 2.))*.085 + exp(-pow((abs(lat) - .95)*3.2, 2.))*.065)
             * (.35 + .65*(fbm(rot*4.7 + uSeed*3.3, 4)*.5+.5));
  vec3 warp = vec3(fbm(rot*2.1 + uSeed, 4), fbm(rot*2.1 + uSeed + 11., 4), fbm(rot*2.1 + uSeed + 23., 4))*.28;
  float base = fbm(rot*3.1 + warp + uSeed*1.3, 6)*.5 + .5;
  float detail = fbm(rot*11.5 + warp*2. + uSeed*2.1, 5)*.5 + .5;
  float cn = base*.68 + detail*.32 + itcz;
  float cov = uCov - itcz*.5;
  float alpha = smoothstep(cov, cov + .17, cn);
  alpha *= alpha*(3. - 2.*alpha);

  float nl = dot(N, L);
  float day = smoothstep(-.16, .20, nl);
  float thick = smoothstep(cov, cov + .40, cn);
  float selfShadow = mix(1., .58, thick*(1. - clamp(nl, 0., 1.)*.6));
  float fwd = pow(clamp(dot(-L, V), 0., 1.), 3.)*.35;
  vec3 col = uSunColor * (vec3(1., .995, .975) * (day*(.92*selfShadow + fwd) + .0045));
  gl_FragColor = vec4(col, min(alpha, .92));
}`

const ATMO_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWp;
varying vec3 vCen;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWp = wp.xyz;
  vCen = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`

const ATMO_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform vec3 uColor;
uniform vec3 uSunset;
uniform float uPlanetR;
uniform float uAtmoR;
uniform float uStrength;
varying vec3 vWp;
varying vec3 vCen;
void main(){
  #include <logdepthbuf_fragment>
  vec3 rd = normalize(vWp);
  vec3 oc = -vCen / uPlanetR;
  float RaN = uAtmoR / uPlanetR;
  float b = dot(oc, rd);
  vec3 perp = oc - rd*b;
  float h = length(perp);
  if (h >= RaN) discard;
  float chordA = sqrt(max(RaN*RaN - h*h, 1e-7));
  bool hitsBody = (h < 1.) && (b < 0.);
  float tEnter = -b - chordA;
  float tExit = hitsBody ? (-b - sqrt(max(1. - h*h, 0.))) : (-b + chordA);
  float path = max(tExit - tEnter, 0.);
  float alt = max(h, 1.) - 1.;
  float H = max((RaN - 1.)*.42, 1e-4);
  float dens = exp(-alt/H);
  float optical = clamp(path*dens*uStrength, 0., 1.6);

  vec3 pRef = hitsBody ? (oc + rd*tExit) : (oc + rd*(.5*(tEnter + tExit)));
  vec3 nAt = normalize(pRef);
  vec3 L = normalize(uLightDir);
  float mu = dot(nAt, L);
  float day = smoothstep(-.30, .20, mu);
  float twil = exp(-pow(mu*3.1, 2.));
  float cosT = dot(rd, L);
  float rayleigh = .75*(1. + cosT*cosT);
  float mie = pow(clamp(cosT, 0., 1.), 14.);

  vec3 col = uColor * optical * day * rayleigh * .78;
  col += uSunset * optical * twil * smoothstep(-.30, .10, mu) * .85;
  col += uColor * optical * mie * day * .30;
  gl_FragColor = vec4(col * uSunColor, 1.);
}`

const GAS_PALETTES: [number[], number[], number[]][] = [
  [[206, 176, 133], [128, 96, 66], [186, 92, 52]],
  [[222, 203, 158], [168, 143, 96], [158, 112, 54]],
  [[92, 124, 196], [42, 72, 140], [150, 184, 240]],
  [[150, 206, 214], [102, 164, 180], [206, 238, 240]],
  [[190, 146, 112], [118, 78, 62], [232, 196, 160]],
  [[176, 168, 150], [104, 100, 92], [214, 178, 128]]
]

function c3(rgb: number[]): THREE.Color {
  return new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
}

const TYPE_DEFINE: Record<string, string> = {
  earthlike: 'TYPE_EARTHLIKE',
  rocky: 'TYPE_ROCKY',
  water: 'TYPE_WATER',
  gas: 'TYPE_GAS',
  ice: 'TYPE_ICE',
  lava: 'TYPE_LAVA'
}

interface AtmoSpec {
  radius: number
  color: THREE.Color
  sunset: THREE.Color
  strength: number
}

function atmoSpec(body: CelestialBody, rand: () => number): AtmoSpec | null {
  switch (body.type) {
    case 'earthlike':
      return {
        radius: 1.028,
        color: body.atmoColor ?? new THREE.Color(.24, .46, 1.0),
        sunset: new THREE.Color(1.0, .40, .16),
        strength: 1.55
      }
    case 'water':
      return {
        radius: 1.030,
        color: body.atmoColor ?? new THREE.Color(.22, .50, 1.0),
        sunset: new THREE.Color(1.0, .46, .20),
        strength: 1.70
      }
    case 'gas':
      return {
        radius: 1.045,
        color: body.atmoColor ?? new THREE.Color(.52, .60, .88).lerp(new THREE.Color(.88, .74, .52), rand()),
        sunset: new THREE.Color(1.0, .62, .30),
        strength: 1.25
      }
    case 'lava':
      return {
        radius: 1.022,
        color: body.atmoColor ?? new THREE.Color(.62, .26, .12),
        sunset: new THREE.Color(1.0, .34, .10),
        strength: .85
      }
    default:
      return null
  }
}

export function createPlanetMesh(body: CelestialBody, rand: () => number, starTint?: THREE.Color): THREE.Group {
  const group = new THREE.Group()
  const seed = rand() * 18
  const sunColor = (starTint ?? new THREE.Color(1, 1, 1)).clone().lerp(new THREE.Color(1, 1, 1), .55)
  const uniforms: Record<string, THREE.IUniform> = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunColor: { value: sunColor },
    uSeed: { value: seed },
    uTime: { value: 0 },
    uDetail: { value: 0 },
    uRadius: { value: body.radiusM },
    uRingInner: { value: body.hasRings ? body.ringInnerM : 0 },
    uRingOuter: { value: body.hasRings ? body.ringOuterM : 0 },
    uTintA: { value: new THREE.Color(.5, .5, .5) },
    uTintB: { value: new THREE.Color(.6, .6, .6) },
    uColC: { value: new THREE.Color(.7, .7, .7) },
    uAtmoTint: { value: new THREE.Color(.5, .6, .9) },
    uBandK: { value: 9 },
    uTurb: { value: .3 },
    uStormL: { value: 0 },
    uStormLat: { value: 0 },
    uStormW: { value: .25 },
    uStormH: { value: .1 }
  }
  if (body.type === 'gas') {
    const pal = GAS_PALETTES[Math.floor(rand() * GAS_PALETTES.length)]
    ;(uniforms.uTintA.value as THREE.Color).copy(c3(pal[0]))
    ;(uniforms.uTintB.value as THREE.Color).copy(c3(pal[1]))
    ;(uniforms.uColC.value as THREE.Color).copy(c3(pal[2]))
    uniforms.uBandK.value = 11 + Math.floor(rand() * 11)
    uniforms.uTurb.value = .10 + rand() * .13
    uniforms.uStormL.value = rand() * Math.PI * 2
    uniforms.uStormLat.value = (rand() - .5) * .9
    uniforms.uStormW.value = .17 + rand() * .16
    uniforms.uStormH.value = .07 + rand() * .06
  } else if (body.type === 'rocky') {
    const roll = rand()
    const pair: [THREE.Color, THREE.Color] =
      roll < .34 ? [new THREE.Color(.330, .190, .128), new THREE.Color(.520, .340, .228)]
        : roll < .67 ? [new THREE.Color(.215, .205, .195), new THREE.Color(.415, .400, .380)]
          : [new THREE.Color(.290, .250, .200), new THREE.Color(.470, .430, .360)]
    ;(uniforms.uTintA.value as THREE.Color).copy(pair[0])
    ;(uniforms.uTintB.value as THREE.Color).copy(pair[1])
  }

  const segs = body.radiusM > 2e7 ? 128 : 96
  const surfMat = new THREE.ShaderMaterial({
    defines: {
      [TYPE_DEFINE[body.type]]: 1,
      ...(body.hasRings ? { RINGED: 1 } : {})
    },
    uniforms,
    vertexShader: VERT,
    fragmentShader: SURF_FRAG
  })
  const surface = new THREE.Mesh(new THREE.SphereGeometry(body.radiusM, segs, segs / 2), surfMat)
  group.add(surface)
  body.mesh = surface

  const lightTargets: Record<string, THREE.IUniform>[] = [uniforms]

  if (body.type === 'earthlike' || body.type === 'water') {
    const cloudUniforms: Record<string, THREE.IUniform> = {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: sunColor },
      uSeed: { value: seed * 1.7 + 3.1 },
      uTime: { value: 0 },
      uCov: { value: body.cloudDensity ?? .52 },
      uSpin: { value: .004 + rand() * .006 }
    }
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(body.radiusM * 1.010, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: cloudUniforms,
        vertexShader: VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false
      })
    )
    group.add(clouds)
    body.cloudMesh = clouds
    lightTargets.push(cloudUniforms)
  }

  const spec = atmoSpec(body, rand)
  if (spec) {
    const atmoUniforms: Record<string, THREE.IUniform> = {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: sunColor },
      uColor: { value: spec.color },
      uSunset: { value: spec.sunset },
      uPlanetR: { value: body.radiusM },
      uAtmoR: { value: body.radiusM * spec.radius },
      uStrength: { value: spec.strength }
    }
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(body.radiusM * spec.radius, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: atmoUniforms,
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      })
    )
    atmo.renderOrder = 5
    group.add(atmo)
    lightTargets.push(atmoUniforms)
  }

  group.rotation.z = body.axialTilt

  const dir = new THREE.Vector3()
  const refresh = () => {
    dir.copy(body.pos).negate()
    const len = dir.length()
    if (len > 1e-6) dir.divideScalar(len)
    else dir.set(1, 0, 0)
    const t = performance.now() / 1000
    const rel = group.position.length()
    const detail = THREE.MathUtils.clamp(1 - rel / (body.radiusM * 16), 0, 1)
    for (const u of lightTargets) {
      ;(u.uLightDir.value as THREE.Vector3).copy(dir)
      if (u.uTime) u.uTime.value = t
      if (u.uDetail) u.uDetail.value = detail
    }
  }
  surface.onBeforeRender = refresh
  for (const child of group.children) {
    if (child !== surface) (child as THREE.Mesh).onBeforeRender = refresh
  }

  return group
}
