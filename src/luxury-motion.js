const rootSelector = '.phantom-story'

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function initLuxuryMotion(root) {
  if (!root || root.dataset.luxuryMotionReady === 'true') return
  root.dataset.luxuryMotionReady = 'true'
  root.classList.add('motion-ready')

  const hero = root.querySelector('.vl-home-hero')
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const revealTargets = [
    '.vl-manifesto',
    '.vl-journey-section',
    '.story-products',
    '.vl-overview-section',
    '.vl-dashboard-columns',
    '.vl-finance-story',
    '.vl-final-cta'
  ].flatMap(selector => [...root.querySelectorAll(selector)])

  revealTargets.forEach(target => target.classList.add('motion-reveal'))

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      }
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })

  revealTargets.forEach(target => revealObserver.observe(target))

  if (!hero || reducedMotion) {
    revealTargets.forEach(target => target.classList.add('is-visible'))
    return
  }

  let raf = 0
  let pointerTargetX = 0
  let pointerTargetY = 0
  let pointerX = 0
  let pointerY = 0

  function measure() {
    const rect = hero.getBoundingClientRect()
    const travel = Math.max(1, rect.height - window.innerHeight)
    const progress = clamp(-rect.top / travel)
    root.style.setProperty('--vl-scroll-progress', progress.toFixed(4))
  }

  function render() {
    raf = 0
    pointerX += (pointerTargetX - pointerX) * 0.075
    pointerY += (pointerTargetY - pointerY) * 0.075
    root.style.setProperty('--vl-pointer-x', pointerX.toFixed(4))
    root.style.setProperty('--vl-pointer-y', pointerY.toFixed(4))
    measure()

    if (Math.abs(pointerTargetX - pointerX) > 0.002 || Math.abs(pointerTargetY - pointerY) > 0.002) {
      raf = requestAnimationFrame(render)
    }
  }

  function requestRender() {
    if (!raf) raf = requestAnimationFrame(render)
  }

  function onPointerMove(event) {
    const rect = hero.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) return
    pointerTargetX = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * 2 - 1
    pointerTargetY = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1) * 2 - 1
    requestRender()
  }

  function onPointerLeave() {
    pointerTargetX = 0
    pointerTargetY = 0
    requestRender()
  }

  window.addEventListener('scroll', requestRender, { passive: true })
  window.addEventListener('resize', requestRender)
  hero.addEventListener('pointermove', onPointerMove, { passive: true })
  hero.addEventListener('pointerleave', onPointerLeave)

  measure()
}

function scan() {
  document.querySelectorAll(rootSelector).forEach(initLuxuryMotion)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scan, { once: true })
} else {
  scan()
}

const appObserver = new MutationObserver(scan)
appObserver.observe(document.documentElement, { childList: true, subtree: true })
