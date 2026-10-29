export function detectTier() {
  const ua = navigator.userAgent || ''
  const mobile = /Mobi|Android|iP(ad|hone)/i.test(ua)
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  const dpr = window.devicePixelRatio || 1

  let renderer = ''
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ||
               document.createElement('canvas').getContext('webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''
    }
  } catch (_) {}
  renderer = String(renderer).toLowerCase()

  const looksHigh = /rtx|radeon rx|m1|m2|m3|m4|apple|adreno 7|adreno 8|mali-g7|mali-g8/i.test(renderer)
  const looksLow  = /adreno [1-5]\d\d|mali-g5\d|powervr|intel(?!.*iris)/i.test(renderer)

  if (mobile && (looksLow || cores <= 4 || mem <= 2)) return 'low'
  if (!mobile && looksHigh && cores >= 6 && dpr >= 1.5) return 'high'
  if (mobile) return 'medium'
  return looksLow ? 'low' : 'high'
}

export const TIER_PRESETS = {
  low: {
    dpr: 1,
    shadowMap: 512,
    bloom: false,
    dof: false,
    particles: 140,
    grain: true,
    anisotropy: 2,
    floorSegs: 64,
    mistLayers: 2,
  },
  medium: {
    dpr: 1.5,
    shadowMap: 1024,
    bloom: true,
    dof: false,
    particles: 280,
    grain: true,
    anisotropy: 4,
    floorSegs: 96,
    mistLayers: 3,
  },
  high: {
    dpr: 2,
    shadowMap: 2048,
    bloom: true,
    dof: true,
    particles: 480,
    grain: true,
    anisotropy: 8,
    floorSegs: 128,
    mistLayers: 4,
  },
}
