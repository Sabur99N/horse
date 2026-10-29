import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
  constructor({ sources, renderer }) {
    super()
    this.sources = sources
    this.renderer = renderer
    this.items = {}
    this.toLoad = sources.length
    this.loaded = 0
    this.progress = 0

    this.setupLoaders()
    this.startLoading()
  }

  setupLoaders() {
    this.manager = new THREE.LoadingManager()
    this.manager.onProgress = (_url, loaded, total) => {
      const p = total > 0 ? loaded / total : 0
      this.progress = Math.max(this.progress, p)
      this.trigger('progress', [this.progress])
    }
    this.manager.onError = (url) => {
      console.error('[Resources] failed to load:', url)
      // Treat failed sources as "loaded" so the pipeline doesn't stall
      const src = this.sources.find((s) => url.endsWith(s.path))
      if (src && !(src.name in this.items)) {
        this.items[src.name] = null
        this.loaded++
        const p = this.loaded / this.toLoad
        this.progress = Math.max(this.progress, p)
        this.trigger('progress', [this.progress])
        if (this.loaded === this.toLoad) this.trigger('ready')
      }
    }

    this.loaders = {
      gltf: new GLTFLoader(this.manager),
      texture: new THREE.TextureLoader(this.manager),
      cubeTexture: new THREE.CubeTextureLoader(this.manager),
      exr: new EXRLoader(this.manager),
      hdr: new RGBELoader(this.manager),
      audio: new THREE.AudioLoader(this.manager),
    }

    // Draco + Meshopt + KTX2 for compressed glTF variants
    const draco = new DRACOLoader(this.manager)
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    this.loaders.gltf.setDRACOLoader(draco)
    this.loaders.gltf.setMeshoptDecoder(MeshoptDecoder)
    this.dracoLoader = draco

    if (this.renderer) {
      const ktx2 = new KTX2Loader(this.manager)
        .setTranscoderPath('https://unpkg.com/three@0.169.0/examples/jsm/libs/basis/')
        .detectSupport(this.renderer)
      this.loaders.gltf.setKTX2Loader(ktx2)
      this.ktx2Loader = ktx2
    }
  }

  startLoading() {
    if (this.toLoad === 0) {
      this.progress = 1
      this.trigger('progress', [1])
      this.trigger('ready')
      return
    }

    // Watchdog: fire ready no matter what after 25s so we never soft-lock.
    this._readyWatchdog = setTimeout(() => {
      if (this._readyFired) return
      console.warn('[Resources] watchdog forcing ready — %s/%s loaded', this.loaded, this.toLoad)
      this.progress = 1
      this.trigger('progress', [1])
      this._readyFired = true
      this.trigger('ready')
    }, 25000)

    for (const source of this.sources) {
      switch (source.type) {
        case 'gltf':
          this.loaders.gltf.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        case 'texture':
          this.loaders.texture.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        case 'exr':
          this.loaders.exr.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        case 'hdr':
          this.loaders.hdr.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        case 'cubeTexture':
          this.loaders.cubeTexture.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        case 'audio':
          this.loaders.audio.load(source.path, (file) => this.sourceLoaded(source, file))
          break
        default:
          console.warn('Unknown source type', source)
      }
    }
  }

  sourceLoaded(source, file) {
    if (source.name in this.items) return // duplicate signal (watchdog + real)
    this.items[source.name] = file
    this.loaded++
    const p = this.loaded / this.toLoad
    this.progress = Math.max(this.progress, p)
    this.trigger('progress', [this.progress])
    if (this.loaded === this.toLoad && !this._readyFired) {
      this._readyFired = true
      clearTimeout(this._readyWatchdog)
      this.trigger('ready')
    }
  }

  destroy() {
    this.dracoLoader?.dispose?.()
    this.ktx2Loader?.dispose?.()
    super.destroy()
  }
}
