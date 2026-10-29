import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter {
  constructor() {
    super()
    this.start = performance.now()
    this.current = this.start
    this.elapsed = 0
    this.delta = 16
    this.running = true
    this.tick = this.tick.bind(this)
    this.rafId = window.requestAnimationFrame(this.tick)

    document.addEventListener('visibilitychange', this.onVisibility)
  }

  onVisibility = () => {
    if (document.hidden) {
      this.running = false
    } else {
      this.running = true
      this.current = performance.now()
    }
  }

  tick(now) {
    this.rafId = window.requestAnimationFrame(this.tick)
    if (!this.running) return
    let delta = now - this.current
    if (delta > 100) delta = 100
    this.delta = delta
    this.current = now
    this.elapsed = (now - this.start) / 1000
    this.trigger('tick')
  }

  destroy() {
    if (this.rafId) window.cancelAnimationFrame(this.rafId)
    document.removeEventListener('visibilitychange', this.onVisibility)
    super.destroy()
  }
}
