import gsap from 'gsap'
import Experience from './Experience.js'

/**
 * Owns HTML overlay lifecycle: preloader progress, enter gate, reveals,
 * audio toggle, quality toggle, scroll-to-section clicks, progress rail.
 */
export default class UI {
  constructor() {
    this.experience = Experience.getInstance()

    this.preloader = document.getElementById('preloader')
    this.fill = document.getElementById('preloader-fill')
    this.pct = document.getElementById('preloader-pct')
    this.enterGate = document.getElementById('enter')
    this.enterBtn = document.getElementById('enter-btn')
    this.chrome = document.getElementById('chrome')
    this.story = document.getElementById('story')
    this.btnAudio = document.getElementById('btn-audio')
    this.btnQuality = document.getElementById('btn-quality')
    this.ctaMore = document.getElementById('cta-more')
    this.progressFill = document.getElementById('progress-fill')
    this.progressLabel = document.querySelector('.progress__label')

    this.experience.resources.on('progress', (p) => this.onProgress(p))
    this.experience.resources.on('ready', () => this.onReady())

    this.btnAudio?.addEventListener('click', () => this.toggleAudio())
    this.btnQuality?.addEventListener('click', () => this.toggleQuality())
    this.ctaMore?.addEventListener('click', () => {
      this.experience.world?.horse?.react('rear')
      this.experience.audio?.whinny(1)
    })

    // nav-scroll clicks
    document.querySelectorAll('[data-scroll]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault()
        const id = el.dataset.scroll
        this.experience.scrollNarrative?.scrollTo(id)
      })
    })
  }

  onProgress(p) {
    const v = Math.min(1, Math.max(0, p))
    if (this.fill) this.fill.style.width = (v * 100).toFixed(0) + '%'
    if (this.pct) this.pct.textContent = Math.round(v * 100)
  }

  onReady() {
    if (this.fill) this.fill.style.width = '100%'
    if (this.pct) this.pct.textContent = '100'

    const auto = new URLSearchParams(location.search).has('auto')

    gsap.delayedCall(0.4, () => {
      this.preloader?.classList.add('is-hidden')
      if (auto) {
        this.reveal()
        return
      }
      this.enterGate?.classList.add('is-visible')
    })

    if (auto) return

    const start = () => {
      this.enterBtn?.removeEventListener('click', start)
      window.removeEventListener('keydown', onKey)
      this.enterGate?.classList.remove('is-visible')
      this.reveal()
    }
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') start()
    }
    this.enterBtn?.addEventListener('click', start)
    window.addEventListener('keydown', onKey, { once: true })
  }

  reveal() {
    this.experience.audio?.unlock().then(() => {
      this.updateAudioButton()
      // A greeting neigh once the intro dolly has settled — also the clearest
      // confirmation to the user that sound is actually on
      gsap.delayedCall(1.6, () => this.experience.audio?.whinny(1))
    })

    // Play intro camera; ScrollTrigger takes over on first user scroll
    this.experience.camera.playIntro()

    this.chrome?.classList.add('is-visible')
    this.story?.classList.add('is-visible')

    // Initial reveal of hero content. ScrollTrigger sets items to autoAlpha:0
    // in its constructor; here we force them visible (hero is in view on load).
    const heroItems = document.querySelectorAll('[data-section="hero"] [data-reveal]')
    gsap.to(heroItems, {
      autoAlpha: 1,
      y: 0,
      duration: 1.0,
      ease: 'expo.out',
      stagger: 0.07,
      delay: 0.4,
      overwrite: 'auto',
    })
  }

  updateProgress(t) {
    if (!this.progressFill) return
    const total = 8
    const pct = Math.min(1, Math.max(0, t))
    this.progressFill.style.transform = `translateY(${pct * ((total - 1) * 100)}%)`
    if (this.progressLabel) {
      const idx = Math.min(total, Math.max(1, Math.floor(pct * total) + 1))
      const s = String(idx).padStart(2, '0')
      if (this.progressLabel.textContent !== s) this.progressLabel.textContent = s
    }
    if (this.chrome) {
      this.chrome.classList.toggle('is-hidden-hotspots', pct > 0.08)
    }
  }

  updateAudioButton() {
    const muted = this.experience.audio?.muted
    this.btnAudio?.setAttribute('aria-pressed', String(!muted))
    const on = document.getElementById('ico-audio-on')
    const off = document.getElementById('ico-audio-off')
    if (on && off) {
      on.style.display = muted ? 'none' : 'block'
      off.style.display = muted ? 'block' : 'none'
    }
  }

  toggleAudio() {
    if (!this.experience.audio) return
    this.experience.audio.setMuted(!this.experience.audio.muted)
    this.updateAudioButton()
  }

  toggleQuality() {
    const tiers = ['low', 'medium', 'high']
    const t = this.experience.tier
    const idx = tiers.indexOf(t.level)
    const nextLevel = tiers[(idx + 1) % tiers.length]
    t.setLevel(nextLevel)
    this.btnQuality?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.85)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' }
    )
  }
}
