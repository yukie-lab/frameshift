import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export class RenderStack {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  composer: EffectComposer
  bloom: UnrealBloomPass
  baseFov = 72
  bypassPost = false

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.05, 1e15)
    this.scene.add(this.camera)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envScene = new RoomEnvironment()
    const envTex = pmrem.fromScene(envScene, 0.04).texture
    this.scene.environment = envTex
    this.scene.environmentIntensity = 0.22
    envScene.dispose?.()
    pmrem.dispose()

    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      samples: 4
    })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * .5, window.innerHeight * .5), 0.62, 0.62, 1.02
    )
    this.composer.addPass(this.bloom)
    const gradePass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          vec2 d = uv - .5;
          float r2 = dot(d,d);
          float ca = .0022*r2;
          vec3 col;
          col.r = texture2D(tDiffuse, uv + d*ca).r;
          col.g = texture2D(tDiffuse, uv).g;
          col.b = texture2D(tDiffuse, uv - d*ca).b;
          col *= 1. - r2*.5;
          float g = fract(sin(dot(uv*(uTime+.001), vec2(12.9898,78.233)))*43758.5453);
          col += (g-.5)*.012;
          gl_FragColor = vec4(col, 1.);
        }`
    })
    this.composer.addPass(gradePass)
    this.gradePass = gradePass
    this.composer.addPass(new OutputPass())
  }

  gradePass: ShaderPass

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloom.setSize(w * .5, h * .5)
  }
  render(): void {
    if (this.bypassPost) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    this.gradePass.uniforms.uTime.value = performance.now() % 1000
    this.composer.render()
  }
}
