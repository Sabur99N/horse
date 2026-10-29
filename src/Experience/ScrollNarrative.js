import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Experience from './Experience.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll-driven cinematic camera + section reveals + horse animation cues.
 * Lenis smooth-scroll is wired through ScrollTrigger.scrollerProxy so scrub
 * progress actually tracks the virtual scroll position.
 */
export default class ScrollNarrative {
  constructor() {
    this.experience = Experience.getInstance()
    this.camera = this.experience.camera

    this.sections = [
      'hero',
      'character',
      'movement',
      'bloodline',
      'scope',
      'career',
      'spirit',
      'contact',
    ]

    // Distinct cinematic shots — clear orbit + zoom deltas between sections
    this.keyframes = {
      hero: {
        pos: [2.2, 1.4, 6.2],
        target: [0.25, 1.05, 0.0],
        fov: 44,
      },
      character: {
        pos: [-0.9, 1.55, 2.6],
        target: [-0.5, 1.6, -0.15],
        fov: 28,
      },
      movement: {
        pos: [4.2, 1.2, 4.6],
        target: [0.35, 1.0, 0.0],
        fov: 36,
      },
      bloodline: {
        pos: [3.2, 1.65, 2.8],
        target: [0.9, 1.25, 0.1],
        fov: 32,
      },
      scope: {
        pos: [0.1, 2.4, 5.4],
        target: [0.35, 1.35, 0.0],
        fov: 30,
      },
      career: {
        pos: [0.2, 0.7, 7.4],
        target: [0.35, 0.95, 0.0],
        fov: 48,
      },
      spirit: {
        pos: [-2.6, 1.5, 3.8],
        target: [0.2, 1.35, -0.1],
        fov: 34,
      },
      contact: {
        pos: [-1.2, 2.1, 8.2],
        target: [0.4, 1.15, 0.0],
        fov: 50,
      },
    }

    // Looping clips for each section (Jumping / Rearing play once then settle)
    this.sectionAnims = {
      hero: 'HorseALL_Idle',
      character: 'HorseALL_IdleEars',
      movement: 'HorseALL_SlowWalk',
      bloodline: 'HorseALL_Restless',
      scope: { clip: 'HorseALL_Jumping', once: true, settle: 'HorseALL_Idle3' },
      career: 'HorseALL_HoofScrape',
      spirit: { clip: 'HorseALL_Rearing', once: true, settle: 'HorseALL_Restless2' },
      contact: 'HorseALL_SlowIdle',
    }

    this.progress = 0
    this.activeSection = null

    this.setupLenis()
    this.setupTriggers()
    this.setupSectionReveals()
    this.setupSectionAnimations()

    // Force a refresh after layout settles (fonts / story opacity)
    requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      this._applyProgress(0)
    })
  }

  setupLenis() {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    // lerp-based easing gives a continuously smooth glide (no per-gesture
    // duration restarts), which reads better with a scrubbed camera
    this.lenis = new Lenis({
      lerp: reduced ? 1 : 0.085,
      smoothWheel: !reduced,
      syncTouch: true,
      syncTouchLerp: 0.09,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      autoRaf: false,
    })

    // Tell ScrollTrigger to read/write Lenis scroll instead of native window.
    // NOTE: must be a normal function — an arrow function has no own
    // `arguments`, so the setter branch would never run and ScrollTrigger
    // could not scroll the page (anchor links / refresh restore).
    const self = this
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop(value) {
        if (arguments.length) self.lenis.scrollTo(value, { immediate: true })
        return self.lenis.scroll
      },
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }),
      pinType: document.documentElement.style.transform ? 'transform' : 'fixed',
    })
    ScrollTrigger.defaults({ scroller: document.documentElement })

    this.lenis.on('scroll', ScrollTrigger.update)

    this._ticker = (time) => this.lenis.raf(time * 1000)
    gsap.ticker.add(this._ticker)
    gsap.ticker.lagSmoothing(0)
  }

  setupTriggers() {
    // Pin-length scrub across the full story stack
    this.trigger = ScrollTrigger.create({
      trigger: '#story',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.1,
      invalidateOnRefresh: true,
      onUpdate: (self) => this._applyProgress(self.progress),
    })

    this._onResize = () => ScrollTrigger.refresh()
    window.addEventListener('resize', this._onResize)
  }

  _applyProgress(progress) {
    // Kill intro tweens so scrub owns the camera fully
    if (progress > 0.002 && !this._introKilled) {
      this._introKilled = true
      gsap.killTweensOf(this.camera.instance.position)
      gsap.killTweensOf(this.camera.instance)
      gsap.killTweensOf(this.camera._basePos)
      gsap.killTweensOf(this.camera._lookTarget)
    }

    const total = this.sections.length - 1
    const t = progress * total
    const i = Math.max(0, Math.min(total - 1, Math.floor(t)))
    const local = this._smoothstep(t - i)
    const a = this.keyframes[this.sections[i]]
    const b = this.keyframes[this.sections[Math.min(i + 1, total)]]
    this.progress = progress

    const pos = [
      this._lerp(a.pos[0], b.pos[0], local),
      this._lerp(a.pos[1], b.pos[1], local),
      this._lerp(a.pos[2], b.pos[2], local),
    ]
    const target = [
      this._lerp(a.target[0], b.target[0], local),
      this._lerp(a.target[1], b.target[1], local),
      this._lerp(a.target[2], b.target[2], local),
    ]
    const fov = this._lerp(a.fov, b.fov, local)

    this.camera.setPose({ pos, target, fov })
    this.experience.ui?.updateProgress(progress)

    const sectionIdx = Math.min(total, Math.round(t))
    this._playSectionAnim(this.sections[sectionIdx])
  }

  setupSectionReveals() {
    document.querySelectorAll('[data-section]').forEach((sec) => {
      const items = sec.querySelectorAll('[data-reveal]')
      if (!items.length) return
      gsap.set(items, { autoAlpha: 0, y: 30 })

      ScrollTrigger.create({
        trigger: sec,
        start: 'top 60%',
        end: 'bottom 35%',
        onEnter: () => this._reveal(items),
        onEnterBack: () => this._reveal(items),
        onLeave: () => this._hide(items),
        onLeaveBack: () => this._hide(items),
      })
    })

    const navLinks = document.querySelectorAll('.nav__links a[data-target]')
    document.querySelectorAll('[data-section]').forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return
          const id = sec.dataset.section
          navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.target === id))
        },
      })
    })
  }

  setupSectionAnimations() {
    requestAnimationFrame(() => this._playSectionAnim('hero'))
  }

  _playSectionAnim(id) {
    if (!id || this.activeSection === id) return
    const first = this.activeSection === null
    this.activeSection = id
    const entry = this.sectionAnims[id]
    const horse = this.experience.world?.horse

    if (!first) {
      const audio = this.experience.audio
      if (id === 'scope' || id === 'spirit' || id === 'bloodline') audio?.whinny(0.85)
      else if (id === 'movement' || id === 'career') audio?.snort()
      else audio?.breath?.()
    }

    if (!entry || !horse) return

    if (typeof entry === 'string') {
      if (horse.playSection) horse.playSection(entry)
      else if (horse.playByName) horse.playByName(entry, 0.8)
      return
    }

    // One-shot showcase (jump / rear), then settle into a looping clip
    if (entry.once && horse.playOnce) {
      horse.sectionDriven = true
      horse.playOnce(entry.clip, 0.35, 0.6, entry.settle || null)
    } else if (entry.clip) {
      horse.playSection?.(entry.clip)
    }
  }

  _reveal(items) {
    gsap.to(items, {
      autoAlpha: 1,
      y: 0,
      duration: 1.0,
      ease: 'expo.out',
      stagger: 0.06,
      overwrite: 'auto',
    })
  }

  _hide(items) {
    gsap.to(items, {
      autoAlpha: 0,
      y: -20,
      duration: 0.5,
      ease: 'power2.in',
      overwrite: 'auto',
    })
  }

  scrollTo(id) {
    const el = document.querySelector(`[data-section="${id}"]`)
    if (!el || !this.lenis) return
    this.lenis.scrollTo(el, { offset: 0, duration: 1.4 })
  }

  _lerp(a, b, t) { return a + (b - a) * t }

  _smoothstep(t) {
    const x = Math.max(0, Math.min(1, t))
    return x * x * (3 - 2 * x)
  }

  destroy() {
    clearTimeout(this._settleTO)
    window.removeEventListener('resize', this._onResize)
    if (this._ticker) gsap.ticker.remove(this._ticker)
    this.trigger?.kill()
    ScrollTrigger.getAll().forEach((t) => t.kill())
    this.lenis?.destroy()
  }
}
