import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Ground mist / halka dhuan.
 *
 * Three horizontal fbm-noise planes stacked just above the floor. Each layer
 * drifts at a different speed and scale, so together they read as slow rolling
 * smoke instead of a flat texture. Soft-additive, radially faded at the rim so
 * the mist dissolves before it reaches the floor's edge, and depth-faded at the
 * horizon so it never shows a hard silhouette line.
 */
export default class Mist {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.debug = this.experience.debug

    this.group = new THREE.Group()
    this.layers = []

    const layerConfig = [
      { y: 0.05, radius: 9.5, scale: 1.0, speed: 0.020, opacity: 0.26, tint: 0xc2d2ea },
      { y: 0.26, radius: 8.8, scale: 1.6, speed: -0.028, opacity: 0.2, tint: 0xb0c4e4 },
      { y: 0.55, radius: 8.0, scale: 2.4, speed: 0.038, opacity: 0.15, tint: 0xa2b9dd },
      { y: 0.95, radius: 7.2, scale: 3.4, speed: -0.05, opacity: 0.09, tint: 0x9ab2d8 },
    ]

    const budget = this.experience.tier?.preset?.mistLayers ?? 3
    for (const cfg of layerConfig.slice(0, budget)) this.addLayer(cfg)

    this.group.position.x = 0.35
    this.scene.add(this.group)

    if (this.debug?.active) this.setDebug()
  }

  addLayer({ y, radius, scale, speed, opacity, tint }) {
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1)

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: scale },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(tint) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uTime;
        uniform float uScale;
        uniform float uSpeed;
        uniform float uOpacity;
        uniform vec3 uColor;

        vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
        }

        // Gradient noise — smoother than value noise, no visible grid
        float gnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
            mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += amp * gnoise(p);
            p = rot * p * 2.02;
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 p = vUv * 6.0 * uScale;
          float t = uTime * uSpeed;

          // Domain warp: the mist curls in on itself as it drifts
          vec2 warp = vec2(fbm(p + vec2(t, -t * 0.7)), fbm(p + vec2(4.7 - t, 2.3)));
          float n = fbm(p + warp * 1.6 + vec2(-t * 1.4, t * 0.5));
          n = smoothstep(-0.25, 0.5, n);

          // Radial dissolve so the plane edges never show
          float d = length(vUv - 0.5) * 2.0;
          float rim = 1.0 - smoothstep(0.35, 0.95, d);

          // Grazing-angle build-up: looking along the sheet the eye travels
          // through more fog, looking down at it there is almost none. This is
          // what stops flat planes from reading as painted-on texture.
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float graze = 1.0 - abs(viewDir.y);
          graze = pow(clamp(graze, 0.0, 1.0), 2.2);

          float alpha = n * rim * graze * uOpacity;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = y
    mesh.renderOrder = 2
    this.group.add(mesh)
    this.layers.push({ mesh, material })
  }

  setDebug() {
    const f = this.debug.ui.addFolder('Mist')
    this.layers.forEach(({ material }, i) => {
      f.add(material.uniforms.uOpacity, 'value', 0, 1, 0.01).name(`layer ${i} opacity`)
      f.add(material.uniforms.uSpeed, 'value', -0.15, 0.15, 0.001).name(`layer ${i} speed`)
    })
  }

  update() {
    const t = this.time.elapsed
    for (const { material } of this.layers) {
      material.uniforms.uTime.value = t
    }
  }

  destroy() {
    for (const { mesh, material } of this.layers) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
    }
    this.scene.remove(this.group)
    this.layers = []
  }
}
