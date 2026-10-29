import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Horse:
 *  The source GLB uses deprecated KHR_materials_pbrSpecularGlossiness, so we
 *  replace materials with MeshPhysicalMaterials:
 *    - body  → coat.png albedo + fur height/rough/AO micro-detail
 *    - saddle → horse-1 saddle diffuse (+ spec/gloss as roughness cue)
 */
export default class Horse {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.resources = this.experience.resources
    this.time = this.experience.time
    this.debug = this.experience.debug

    // Coat.png drives albedo — keep tint near white so markings stay true.
    this.coatTint = new THREE.Color('#ffffff')

    // Fur micro-detail tiling over the coat UV atlas
    this.fur = { repeat: 4, bumpScale: 0.55 }

    // When scroll narrative drives clips, suppress the random idle cycle
    this.sectionDriven = false

    // Preferred idle animation. Weighted pool cycles softly around this.
    this.idlePool = [
      'HorseALL_Idle',
      'HorseALL_IdleEars',
      'HorseALL_Idle3',
      'HorseALL_SlowIdle',
      'HorseALL_HoofScrape',
      'HorseALL_HoofScrape2',
      'HorseALL_Restless',
      'HorseALL_Restless2',
    ]
    this.reactions = {
      rear: 'HorseALL_Rearing',
      buck: 'HorseALL_Bucking',
      feetUp: 'HorseALL_FeetUp',
    }

    this.current = null
    this.actions = {}
    this._returnTimeout = null

