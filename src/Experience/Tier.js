import { detectTier, TIER_PRESETS } from './Utils/Tier.js'
import EventEmitter from './Utils/EventEmitter.js'

/**
 * Owns the current quality preset and can downgrade at runtime based on FPS.
 */
export default class TierController extends EventEmitter {
  constructor() {
    super()
    this.level = detectTier()
    this.preset = TIER_PRESETS[this.level]

    this._fpsHistory = []
    this._lastCheck = 0
    this._downgraded = false
  }

  setLevel(level) {
    if (!TIER_PRESETS[level] || level === this.level) return
    this.level = level
    this.preset = TIER_PRESETS[level]
    this.trigger('change')
  }

  /** Sample FPS. If rolling < 50 for 2s, degrade one step. */
  sample(delta, now) {
    if (delta <= 0) return
    const fps = 1000 / delta
    this._fpsHistory.push({ fps, t: now })
    while (this._fpsHistory.length && this._fpsHistory[0].t < now - 2000) {
      this._fpsHistory.shift()
    }
    if (this._downgraded || now - this._lastCheck < 2000) return
    this._lastCheck = now
    if (this._fpsHistory.length < 40) return
    const avg = this._fpsHistory.reduce((s, x) => s + x.fps, 0) / this._fpsHistory.length
    if (avg < 50) {
      const next = this.level === 'high' ? 'medium' : this.level === 'medium' ? 'low' : null
      if (next) {
        console.info(`[Tier] rolling FPS ${avg.toFixed(1)} — downgrading to ${next}`)
        this._downgraded = true
        this.setLevel(next)
      }
    }
  }
}
