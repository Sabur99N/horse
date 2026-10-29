import GUI from 'lil-gui'
import Stats from 'stats.js'

export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'
    if (!this.active) return

    this.ui = new GUI({ title: 'Luigi · Debug', width: 320 })
    this.ui.domElement.style.opacity = '0.9'

    this.stats = new Stats()
    this.stats.showPanel(0)
    this.stats.dom.style.left = '0'
    this.stats.dom.style.top = '0'
    document.body.appendChild(this.stats.dom)
  }

  begin() { this.active && this.stats?.begin() }
  end() { this.active && this.stats?.end() }

  destroy() {
    if (!this.active) return
    this.ui?.destroy()
    this.stats?.dom.parentNode?.removeChild(this.stats.dom)
  }
}
