export default class EventEmitter {
  constructor() {
    this.callbacks = {}
  }

  on(name, callback) {
    if (!name || typeof callback !== 'function') return this
    if (!this.callbacks[name]) this.callbacks[name] = []
    this.callbacks[name].push(callback)
    return this
  }

  off(name, callback) {
    if (!this.callbacks[name]) return this
    if (!callback) delete this.callbacks[name]
    else this.callbacks[name] = this.callbacks[name].filter(c => c !== callback)
    return this
  }

  trigger(name, args = []) {
    const list = this.callbacks[name]
    if (!list) return this
    list.slice().forEach(cb => cb.apply(this, args))
    return this
  }

  destroy() { this.callbacks = {} }
}
