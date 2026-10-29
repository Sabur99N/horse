import './style.css'
import Experience from './Experience/Experience.js'

const canvas = document.getElementById('webgl')

let experience = null
try {
  experience = new Experience({ canvas })
} catch (err) {
  console.error('[Experience] failed to init', err)
  document.getElementById('preloader')?.remove()
  const fallback = document.createElement('div')
  fallback.className = 'noscript'
  fallback.innerHTML = '<h1>Luigi D\'Eclipse · BWP</h1><p>WebGL is required. Please use an updated browser.</p>'
  document.body.appendChild(fallback)
}

if (import.meta.env.DEV) window.experience = experience
