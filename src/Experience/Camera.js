import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import Experience from './Experience.js'

/**
 * Camera:
 *  - scroll narrative owns pose while OrbitControls stays disabled
 *  - subtle cursor parallax on top of the scrubbed pose
 *  - playIntro() dolly from wide → hero, then ScrollTrigger takes over
 */
export default class Camera {
  constructor() {
    this.experience = Experience.getInstance()
    this.canvas = this.experience.canvas
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene

    this.parallax = new THREE.Vector2()
    this.parallaxTarget = new THREE.Vector2()
    this._basePos = new THREE.Vector3()
    this._lookTarget = new THREE.Vector3(0.25, 1.05, 0)

    this.setInstance()
    this.setControls()
    this.bindPointer()
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      44,
      this.sizes.width / this.sizes.height,
      0.1,
      100
    )
    this.instance.position.set(2.2, 1.4, 6.2)
    this._basePos.copy(this.instance.position)
    this.scene.add(this.instance)
  }

  setControls() {
    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.enablePan = false
    this.controls.enableZoom = false
    this.controls.minDistance = 2.4
    this.controls.maxDistance = 9
    this.controls.minPolarAngle = Math.PI * 0.28
    this.controls.maxPolarAngle = Math.PI * 0.52
    this.controls.minAzimuthAngle = -Math.PI * 0.55
    this.controls.maxAzimuthAngle = Math.PI * 0.55
    this.controls.rotateSpeed = 0.35
    this.controls.target.copy(this._lookTarget)
    // Keep disabled while scroll drives the camera — controls.update() would
    // otherwise fight setPose every frame and freeze the angle.
    this.controls.enabled = false
  }

  bindPointer() {
    this.onPointer = (e) => {
      const nx = (e.clientX / this.sizes.width) * 2 - 1
      const ny = (e.clientY / this.sizes.height) * 2 - 1
      this.parallaxTarget.set(nx * 0.28, -ny * 0.12)
    }
    window.addEventListener('pointermove', this.onPointer, { passive: true })
  }

  playIntro(onComplete) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reduced ? 0.001 : 2.8
    const heroPos = { x: 2.2, y: 1.4, z: 6.2 }
    const heroTarget = { x: 0.25, y: 1.05, z: 0 }
    const heroFov = 44
    const tl = gsap.timeline({ onComplete })
    tl.fromTo(this.instance.position,
      { x: 0.8, y: 2.9, z: 9.5 },
      {
        ...heroPos,
        duration: dur,
        ease: 'expo.out',
        overwrite: 'auto',
        onUpdate: () => { this._basePos.copy(this.instance.position) },
      },
      0
    )
    tl.fromTo(this._lookTarget,
      { x: 0.4, y: 1.5, z: 0 },
      {
        ...heroTarget,
        duration: dur,
        ease: 'expo.out',
        overwrite: 'auto',
        onUpdate: () => { this.controls.target.copy(this._lookTarget) },
      },
      0
    )
    tl.fromTo(this.instance, { fov: 58 }, {
      fov: heroFov,
      duration: dur,
      ease: 'expo.out',
      overwrite: 'auto',
      onUpdate: () => this.instance.updateProjectionMatrix(),
    }, 0)
  }

  applyKeyframe({ pos, target, fov, duration = 0.8, ease = 'power2.out' }) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) duration = 0.001
    if (pos) {
      gsap.to(this._basePos, {
        x: pos[0], y: pos[1], z: pos[2], duration, ease, overwrite: 'auto',
      })
    }
    if (target) {
      gsap.to(this._lookTarget, {
        x: target[0], y: target[1], z: target[2], duration, ease, overwrite: 'auto',
        onUpdate: () => this.controls.target.copy(this._lookTarget),
      })
    }
    if (typeof fov === 'number') {
      gsap.to(this.instance, {
        fov, duration, ease, overwrite: 'auto',
        onUpdate: () => this.instance.updateProjectionMatrix(),
      })
    }
  }

  /** Instant pose for ScrollTrigger scrub — does NOT go through OrbitControls. */
  setPose({ pos, target, fov }) {
    if (pos) this._basePos.set(pos[0], pos[1], pos[2])
    if (target) {
      this._lookTarget.set(target[0], target[1], target[2])
      this.controls.target.copy(this._lookTarget)
    }
    if (typeof fov === 'number') {
      this.instance.fov = fov
      this.instance.updateProjectionMatrix()
    }
  }

  /** Tween to look at a world point from an offset — used by hotspot clicks. */
  focus(worldPoint, offset = new THREE.Vector3(2.6, 0.35, 3.0), duration = 1.1) {
    const pos = new THREE.Vector3().copy(worldPoint).add(offset)
    this.applyKeyframe({
      pos: [pos.x, pos.y, pos.z],
      target: [worldPoint.x, worldPoint.y, worldPoint.z],
      fov: 38,
      duration,
      ease: 'power3.out',
    })
  }

  /** Distance from camera to its look target — drives depth-of-field focus. */
  get focusDistance() {
    return this._basePos.distanceTo(this._lookTarget)
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    this.parallax.x += (this.parallaxTarget.x - this.parallax.x) * 0.05
    this.parallax.y += (this.parallaxTarget.y - this.parallax.y) * 0.05

    if (this.controls.enabled) {
      this.controls.update()
      return
    }

    // Scroll-driven path: base pose + tiny parallax, then look at target
    this.instance.position.set(
      this._basePos.x + this.parallax.x * 0.18,
      this._basePos.y + this.parallax.y * 0.08,
      this._basePos.z
    )
    this.instance.lookAt(this._lookTarget)
  }

  destroy() {
    window.removeEventListener('pointermove', this.onPointer)
    this.controls.dispose()
  }
}
