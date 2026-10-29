import * as THREE from 'three'
import Experience from './Experience.js'

export default class Renderer {
  constructor() {
    this.experience = Experience.getInstance()
    this.canvas = this.experience.canvas
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.tier = this.experience.tier

    this.setInstance()
    this.setContextLoss()
  }

  setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    })

    this.instance.outputColorSpace = THREE.SRGBColorSpace
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.05

    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap
    this.instance.shadowMap.autoUpdate = false // baked-ish: we needsUpdate once after horse loads

    this.instance.setClearColor('#0a0806', 1)
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, this.tier.preset.dpr))
  }

  setContextLoss() {
    this.canvas.addEventListener('webglcontextlost', this.onContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored)
  }

  onContextLost = (e) => {
    e.preventDefault()
    this.experience.time.running = false
    console.warn('[Renderer] context lost')
  }

  onContextRestored = () => {
    console.info('[Renderer] context restored')
    this.experience.time.running = true
    if (this.experience.world?.horse?.mesh) {
      this.instance.shadowMap.needsUpdate = true
    }
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, this.tier.preset.dpr))
  }

  update() {
    if (this.experience.post?.enabled) {
      this.experience.post.render()
    } else {
      this.instance.render(this.scene, this.camera.instance)
    }
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    this.instance.dispose()
    this.instance.forceContextLoss?.()
  }
}
