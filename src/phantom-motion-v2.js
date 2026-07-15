// Luxury motion orchestration for the existing dashboard markup.
// No business logic or page structure is changed.

const state = new WeakMap()

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function attach(root) {
  if (!root || state.has(root)) return

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const hero = root.querySelector('.vl-home-hero')
  const revealTargets = [
    root.querySelector('.vl-manifesto'),
    root.querySelector('.vl-journey-section'),
    ...root.querySelectorAll('.story-section, .dashboard-section, .quick-actions, .overview-grid, .dashboard-columns')
  ].filter(Boolean)

  revealTargets.forEach((element, index) => {
    element.dataset.luxuryReveal = ''
    element.style.setProperty('--reveal-delay', `${Math.min(index * 55, 220)}ms`)
  })

  if (reduced) {
    revealTargets.forEach(element => element.classList.add('is-visible'))
    root.style.setProperty('--story-progress', '0')
    root.style.setProperty('--pointer-x', '0')
    root.style.setProperty('--pointer-y', '0')
    state.set(root, { destroy() {} })
    return
  }

  let raf = 0
  let pointerX = 0
  let pointerY = 0
  let targetX = 0
  let targetY = 0

  const updateScroll = () => {
    raf = 0
    if (!hero || !root.isConnected) return
    const rect = hero.getBoundingClientRect()
    const travel = Math.max(window.innerHeight * .72, 520)
    const progress = clamp(-rect.top / travel)
    root.style.setProperty('--story-progress', progress.toFixed(4))
  }

  const requestScroll = () => {
    if (!raf) raf = window.requestAnimationFrame(updateScroll)
  }

  const pointerFrame = () => {
    pointerX += (targetX - pointerX) * .055
    pointerY += (targetY - pointerY) * .055
    root.style.setProperty('--pointer-x', pointerX.toFixed(4))
    root.style.setProperty('--pointer-y', pointerY.toFixed(4))
    pointerRaf = window.requestAnimationFrame(pointerFrame)
  }

  const onPointerMove = event => {
    targetX = clamp((event.clientX / window.innerWidth - .5) * 2, -1, 1)
    targetY = clamp((event.clientY / window.innerHeight - .5) * 2, -1, 1)
  }

  const onPointerLeave = () => {
    targetX = 0
    targetY = 0
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible')
    })
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' })

  revealTargets.forEach(element => observer.observe(element))
  window.addEventListener('scroll', requestScroll, { passive: true })
  window.addEventListener('resize', requestScroll, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('mouseleave', onPointerLeave)

  let pointerRaf = window.requestAnimationFrame(pointerFrame)
  updateScroll()

  state.set(root, {
    destroy() {
      window.removeEventListener('scroll', requestScroll)
      window.removeEventListener('resize', requestScroll)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('mouseleave', onPointerLeave)
      observer.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
      if (pointerRaf) window.cancelAnimationFrame(pointerRaf)
      state.delete(root)
    }
  })
}

function scan() {
  document.querySelectorAll('.phantom-story').forEach(attach)
  for (const [root] of []) void root
}

const mutationObserver = new MutationObserver(() => {
  window.requestAnimationFrame(scan)
})

function start() {
  scan()
  mutationObserver.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
