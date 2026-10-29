import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import Experience from '../Experience.js'

/**
 * Editorial lighting + HDRI environment for leather / coat reflections.
 */
export default class Environment {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.renderer = this.experience.renderer.instance
    this.resources = this.experience.resources
    this.tier = this.experience.tier
    this.debug = this.experience.debug

    this.setIBL()
    this.setLights()
    this.setFog()
    if (this.debug?.active) this.setDebug()
  }

  setIBL() {
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    pmrem.compileEquirectangularShader()

    const hdr = this.resources.items.envHDR
    if (hdr) {
      hdr.mapping = THREE.EquirectangularReflectionMapping
      this.envRT = pmrem.fromEquirectangular(hdr)
      hdr.dispose()
    } else {
      // Fallback procedural room if HDR failed to load
      const room = new RoomEnvironment()
      this.envRT = pmrem.fromScene(room, 0.03)
    }

    this.scene.environment = this.envRT.texture
    // Enough for leather grain / saddle metal cues without washing the dark stage
    this.scene.environmentIntensity = 0.55
    pmrem.dispose()
  }

  setLights() {
    this.key = new THREE.SpotLight(0xf4ecda, 28, 26, Math.PI * 0.2, 0.55, 1.3)
    this.key.position.set(2.0, 6.4, 2.6)
    this.key.target.position.set(0.4, 1.1, 0)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(this.tier.preset.shadowMap, this.tier.preset.shadowMap)
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.03
    this.key.shadow.radius = 6
    this.key.shadow.camera.near = 0.5
    this.key.shadow.camera.far = 22
    this.key.shadow.focus = 1
    this.scene.add(this.key, this.key.target)

    // Cool blue back-rim to match the blue top-centre rays
    this.rim = new THREE.DirectionalLight(0x9cc0ff, 2.6)
    this.rim.position.set(-3.8, 3.2, -4.4)
    this.scene.add(this.rim)

    // Cool overhead beam from top-centre — reinforces the blue vertical rays
    this.topBeam = new THREE.SpotLight(0x9fc2ff, 16, 20, Math.PI * 0.16, 0.5, 1.4)
    this.topBeam.position.set(0.4, 7.2, 0.0)
    this.topBeam.target.position.set(0.4, 0.6, 0.0)
    this.scene.add(this.topBeam, this.topBeam.target)

    this.kicker = new THREE.PointLight(0x8fb4d0, 5.5, 10, 1.8)
    this.kicker.position.set(3.8, 2.2, 3.2)
    this.scene.add(this.kicker)

    this.hemi = new THREE.HemisphereLight(0x263040, 0x08060a, 0.32)
    this.scene.add(this.hemi)
  }

  setFog() {
    this.scene.fog = new THREE.FogExp2(0x08070a, 0.12)
    this.scene.background = null
  }

  setDebug() {
    const f = this.debug.ui.addFolder('Environment')
    f.add(this.scene, 'environmentIntensity', 0, 2, 0.01).name('envIntensity')
    f.add(this.key, 'intensity', 0, 60, 0.1).name('key')
    f.addColor({ c: '#f4ecda' }, 'c').name('key color').onChange((v) => this.key.color.set(v))
    f.add(this.rim, 'intensity', 0, 8, 0.05).name('rim')
    f.addColor({ c: '#e0a870' }, 'c').name('rim color').onChange((v) => this.rim.color.set(v))
    f.add(this.kicker, 'intensity', 0, 20, 0.1).name('kicker')
    f.add(this.hemi, 'intensity', 0, 1, 0.01).name('hemi')
    f.add(this.scene.fog, 'density', 0, 0.4, 0.005).name('fog density')
    f.add(this.experience.renderer.instance, 'toneMappingExposure', 0.2, 2, 0.01).name('exposure')
  }

  destroy() {
    this.envRT?.dispose()
    this.scene.remove(this.key, this.key.target, this.rim, this.kicker, this.hemi)
    this.scene.remove(this.topBeam, this.topBeam.target)
    this.scene.environment = null
    this.scene.fog = null
  }
}
