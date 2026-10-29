import Experience from '../Experience.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Horse from './Horse.js'
import Particles from './Particles.js'
import LightShaft from './LightShaft.js'
import Mist from './Mist.js'
import StageProps from './StageProps.js'

export default class World {
  constructor() {
    this.experience = Experience.getInstance()
    this.resources = this.experience.resources
    this.scene = this.experience.scene

    this.resources.on('ready', () => this.build())
  }

  build() {
    this.environment = new Environment()
    this.floor = new Floor()
    this.stageProps = new StageProps()
    this.horse = new Horse()
    this.particles = new Particles()
    this.shaft = new LightShaft()
    this.mist = new Mist()

    this.experience.renderer.instance.shadowMap.needsUpdate = true
    this.experience.trigger('worldReady')
  }

  update() {
    this.horse?.update()
    this.stageProps?.update()
    this.particles?.update()
    this.shaft?.update()
    this.mist?.update()
  }

  destroy() {
    this.mist?.destroy()
    this.shaft?.destroy()
    this.particles?.destroy()
    this.horse?.destroy()
    this.stageProps?.destroy()
    this.floor?.destroy()
    this.environment?.destroy()
  }
}
