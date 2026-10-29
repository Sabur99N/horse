import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Fake volumetric light rays: a camera-facing, additive-blended plane with
 * scrolling noise, pinned above the horse and beaming straight DOWN from the
 * top-centre. Cool blue tone (moonlit / stage-beam), not golden.
 */
export default class LightShaft {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.camera = this.experience.camera.instance
    this.time = this.experience.time

    // Tall + narrower cone so it reads as a vertical shaft from the top
    const geometry = new THREE.PlaneGeometry(3.0, 7.6, 1, 1)
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        // Cool blue rays
        uColor: { value: new THREE.Color(0x8fb6ff) },
        uStrength: { value: 0.26 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.,0.));
          float c = hash(i + vec2(0.,1.));
          float d = hash(i + vec2(1.,1.));
          vec2 u = f*f*(3.-2.*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
        }

        void main() {
          // Cone: tight column at the top, spreads slightly toward the floor
          float spread = mix(0.30, 0.5, vUv.y);
          float edge = 1.0 - smoothstep(spread - 0.28, spread, abs(vUv.x - 0.5));
          // Brightest at the top (source), fading down
          float top = pow(1.0 - vUv.y, 1.5);
          // Vertical streaky god-ray noise
          float rays = noise(vec2(vUv.x * 8.0, vUv.y * 2.0 - uTime * 0.15));
          float n = noise(vec2(vUv.x * 3.0, vUv.y * 5.0 - uTime * 0.3));
          n = mix(0.5, n, 0.75);
          float a = edge * top * (0.35 + n * 0.6) * (0.55 + rays * 0.6) * uStrength;
          gl_FragColor = vec4(uColor, a);
          if (a < 0.005) discard;
        }
      `,
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    // Top-centre, directly above the horse, straight vertical (no tilt)
    this.mesh.position.set(0.4, 3.9, 0.0)
    this.scene.add(this.mesh)
  }

  update() {
    this.material.uniforms.uTime.value = this.time.elapsed
    // Billboard around Y only so the vertical beam always faces the camera
    this.mesh.lookAt(this.camera.position.x, this.mesh.position.y, this.camera.position.z)
  }

  destroy() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
