import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import Experience from './Experience.js'

const FilmGrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVignette: { value: 1.25 },
    uAberration: { value: 0.0012 },
    uShadowTint: { value: new THREE.Color(0x1f2838) }, // cool blue shadows
    uHighlightTint: { value: new THREE.Color(0xf2f6ff) }, // clean cool highlights
    uGradeMix: { value: 0.14 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAberration;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uGradeMix;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float dist = length(dir);

      // Chromatic aberration at frame edges
      float ca = uAberration * dist;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;

      // Split-tone color grade: cool shadows, warm highlights
      float l = clamp(luma(col), 0.0, 1.0);
      vec3 shadow = col * uShadowTint * 1.6;
      vec3 highl  = col * uHighlightTint * 1.05;
      vec3 graded = mix(shadow, highl, smoothstep(0.15, 0.85, l));
      col = mix(col, graded, uGradeMix);

      // Film grain
      float n = hash(uv * vec2(1920.0, 1080.0) + uTime * 60.0) - 0.5;
      col += n * uGrain;

      // Vignette (stronger; the eye should fall on the horse)
      float v = smoothstep(0.9, 0.22, dist * uVignette);
      col *= mix(0.42, 1.0, v);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

/**
 * BokehPass renders the whole scene with an override depth material, so the
 * additive volumetrics (rays, mist, dust) would write depth and make the horse
 * behind them read as "in front". Hide them for the depth pass only.
 */
class VolumetricSafeBokehPass extends BokehPass {
  constructor(scene, camera, params, getExcluded) {
    super(scene, camera, params)
    this.getExcluded = getExcluded
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const excluded = this.getExcluded() || []
    const prev = excluded.map((o) => o.visible)
    excluded.forEach((o) => { o.visible = false })
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)
    excluded.forEach((o, i) => { o.visible = prev[i] })
  }
}

export default class PostProcessing {
  constructor() {
    this.experience = Experience.getInstance()
    this.renderer = this.experience.renderer.instance
    this.scene = this.experience.scene
    this.camera = this.experience.camera.instance
    this.sizes = this.experience.sizes
    this.tier = this.experience.tier
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.enabled = this.tier.preset.bloom

    if (!this.enabled) {
      console.info('[Post] disabled — tier', this.tier.level)
      return
    }

    const rt = new THREE.WebGLRenderTarget(this.sizes.width, this.sizes.height, {
      type: THREE.HalfFloatType,
      samples: this.renderer.capabilities.isWebGL2 ? 4 : 0,
      colorSpace: THREE.NoColorSpace,
    })

    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.setSize(this.sizes.width, this.sizes.height)
    this.composer.setPixelRatio(Math.min(this.sizes.pixelRatio, this.tier.preset.dpr))

    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    // Cinematic depth-of-field — horse sharp, floor + backdrop softly falling off
    if (this.tier.preset.dof) {
      this.dofPass = new VolumetricSafeBokehPass(
        this.scene,
        this.camera,
        { focus: 6.0, aperture: 0.0011, maxblur: 0.0035 },
        () => this.volumetrics()
      )
      this.composer.addPass(this.dofPass)
    }

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.sizes.width, this.sizes.height),
      0.38, // strength — lets the blue rays and rim glow bloom softly
      0.8,  // radius
      0.86  // threshold
    )
    this.composer.addPass(this.bloomPass)

    this.grainPass = new ShaderPass(FilmGrainVignetteShader)
    this.composer.addPass(this.grainPass)

    // MSAA above already handles AA in WebGL2. SMAA fallback for WebGL1.
    if (!this.renderer.capabilities.isWebGL2) {
      this.smaaPass = new SMAAPass(this.sizes.width, this.sizes.height)
      this.composer.addPass(this.smaaPass)
    }

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    if (this.debug?.active) this.setDebug()

    console.info(
      '[Post] tier', this.tier.level,
      '· passes:', this.composer.passes.map((p) => p.constructor.name).join(' → ')
    )
  }

  /** Additive/transparent atmosphere meshes that must not pollute the DOF depth. */
  volumetrics() {
    const w = this.experience.world
    if (!w) return []
    return [w.shaft?.mesh, w.mist?.group, w.particles?.points].filter(Boolean)
  }

  setDebug() {
    const f = this.debug.ui.addFolder('Post')
    if (this.dofPass) {
      f.add(this.dofPass.uniforms.aperture, 'value', 0, 0.01, 0.0001).name('dof aperture')
      f.add(this.dofPass.uniforms.maxblur, 'value', 0, 0.02, 0.0005).name('dof maxblur')
    }
    f.add(this.bloomPass, 'strength', 0, 2, 0.01).name('bloom strength')
    f.add(this.bloomPass, 'threshold', 0, 1, 0.01).name('bloom threshold')
    f.add(this.bloomPass, 'radius', 0, 2, 0.01).name('bloom radius')
    f.add(this.grainPass.uniforms.uGrain, 'value', 0, 0.15, 0.001).name('grain')
    f.add(this.grainPass.uniforms.uVignette, 'value', 0, 2, 0.01).name('vignette')
    f.add(this.grainPass.uniforms.uAberration, 'value', 0, 0.01, 0.0001).name('aberration')
  }

  resize() {
    if (!this.enabled) return
    this.composer.setSize(this.sizes.width, this.sizes.height)
    this.composer.setPixelRatio(Math.min(this.sizes.pixelRatio, this.tier.preset.dpr))
    this.bloomPass.setSize(this.sizes.width, this.sizes.height)
    this.dofPass?.setSize(this.sizes.width, this.sizes.height)
  }

  render() {
    if (!this.enabled) return
    if (this.grainPass) this.grainPass.uniforms.uTime.value = this.time.elapsed
    if (this.dofPass) {
      // Keep the focal plane locked on whatever the camera is looking at
      const d = this.experience.camera.focusDistance
      const u = this.dofPass.uniforms.focus
      u.value += (d - u.value) * 0.08
    }
    this.composer.render()
  }

  destroy() {
    this.composer?.passes?.forEach(p => p.dispose?.())
    this.composer?.dispose?.()
  }
}
