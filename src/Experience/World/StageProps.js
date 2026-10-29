import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Editorial stable props:
 *  - Fabric drape backdrop (uses the shared fabric PBR set)
 *  - Wooden plinth ring at the horse's hoof level (procedural wood tone)
 *  - Pendant lamp above the horse: emissive dome + bloom + warm PointLight
 *  - Four stone corner posts (subtle, off in the fog)
 *  All shadow-casting where relevant.
 */
export default class StageProps {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.resources = this.experience.resources

    this.group = new THREE.Group()
    this.group.name = 'stageProps'
    this.scene.add(this.group)

    this.setBackdrop()
    this.setPlinth()
    this.setPendantLamp()
    this.setCornerPosts()
  }

  setBackdrop() {
    const R = this.resources.items
    // Same fur/fabric pack for the drape — cloned so horse body keeps its own repeat
    const color = R.furColor?.clone()
    const rough = R.furRoughness?.clone()
    const ao = R.furAO?.clone()

    if (color) color.colorSpace = THREE.SRGBColorSpace
    ;[rough, ao].forEach((x) => { if (x) x.colorSpace = THREE.NoColorSpace })
    for (const t of [color, rough, ao]) {
      if (!t) continue
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(4, 2)
      t.needsUpdate = true
    }

    // A wide vertical drape sitting BEHIND the horse (negative Z), gently curved.
    const geometry = new THREE.CylinderGeometry(
      7,        // top radius
      7.4,      // bottom radius (slightly wider)
      6.2,      // height
      64, 1,    // radial + height segments
      true,     // openEnded
      -Math.PI * 0.4,   // theta start
      Math.PI * 0.8     // theta length (a curved arc, not full cylinder)
    )
    // Only the inside face is visible; flip so the fabric normals point inward
    const material = new THREE.MeshStandardMaterial({
      map: color || null,
      roughnessMap: rough || null,
      aoMap: ao || null,
      color: 0x151216,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
      envMapIntensity: 0.15,
    })

    this.backdrop = new THREE.Mesh(geometry, material)
    if (ao && geometry.attributes.uv && !geometry.attributes.uv2) {
      geometry.setAttribute('uv2', geometry.attributes.uv)
    }
    this.backdrop.position.set(0.4, 3.1, -1.2)
    this.backdrop.receiveShadow = true
    this.group.add(this.backdrop)
  }

  setPlinth() {
    // A shallow wooden ring at the horse's hooves — a stage plinth
    const ringGeom = new THREE.RingGeometry(2.4, 3.2, 96)
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x2a1d13,
      roughness: 0.85,
      metalness: 0.05,
      envMapIntensity: 0.3,
    })
    this.plinthRing = new THREE.Mesh(ringGeom, woodMat)
    this.plinthRing.rotation.x = -Math.PI / 2
    this.plinthRing.position.set(0.4, 0.005, 0)
    this.plinthRing.receiveShadow = true
    this.group.add(this.plinthRing)

    // A subtle raised outer rim (torus) for depth
    const torusGeom = new THREE.TorusGeometry(3.18, 0.03, 12, 96)
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x1a120c,
      roughness: 0.6,
      metalness: 0.15,
      envMapIntensity: 0.5,
    })
    this.plinthTorus = new THREE.Mesh(torusGeom, torusMat)
    this.plinthTorus.rotation.x = -Math.PI / 2
    this.plinthTorus.position.set(0.4, 0.03, 0)
    this.plinthTorus.receiveShadow = true
    this.group.add(this.plinthTorus)
  }

  setPendantLamp() {
    // Higher and smaller — sits above the frame edge, spills warm light down
    const cableGeom = new THREE.CylinderGeometry(0.004, 0.004, 4.0, 6)
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0a0806 })
    this.cable = new THREE.Mesh(cableGeom, cableMat)
    this.cable.position.set(0.4, 7.0, 0.6)
    this.group.add(this.cable)

    const shadeGeom = new THREE.ConeGeometry(0.28, 0.34, 32, 1, true)
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x080604,
      roughness: 0.55,
      metalness: 0.75,
      side: THREE.DoubleSide,
    })
    this.shade = new THREE.Mesh(shadeGeom, shadeMat)
    this.shade.position.set(0.4, 4.85, 0.6)
    this.shade.castShadow = true
    this.group.add(this.shade)

    // Small emissive dome — bloom catches this subtly
    const bulbGeom = new THREE.SphereGeometry(0.09, 20, 14, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7)
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffdba6,
      emissive: 0xffcf94,
      emissiveIntensity: 2.5,
      roughness: 0.4,
      metalness: 0.0,
      side: THREE.BackSide,
    })
    this.bulb = new THREE.Mesh(bulbGeom, bulbMat)
    this.bulb.position.set(0.4, 4.74, 0.6)
    this.group.add(this.bulb)

    // Real warm point light co-located with the bulb
    this.pendantLight = new THREE.PointLight(0xffcf94, 2.6, 8, 1.7)
    this.pendantLight.position.set(0.4, 4.7, 0.6)
    this.pendantLight.castShadow = false
    this.group.add(this.pendantLight)
  }

  setCornerPosts() {
    // Four dark stone-ish posts sitting in the fog, giving the space "corners"
    const geom = new THREE.CylinderGeometry(0.16, 0.22, 3.6, 12)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111013,
      roughness: 0.85,
      metalness: 0.1,
      envMapIntensity: 0.3,
    })
    const positions = [
      [4.5, 1.8, -3.0],
      [-3.2, 1.8, -3.0],
      [4.8, 1.8, 2.4],
      [-3.4, 1.8, 2.4],
    ]
    this.posts = positions.map((p) => {
      const m = new THREE.Mesh(geom, mat)
      m.position.set(p[0], p[1], p[2])
      m.castShadow = true
      m.receiveShadow = true
      this.group.add(m)
      return m
    })
  }

  update() {
    if (this.bulb && this.shade && this.pendantLight) {
      const t = this.experience.time.elapsed
      const swayX = Math.sin(t * 0.35) * 0.010
      const swayZ = Math.cos(t * 0.28) * 0.008
      this.shade.position.x = 0.4 + swayX
      this.shade.position.z = 0.6 + swayZ
      this.bulb.position.x = 0.4 + swayX
      this.bulb.position.z = 0.6 + swayZ
      this.pendantLight.position.x = 0.4 + swayX
      this.pendantLight.position.z = 0.6 + swayZ
      this.pendantLight.intensity = 2.6 + Math.sin(t * 4.3) * 0.07 + Math.sin(t * 11.7) * 0.04
    }
  }

  destroy() {
    this.scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m?.dispose?.())
      }
    })
  }
}
