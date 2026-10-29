/**
 * Asset pipeline — compress horse GLB + downscale textures into public/textures/opt.
 * Run: npm run optimize
 */
import sharp from 'sharp'
import { access, mkdir, copyFile, stat } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample, meshopt, textureCompress } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KEEP_ANIMS = new Set([
  'HorseALL_Idle',
  'HorseALL_IdleEars',
  'HorseALL_Idle3',
  'HorseALL_SlowIdle',
  'HorseALL_SlowWalk',
  'HorseALL_HoofScrape',
  'HorseALL_HoofScrape2',
  'HorseALL_Restless',
  'HorseALL_Restless2',
  'HorseALL_Restless3',
  'HorseALL_Jumping',
  'HorseALL_Rearing',
  'HorseALL_Bucking',
  'HorseALL_FeetUp',
])

const textureJobs = [
  ['public/textures/floor/forest_ground_06_diff_1k.jpg', 'public/textures/opt/floor/diff.jpg', 512, 78],
  ['public/textures/floor/forest_ground_06_nor_gl_1k.jpg', 'public/textures/opt/floor/nor.jpg', 512, 82],
  ['public/textures/floor/forest_ground_06_rough_1k.jpg', 'public/textures/opt/floor/rough.jpg', 512, 80],
  ['public/textures/floor/forest_ground_06_ao_1k.jpg', 'public/textures/opt/floor/ao.jpg', 512, 80],
  ['public/textures/floor/forest_ground_06_disp_1k.png', 'public/textures/opt/floor/disp.jpg', 512, 78],
  ['public/textures/horse-1/coat.png', 'public/textures/opt/horse-1/coat.jpg', 1024, 82],
  ['public/textures/horse-1/saddle_diffuse.jpg', 'public/textures/opt/horse-1/saddle_diffuse.jpg', 1024, 80],
  ['fabrics_0037_1k_T39Myf/fabrics_0037_roughness_1k.jpg', 'public/textures/opt/horse/fur_rough.jpg', 512, 80],
  ['fabrics_0037_1k_T39Myf/fabrics_0037_ao_1k.jpg', 'public/textures/opt/horse/fur_ao.jpg', 512, 80],
  ['fabrics_0037_1k_T39Myf/fabrics_0037_height_1k.png', 'public/textures/opt/horse/fur_height.jpg', 512, 78],
  ['fabrics_0037_1k_T39Myf/fabrics_0037_color_1k.jpg', 'public/textures/opt/horse/fur_color.jpg', 512, 80],
  ['public/textures/saddle/leather_nor_gl_1k.jpg', 'public/textures/opt/saddle/nor.jpg', 512, 82],
  ['public/textures/saddle/leather_rough_1k.jpg', 'public/textures/opt/saddle/rough.jpg', 512, 80],
  ['public/textures/saddle/leather_ao_1k.jpg', 'public/textures/opt/saddle/ao.jpg', 512, 80],
]

async function optimizeTextures() {
  let out = 0
  for (const [srcRel, destRel, size, quality] of textureJobs) {
    const src = path.join(root, srcRel)
    const dest = path.join(root, destRel)
    try { await access(src) } catch { console.warn('skip missing', srcRel); continue }
    await mkdir(path.dirname(dest), { recursive: true })
    const info = await sharp(src)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toFile(dest)
    out += info.size
    console.log('tex', path.basename(dest), `${Math.round(info.size / 1024)}KB`)
  }
  console.log('textures total', `${Math.round(out / 1024)}KB`)
}

async function optimizeModel() {
  const srcCandidates = [
    path.join(root, 'animated_horse__3d_animal_model_free_download.glb'),
    path.join(root, 'public/models/horse.glb'),
  ]
  let src = null
  for (const c of srcCandidates) {
    try { await access(c); src = c; break } catch {}
  }
  if (!src) throw new Error('No source GLB found')

  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    })

  const doc = await io.read(src)
  for (const anim of [...doc.getRoot().listAnimations()]) {
    if (!KEEP_ANIMS.has(anim.getName())) anim.dispose()
  }

  await doc.transform(
    dedup(),
    resample(),
    prune(),
    textureCompress({ targetFormat: 'webp', resize: [1024, 1024] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )

  const dest = path.join(root, 'public/models/horse.glb')
  await mkdir(path.dirname(dest), { recursive: true })
  await io.write(dest, doc)
  const mb = (await stat(dest)).size / 1024 / 1024
  console.log('model →', dest, `${mb.toFixed(2)}MB`)
}

await optimizeTextures()
await optimizeModel()
console.log('done')
