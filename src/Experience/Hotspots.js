import * as THREE from 'three'
import gsap from 'gsap'
import Experience from './Experience.js'

/**
 * Tracks HTML hotspot buttons over 3D anchor objects on the horse.
 * Projects world positions each frame; hides when occluded/behind camera.
 * Wires hover / click micro-interactions to horse reactions + audio.
 */
export default class Hotspots {
  constructor() {
    this.experience = Experience.getInstance()
    this.camera = this.experience.camera.instance
    this.sizes = this.experience.sizes
    this.reactionMap = { '01': 'feetUp', '02': 'rear', '03': 'buck' }
    this.tmp = new THREE.Vector3()

    this.experience.on('worldReady', () => this.attach())
  }

  attach() {
    this.horse = this.experience.world.horse
    this.anchors = this.horse.getHotspots()
    this.els = Array.from(document.querySelectorAll('.hotspot'))
    for (const el of this.els) {
      const id = el.dataset.hotspot
      el.addEventListener('pointerenter', () => this.onEnter(el, id))
      el.addEventListener('pointerleave', () => this.onLeave(el, id))
      el.addEventListener('click', () => this.onClick(el, id))
    }
  }

  onEnter(el, id) {
    gsap.to(el, { scale: 1.08, duration: 0.25, ease: 'power2.out' })
    this.experience.audio?.tick(900 + Number(id) * 60)
  }

  onLeave(el /*, id */) {
    gsap.to(el, { scale: 1, duration: 0.25, ease: 'power2.out' })
  }

  onClick(el, id) {
    el.classList.add('is-active')
    for (const other of this.els) if (other !== el) other.classList.remove('is-active')
    const kind = this.reactionMap[id]
    if (kind) {
      this.horse.react(kind)
      this.experience.audio?.thump()
      if (kind === 'rear') this.experience.audio?.whinny(1)
      else this.experience.audio?.snort()
    }
    // Snap camera focus to that anchor
    const anchor = this.anchors[id]
    if (anchor) {
      const world = anchor.getWorldPosition(this.tmp.clone())
      const offset = new THREE.Vector3(2.6, 0.35, 3.0)
      this.experience.camera.focus(world, offset, 1.1)
    }
  }

  update() {
    if (!this.anchors || !this.els.length) return
    const w = this.sizes.width
    const h = this.sizes.height
    for (const el of this.els) {
      const id = el.dataset.hotspot
      const anchor = this.anchors[id]
      if (!anchor) continue
      anchor.getWorldPosition(this.tmp)
      // world -> ndc
      const v = this.tmp.clone().project(this.camera)
      const behind = v.z > 1 || v.z < -1
      const x = (v.x * 0.5 + 0.5) * w
      const y = (-v.y * 0.5 + 0.5) * h
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.opacity = behind ? '0' : ''
    }
  }

  destroy() {
    for (const el of this.els || []) {
      el.replaceWith(el.cloneNode(true))
    }
  }
}
