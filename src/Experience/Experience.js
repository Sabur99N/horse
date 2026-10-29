import * as THREE from 'three'
import EventEmitter from './Utils/EventEmitter.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Debug from './Utils/Debug.js'
import Resources from './Utils/Resources.js'
import sources from './sources.js'
import TierController from './Tier.js'
import Renderer from './Renderer.js'
import Camera from './Camera.js'
import World from './World/World.js'
import PostProcessing from './PostProcessing.js'
import Audio from './Audio.js'
import Hotspots from './Hotspots.js'
import UI from './UI.js'
import ScrollNarrative from './ScrollNarrative.js'

let _instance = null

export default class Experience extends EventEmitter {
  static getInstance() { return _instance }

  constructor({ canvas } = {}) {
    super()
    if (_instance) return _instance
    _instance = this

    this.canvas = canvas
    this.scene = new THREE.Scene()

    this.debug = new Debug()
    this.sizes = new Sizes({ canvas })
    this.time = new Time()
    this.tier = new TierController()

    this.camera = new Camera()
    this.renderer = new Renderer()

    this.resources = new Resources({ sources, renderer: this.renderer.instance })

    this.world = new World()
    this.post = new PostProcessing()
    this.audio = new Audio()
    this.hotspots = new Hotspots()
    this.ui = new UI()

    // ScrollNarrative constructed lazily after resources ready (so DOM sections + horse both exist)
    this.on('worldReady', () => {
      this.scrollNarrative = new ScrollNarrative()
    })

    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())
    this.tier.on('change', () => this.applyTier())
  }

  resize() {
    this.camera.resize()
    this.renderer.resize()
    this.post.resize?.()
  }

  update() {
    this.debug?.begin()
    this.camera.update()
    this.world.update()
    this.hotspots.update()
    this.renderer.update()
    this.tier.sample(this.time.delta, performance.now())
    this.debug?.end()
  }

  applyTier() {
    const p = this.tier.preset
    this.renderer.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, p.dpr))
    if (this.world?.environment?.key) {
      this.world.environment.key.shadow.mapSize.set(p.shadowMap, p.shadowMap)
      this.world.environment.key.shadow.map?.dispose?.()
      this.world.environment.key.shadow.map = null
      this.renderer.instance.shadowMap.needsUpdate = true
    }
    if (this.post) {
      this.post.enabled = p.bloom
      if (this.post.bloomPass) this.post.bloomPass.enabled = p.bloom
    }
  }

  destroy() {
    this.time.destroy()
    this.sizes.destroy()
    this.scrollNarrative?.destroy()
    this.hotspots?.destroy()
    this.post?.destroy()
    this.world?.destroy()
    this.camera?.destroy()
    this.audio?.destroy()

    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (!m) continue
          for (const k of Object.keys(m)) {
            const v = m[k]
            if (v && v.isTexture) v.dispose?.()
          }
          m.dispose?.()
        }
      }
    })

    this.renderer?.destroy()
    this.debug?.destroy()

    _instance = null
  }
}
