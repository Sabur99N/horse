import EventEmitter from './EventEmitter.js'

export default class Sizes extends EventEmitter {
  constructor({ canvas }) {
    super()
    this.canvas = canvas
    this.width = 0
    this.height = 0
    this.pixelRatio = 1

    this.update()

    this.observer = new ResizeObserver(() => this.onChange())
    this.observer.observe(document.documentElement)
    window.addEventListener('orientationchange', this.onChange)
  }

  onChange = () => {
    const prevW = this.width
    const prevH = this.height
    this.update()
    if (prevW !== this.width || prevH !== this.height) this.trigger('resize')
  }

  update() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  }

  destroy() {
    this.observer?.disconnect()
    window.removeEventListener('orientationchange', this.onChange)
    super.destroy()
  }
}
