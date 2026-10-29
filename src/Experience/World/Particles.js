import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Floating dust motes: additive-blended sprites with soft radial alpha,
 * drifting slowly, catching the warm key light. Count scales with tier.
 */
export default class Particles {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.tier = this.experience.tier

    this.count = this.tier.preset.particles
    this.geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(this.count * 3)
    const seeds = new Float32Array(this.count)
    const scales = new Float32Array(this.count)
    for (let i = 0; i < this.count; i++) {
      const r = 1.5 + Math.random() * 4.5
      const a = Math.random() * Math.PI * 2
      positions[i * 3 + 0] = Math.cos(a) * r
      positions[i * 3 + 1] = 0.2 + Math.random() * 4.5
      positions[i * 3 + 2] = Math.sin(a) * r
      seeds[i] = Math.random() * 1000
      scales[i] = 0.5 + Math.random() * 1.5
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    this.geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 26 * this.experience.sizes.pixelRatio },
        // Cool moonlit dust — subtle blue-white, no golden speckles
        uColorCore: { value: new THREE.Color(0xdfe9ff) },
        uColorEdge: { value: new THREE.Color(0x6f86b8) },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aScale;
        uniform float uTime;
        uniform float uSize;
        varying float vLife;
        varying float vTwinkle;
        void main() {
          vec3 pos = position;
          float t = uTime * 0.3 + aSeed;
          pos.x += sin(t * 0.6) * 0.28;
          pos.z += cos(t * 0.8) * 0.28;
          pos.y += mod(uTime * 0.08 + aSeed * 0.02, 5.0) * 0.6;
          pos.y = mod(pos.y, 5.2);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aScale * (1.0 / -mv.z);

          // Fade in at bottom + out near top for a seamless loop
          vLife = smoothstep(0.0, 0.6, pos.y) * (1.0 - smoothstep(3.8, 5.2, pos.y));
          // Gentle per-particle twinkle
          vTwinkle = 0.6 + 0.4 * sin(uTime * 1.5 + aSeed);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        varying float vTwinkle;
        uniform vec3 uColorCore;
        uniform vec3 uColorEdge;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          // Soft round mote with a brighter core
          float a = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.28, 0.0, d);
          vec3 c = mix(uColorEdge, uColorCore, core);
          a *= vLife * vTwinkle;
          gl_FragColor = vec4(c, a * 0.28);
          if (a < 0.01) discard;
        }
      `,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.scene.add(this.points)
  }

  update() {
    this.material.uniforms.uTime.value = this.time.elapsed
  }

  destroy() {
    this.scene.remove(this.points)
    this.geometry.dispose()
    this.material.dispose()
  }
}
