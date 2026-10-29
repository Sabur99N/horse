import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Circular stage floor — full PBR forest ground with readable roughness.
 */
export default class Floor {
  constructor() {
    this.experience = Experience.getInstance()
    this.scene = this.experience.scene
    this.resources = this.experience.resources

    this.setTextures()
    this.setMesh()
  }

  setTextures() {
    const t = this.resources.items
    const color = t.floorDiff
    const disp = t.floorDisp
    const normal = t.floorNormal
    const rough = t.floorRough
    const ao = t.floorAO

    if (color) color.colorSpace = THREE.SRGBColorSpace
    for (const tex of [disp, normal, rough, ao]) {
      if (tex) tex.colorSpace = THREE.NoColorSpace
    }

    const aniso = this.experience.tier?.preset?.anisotropy ?? 4
    for (const tex of [color, disp, normal, rough, ao]) {
      if (!tex) continue
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(2.4, 2.4)
      tex.anisotropy = aniso
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.needsUpdate = true
    }

    this.textures = { color, disp, normal, rough, ao }
  }

  setMesh() {
    const segs = this.experience.tier?.preset?.floorSegs ?? 96
    const geometry = new THREE.CircleGeometry(9, segs)
    geometry.computeVertexNormals()
    if (geometry.attributes.uv && !geometry.attributes.uv2) {
      geometry.setAttribute('uv2', geometry.attributes.uv)
    }

    const material = new THREE.MeshStandardMaterial({
      map: this.textures.color || null,
      normalMap: this.textures.normal || null,
      roughnessMap: this.textures.rough || null,
      aoMap: this.textures.ao || null,
      aoMapIntensity: 1.0,
      displacementMap: this.textures.disp || null,
      displacementScale: 0.12,
      displacementBias: -0.04,
      roughness: 0.72,
      metalness: 0.02,
      color: 0xd2c4ae,
      envMapIntensity: 0.65,
    })

    if (this.textures.normal) {
      material.normalScale = new THREE.Vector2(2.4, 2.4)
    }

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSpotBoost = { value: 1.35 }
      shader.uniforms.uSpotRadius = { value: 3.4 }
      shader.uniforms.uSpotSoftness = { value: 2.0 }
      shader.uniforms.uSpotCenter = { value: new THREE.Vector2(0.4, 0.0) }
      shader.uniforms.uEdgeFade = { value: 6.4 }

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vWorldPosF;`
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n vWorldPosF = worldPosition.xyz;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosF;
         uniform float uSpotBoost;
         uniform float uSpotRadius;
         uniform float uSpotSoftness;
         uniform vec2 uSpotCenter;
         uniform float uEdgeFade;`
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp( (roughnessFactor - 0.35) * 1.55, 0.15, 1.0 );`
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float dSpot = length(vWorldPosF.xz - uSpotCenter);
         float spot = 1.0 - smoothstep(uSpotRadius - uSpotSoftness, uSpotRadius, dSpot);
         gl_FragColor.rgb *= mix(1.0, uSpotBoost, spot);
         float dCenter = length(vWorldPosF.xz);
         float edge = 1.0 - smoothstep(uEdgeFade - 1.6, uEdgeFade, dCenter);
         gl_FragColor.rgb *= edge;
         gl_FragColor.a *= edge;`
      )
      material.userData.shader = shader
    }
    material.customProgramCacheKey = () => 'luigi.floor.roughBoost'

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.receiveShadow = true
    this.scene.add(this.mesh)
  }

  destroy() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    Object.values(this.textures).forEach((t) => t?.dispose?.())
  }
}