    this.setModel()
    this.setAnimations()
    this.scheduleIdleCycle()
    if (this.debug?.active) this.setDebug()
  }

  setModel() {
    const gltf = this.resources.items.horseModel
    this.gltf = gltf
    this.mesh = gltf.scene

    // -----------------------------------------------------------------
    // Materials FIRST, before any bbox math — the source materials from
    // KHR_pbrSpecularGlossiness come through as broken empties; if we
    // measure their skinned bounding box before assignment the bind pose
    // can be way off. Force materials cleanly now.
    // -----------------------------------------------------------------
    this.rebuildMaterials()

    // -----------------------------------------------------------------
    // Auto-fit — walk children, mark them all cast/receive-shadows, then
    // compute the full T-pose world-space AABB and scale + drop to floor.
    // -----------------------------------------------------------------
    this.mesh.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        obj.frustumCulled = false
      }
    })

    this.mesh.updateMatrixWorld(true)
    const bbox = new THREE.Box3().setFromObject(this.mesh)
    const size = bbox.getSize(new THREE.Vector3())
    const center = bbox.getCenter(new THREE.Vector3())
    const targetHeight = 2.05
    let scale = targetHeight / Math.max(size.y, 0.01)
    // Sanity clamp: if the bbox produced something absurd, fall back to 1
    if (!isFinite(scale) || scale < 0.0001 || scale > 100) scale = 1
    this.mesh.scale.setScalar(scale)
    this.mesh.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale)

    // Wrap in a group so rotation + composition offset apply cleanly.
    // Rotation is exposed via the debug UI; the default puts the horse into
    // a broadside profile with the head on screen-LEFT (matches reference).
    this.group = new THREE.Group()
    this.group.add(this.mesh)
    // Native forward is -Z. π/2 = head at -X. Subtract so the body turns
    // slightly toward camera — classic right-flank 3/4 (not straight broadside).
    this.group.rotation.y = Math.PI / 2 - 0.55
    this.group.position.x = 0.35

    this.scene.add(this.group)

    // eslint-disable-next-line no-console
    console.info('[Horse] fitted — targetHeight=%s scale=%s bbox=%o',
      targetHeight, scale.toFixed(4), { minY: bbox.min.y.toFixed(3), sizeY: size.y.toFixed(3) })
  }

  rebuildMaterials() {
    const R = this.resources.items

    // Albedo = UV-matched coat. Fur pack = micro-detail only (blank normal skipped).
    const coatMap = R.horseCoat
    const furRough = R.furRoughness?.clone()
    const furAO = R.furAO?.clone()
    const furHeight = R.furHeight?.clone()

    const saddleMap = R.horseSaddleDiffuse
    const leatherNormal = R.saddleLeatherNormal?.clone()
    const leatherRough = R.saddleLeatherRough?.clone()
    const leatherAO = R.saddleLeatherAO?.clone()

    for (const tex of [coatMap, furRough, furAO, furHeight, saddleMap, leatherNormal, leatherRough, leatherAO]) {
      if (!tex) continue
      tex.flipY = false
      tex.anisotropy = this.experience.tier?.preset?.anisotropy ?? 4
      tex.needsUpdate = true
    }

    if (coatMap) {
      coatMap.wrapS = coatMap.wrapT = THREE.ClampToEdgeWrapping
      coatMap.colorSpace = THREE.SRGBColorSpace
    }

    for (const tex of [furRough, furAO, furHeight]) {
      if (!tex) continue
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(this.fur.repeat, this.fur.repeat)
      tex.colorSpace = THREE.NoColorSpace
    }

    if (saddleMap) {
      saddleMap.wrapS = saddleMap.wrapT = THREE.ClampToEdgeWrapping
      saddleMap.colorSpace = THREE.SRGBColorSpace
    }

    // Leather grain tiles across the saddle UV atlas
    const leatherRepeat = 5
    for (const tex of [leatherNormal, leatherRough, leatherAO]) {
      if (!tex) continue
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(leatherRepeat, leatherRepeat)
      tex.colorSpace = THREE.NoColorSpace
    }

    const coatMaterial = new THREE.MeshPhysicalMaterial({
      name: 'luigi.coat',
      map: coatMap || null,
      bumpMap: furHeight || null,
      bumpScale: this.fur.bumpScale,
      roughnessMap: furRough || null,
      aoMap: furAO || null,
      aoMapIntensity: 0.75,
      color: this.coatTint.clone(),
      roughness: 0.78,
      metalness: 0.0,
      sheen: 0.55,
      sheenRoughness: 0.88,
      sheenColor: new THREE.Color('#d4a574').convertSRGBToLinear(),
      envMapIntensity: 0.55,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
    })

    // UV saddle diffuse + leather normal/rough/AO for grain + HDR reflections
    // (bumpMap omitted — three.js ignores it whenever normalMap is set)
    const saddleMaterial = new THREE.MeshPhysicalMaterial({
      name: 'luigi.saddle',
      map: saddleMap || null,
      normalMap: leatherNormal || null,
      roughnessMap: leatherRough || null,
      aoMap: leatherAO || null,
      aoMapIntensity: 0.9,
      color: new THREE.Color(0xffffff),
      roughness: 0.68,
      metalness: 0.05,
      envMapIntensity: 0.85,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      transparent: false,
      side: THREE.FrontSide,
    })
    if (leatherNormal) saddleMaterial.normalScale = new THREE.Vector2(1.4, 1.4)

    this.materials = { coat: coatMaterial, saddle: saddleMaterial }

    const meshes = []
    this.mesh.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) meshes.push(obj)
    })

    const vol = (m) => {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      const b = m.geometry.boundingBox
      const s = b.getSize(new THREE.Vector3())
      return s.x * s.y * s.z
    }
    const sorted = [...meshes].sort((a, b) => vol(b) - vol(a))

    sorted.forEach((mesh, rank) => {
      const oldMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const isBody = rank === 0
      const newMat = isBody ? coatMaterial : saddleMaterial

      mesh.material = newMat
      mesh.material.needsUpdate = true
      oldMats.forEach((m) => { try { m?.dispose?.() } catch (_) {} })

      // eslint-disable-next-line no-console
      console.info('[Horse] rank', rank, mesh.name || '(unnamed)', '→', isBody ? 'COAT+FUR' : 'SADDLE')
    })
  }

  setAnimations() {
    this.mixer = new THREE.AnimationMixer(this.mesh)
    for (const clip of this.gltf.animations) {
      const action = this.mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      this.actions[clip.name] = action
    }

    // Force a clean start on Idle
    const first = this.actions['HorseALL_Idle'] || this.actions[Object.keys(this.actions)[0]]
    if (first) {
      first.reset().setEffectiveWeight(1).play()
      this.current = first
      this.currentName = first.getClip().name
    }
    // eslint-disable-next-line no-console
    console.info('[Horse] animation clips loaded:', Object.keys(this.actions).length, '· playing:', this.currentName)
  }

  playByName(name, fade = 0.5) {
    const next = this.actions[name]
    if (!next) return console.warn('[Horse] missing clip:', name)
    if (this.current === next) return
    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = false
    next.setEffectiveTimeScale(1)
    next.setEffectiveWeight(1)
    next.enabled = true
    if (this.current) {
      this.current.crossFadeTo(next, fade, false)
      next.play()
    } else {
      next.play()
    }
    this.current = next
    this.currentName = name
  }

  /** Scroll-section driven clip — pauses the random idle cycle while active. */
  playSection(name, fade = 0.85) {
    this.sectionDriven = true
    this.playByName(name, fade)
  }

  playOnce(name, fadeIn = 0.25, fadeOut = 0.4, settleName = null) {
    const one = this.actions[name]
    if (!one) return console.warn('[Horse] missing one-shot:', name)
    one.reset()
    one.setLoop(THREE.LoopOnce, 1)
    one.clampWhenFinished = true
    one.setEffectiveWeight(1)
    one.enabled = true
    if (this.current) this.current.crossFadeTo(one, fadeIn, false)
    one.play()
    const prevName = this.currentName
    this.current = one
    this.currentName = name
    const clip = one.getClip()
    const durMs = clip.duration * 1000 - fadeOut * 1000
    clearTimeout(this._returnTimeout)
    this._returnTimeout = setTimeout(() => {
      const back = settleName
        || (prevName && this.actions[prevName] ? prevName : 'HorseALL_Idle')
      if (this.sectionDriven && settleName) this.playSection(settleName, fadeOut)
      else this.playByName(back, fadeOut)
    }, Math.max(200, durMs))
  }

  react(kind) {
    const clip = this.reactions[kind]
    if (clip) this.playOnce(clip)
  }

  scheduleIdleCycle() {
    const next = () => {
      if (!this.group?.parent) return
      // Scroll narrative owns the clip while sectionDriven is true
      if (!this.sectionDriven) {
        const isReacting = this.current && this.current.loop === THREE.LoopOnce
        if (!isReacting) {
          const roll = Math.random()
          let pick = 'HorseALL_Idle'
          if (roll > 0.92) pick = 'HorseALL_Restless'
          else if (roll > 0.83) pick = 'HorseALL_HoofScrape'
          else if (roll > 0.68) pick = 'HorseALL_SlowIdle'
          else if (roll > 0.48) pick = 'HorseALL_IdleEars'
          if (this.actions[pick] && this.currentName !== pick) this.playByName(pick, 0.7)
        }
      }
      this._idleTO = setTimeout(next, 8000 + Math.random() * 8000)
    }
    this._idleTO = setTimeout(next, 6500)
  }

  getHotspots() {
    if (!this._hotspotObjs) {
      const chest = new THREE.Object3D()
      const saddle = new THREE.Object3D()
      const hoof = new THREE.Object3D()
      // mesh-local: model faces -Z (native), so chest is at -Z, saddle at +Y
      chest.position.set(0.0, 1.3, -0.55)   // front of chest
      saddle.position.set(0.0, 1.95, 0.05)  // saddle top
      hoof.position.set(0.28, 0.12, -0.55)  // front-right hoof
      this.mesh.add(chest, saddle, hoof)
      this._hotspotObjs = { '01': chest, '02': saddle, '03': hoof }
    }
    return this._hotspotObjs
  }

  setDebug() {
    const f = this.debug.ui.addFolder('Horse')
    const clips = Object.keys(this.actions)
    const state = { clip: this.currentName || clips[0] }
    f.add(state, 'clip', clips).onChange((v) => this.playByName(v, 0.4))
    f.addColor({ tint: '#ffffff' }, 'tint').onChange((v) => {
      this.materials.coat.color.set(v)
    })
    f.add(this.materials.coat, 'roughness', 0, 1, 0.01).name('coat roughness')
    f.add(this.materials.coat, 'metalness', 0, 1, 0.01).name('coat metalness')
    f.add(this.materials.coat, 'envMapIntensity', 0, 2, 0.01).name('coat envMap')
    f.add(this.group.rotation, 'y', -Math.PI, Math.PI, 0.01).name('yaw')

    const fur = f.addFolder('Fur detail')
    fur.add(this.fur, 'repeat', 1, 20, 0.5).name('tiling').onChange((v) => {
      const coat = this.materials.coat
      for (const k of ['bumpMap', 'roughnessMap', 'aoMap']) coat[k]?.repeat.set(v, v)
    })
    fur.add(this.fur, 'bumpScale', 0, 2, 0.01).name('strand relief').onChange((v) => {
      this.materials.coat.bumpScale = v
    })
    fur.add(this.materials.coat, 'aoMapIntensity', 0, 2, 0.01).name('fibre AO')
    fur.add(this.materials.coat, 'sheen', 0, 1, 0.01)
    fur.add(this.materials.coat, 'sheenRoughness', 0, 1, 0.01)

    f.add({ rear: () => this.react('rear') }, 'rear')
    f.add({ buck: () => this.react('buck') }, 'buck')
    f.add({ feetUp: () => this.react('feetUp') }, 'feetUp')
  }

  update() {
    if (this.mixer) this.mixer.update(this.time.delta * 0.001)
  }

  destroy() {
    clearTimeout(this._idleTO)
    clearTimeout(this._returnTimeout)
    this.mixer?.stopAllAction()
    this.mixer?.uncacheRoot?.(this.mesh)
    this.scene.remove(this.group || this.mesh)
    this.mesh.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (!m) continue
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap']) {
            m[k]?.dispose?.()
          }
          m.dispose?.()
        }
      }
    })
  }
}
