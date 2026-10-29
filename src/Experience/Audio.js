import * as THREE from 'three'
import Experience from './Experience.js'

/**
 * Audio scene:
 *  - soft ambient pad + room tone (procedural)
 *  - REAL horse SFX from CC0 field recordings (whinny / neigh / snort)
 *  - UI micro-interaction ticks
 *  - unlocked on first gesture; muted under reduced-motion
 */
export default class Audio {
  constructor() {
    this.experience = Experience.getInstance()
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.muted = this.reduced

    this.listener = new THREE.AudioListener()
    this.experience.camera.instance.add(this.listener)
    this.ctx = this.listener.context

    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.55

    // Gentle limiter so whinnies never clip the pad
    this.comp = this.ctx.createDynamicsCompressor()
    this.comp.threshold.value = -12
    this.comp.knee.value = 12
    this.comp.ratio.value = 4
    this.master.connect(this.comp).connect(this.listener.gain)

    this._ambientStarted = false
    this._scuffTimer = null
    this._horseTimer = null

    // Safety net: resume on ANY first gesture, in case the enter-gate path
    // never fires (browser autoplay policy keeps the context suspended).
    this._gestureUnlock = () => this.unlock()
    window.addEventListener('pointerdown', this._gestureUnlock, { once: true })
    window.addEventListener('keydown', this._gestureUnlock, { once: true })
    window.addEventListener('touchstart', this._gestureUnlock, { once: true })
  }

  async unlock() {
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume() } catch (e) { console.warn('[Audio] resume failed', e) }
    }
    this.startAmbient()
    this.scheduleScuffs()
    this.scheduleHorseSounds()
    // eslint-disable-next-line no-console
    console.info('[Audio] context:', this.ctx.state, '· muted:', this.muted)
    return this.ctx.state
  }

  setMuted(muted) {
    this.muted = muted
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, now + 0.35)
    if (!muted && this.ctx.state !== 'running') this.ctx.resume().catch(() => {})
  }

  // ------- ambient pad --------------------------------------------------
  startAmbient() {
    if (this._ambientStarted) return
    this._ambientStarted = true

    // A2 · C3 · E3 — one octave up from the old pad so it's actually audible
    const notes = [110, 130.8, 164.8]
    this.padVoices = notes.map((f, i) => {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.type = i === 0 ? 'sine' : 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1) * 5
      g.gain.value = i === 0 ? 0.22 : 0.12
      o.connect(g)
      return { o, g }
    })

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.Q.value = 0.6
    this.padVoices.forEach(({ g }) => g.connect(filter))

    // Slow LFO opens/closes the filter — the "breathing" of the pad
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 260
    lfo.connect(lfoGain).connect(filter.frequency)

    // Room-tone: filtered pink noise
    const noiseSrc = this.ctx.createBufferSource()
    noiseSrc.buffer = this.createNoiseBuffer(6)
    noiseSrc.loop = true
    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 620
    noiseFilter.Q.value = 0.4
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.value = 0.1
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(this.master)

    const padOut = this.ctx.createGain()
    padOut.gain.value = 0.8
    filter.connect(padOut).connect(this.master)

    this.padVoices.forEach(({ o }) => o.start())
    lfo.start()
    noiseSrc.start()

    this._ambient = { padVoices: this.padVoices, filter, lfo, noiseSrc, noiseFilter }
  }

  createNoiseBuffer(seconds = 4) {
    const rate = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, Math.max(1, Math.floor(rate * seconds)), rate)
    const data = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.997 * b0 + white * 0.029591
      b1 = 0.985 * b1 + white * 0.032534
      b2 = 0.950 * b2 + white * 0.048056
      data[i] = (b0 + b1 + b2) * 0.5
    }
    return buf
  }

  // ------- HORSE sounds (real CC0 samples) -------------------------------
  _buffers() {
    const R = this.experience.resources?.items || {}
    return {
      whinny: R.sfxWhinny || null,
      neigh: R.sfxNeigh || null,
      snort: R.sfxSnort || null,
    }
  }

  /** Play a loaded AudioBuffer through master. Returns true if played. */
  _playBuffer(buffer, { gain = 0.7, rate = 1, when = 0 } = {}) {
    if (!buffer || this.muted || this.ctx.state !== 'running') return false
    const t = this.ctx.currentTime + when
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(g).connect(this.master)
    src.start(t)
    return true
  }

  /**
   * Real horse neigh/whinny — alternates between two CC0 field recordings.
   * Slight random playback-rate so repeats don't feel identical.
   */
  whinny(strength = 1) {
    const { whinny, neigh } = this._buffers()
    const pick = Math.random() > 0.45 ? whinny : (neigh || whinny)
    const rate = 0.94 + Math.random() * 0.1
    if (this._playBuffer(pick, { gain: 0.72 * strength, rate })) return
    // No sample yet (still loading) — stay silent rather than fake a synth horse
  }

  /** Real horse breath / snort sample. */
  snort() {
    const { snort } = this._buffers()
    const rate = 0.95 + Math.random() * 0.12
    if (this._playBuffer(snort, { gain: 0.55, rate })) return
  }

  /** Soft breath — same snort clip, quieter + slightly slower. */
  breath() {
    const { snort } = this._buffers()
    if (this._playBuffer(snort, { gain: 0.22, rate: 0.85 })) return
  }

  /** Random ambient horse life — real clips only. */
  scheduleHorseSounds() {
    if (this._horseTimer) return
    const tick = () => {
      if (!this.muted && this.ctx.state === 'running') {
        const roll = Math.random()
        if (roll > 0.72) this.whinny(0.9)
        else if (roll > 0.35) this.snort()
        else this.breath()
      }
      this._horseTimer = setTimeout(tick, 10000 + Math.random() * 14000)
    }
    this._horseTimer = setTimeout(tick, 5000 + Math.random() * 4000)
  }

  // ------- hoof scuffs ---------------------------------------------------
  scheduleScuffs() {
    if (this._scuffTimer) return
    const tick = () => {
      if (!this.muted) this.scuff()
      this._scuffTimer = setTimeout(tick, 6000 + Math.random() * 10000)
    }
    this._scuffTimer = setTimeout(tick, 4000 + Math.random() * 4000)
  }

  scuff() {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.createNoiseBuffer(0.4)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 240 + Math.random() * 140
    filter.Q.value = 2.5
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.4)
  }

  // ------- UI micro-interactions ----------------------------------------
  tick(freq = 900) {
    if (this.muted || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.11)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.16)
  }

  thump() {
    if (this.muted || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.22)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.4)

    const nsrc = this.ctx.createBufferSource()
    nsrc.buffer = this.createNoiseBuffer(0.15)
    const nf = this.ctx.createBiquadFilter()
    nf.type = 'bandpass'; nf.frequency.value = 190; nf.Q.value = 3
    const ng = this.ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.008)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    nsrc.connect(nf).connect(ng).connect(this.master)
    nsrc.start(t)
    nsrc.stop(t + 0.2)
  }

  destroy() {
    clearTimeout(this._scuffTimer)
    clearTimeout(this._horseTimer)
    window.removeEventListener('pointerdown', this._gestureUnlock)
    window.removeEventListener('keydown', this._gestureUnlock)
    window.removeEventListener('touchstart', this._gestureUnlock)
    this.setMuted(true)
    try {
      const a = this._ambient
      if (a) {
        a.padVoices.forEach(({ o }) => o.stop())
        a.lfo.stop()
        a.noiseSrc.stop()
      }
    } catch (_) {}
    this.experience.camera.instance.remove(this.listener)
  }
}
