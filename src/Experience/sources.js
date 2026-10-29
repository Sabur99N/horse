const sources = [
  { name: 'horseModel', type: 'gltf', path: '/models/horse.glb' },

  // UV-matched coat albedo (compressed)
  { name: 'horseCoat', type: 'texture', path: '/textures/opt/horse-1/coat.jpg' },

  // Fur micro-detail — only maps actually used by materials
  { name: 'furColor', type: 'texture', path: '/textures/opt/horse/fur_color.jpg' },
  { name: 'furRoughness', type: 'texture', path: '/textures/opt/horse/fur_rough.jpg' },
  { name: 'furAO', type: 'texture', path: '/textures/opt/horse/fur_ao.jpg' },
  { name: 'furHeight', type: 'texture', path: '/textures/opt/horse/fur_height.jpg' },

  // Saddle UV diffuse + leather grain (normal / rough / AO)
  { name: 'horseSaddleDiffuse', type: 'texture', path: '/textures/opt/horse-1/saddle_diffuse.jpg' },
  { name: 'saddleLeatherNormal', type: 'texture', path: '/textures/opt/saddle/nor.jpg' },
  { name: 'saddleLeatherRough', type: 'texture', path: '/textures/opt/saddle/rough.jpg' },
  { name: 'saddleLeatherAO', type: 'texture', path: '/textures/opt/saddle/ao.jpg' },

  // Floor PBR (512px)
  { name: 'floorDiff', type: 'texture', path: '/textures/opt/floor/diff.jpg' },
  { name: 'floorDisp', type: 'texture', path: '/textures/opt/floor/disp.jpg' },
  { name: 'floorNormal', type: 'texture', path: '/textures/opt/floor/nor.jpg' },
  { name: 'floorRough', type: 'texture', path: '/textures/opt/floor/rough.jpg' },
  { name: 'floorAO', type: 'texture', path: '/textures/opt/floor/ao.jpg' },

  // Studio HDRI for reflections
  { name: 'envHDR', type: 'hdr', path: '/textures/env/brown_photostudio_02_1k.hdr' },

  // Real horse SFX (CC0 — BigSoundBank / Joseph Sardin)
  { name: 'sfxWhinny', type: 'audio', path: '/audio/whinny.mp3' },
  { name: 'sfxNeigh', type: 'audio', path: '/audio/neigh.mp3' },
  { name: 'sfxSnort', type: 'audio', path: '/audio/snort.mp3' },
]

export default sources
