// Lightweight animated ribbon field for the Violet Ledger home screen.
// One canvas replaces multiple large animated DOM layers to keep the hero fluid.

const instances = new WeakMap()

const PALETTE = [
  'rgba(116, 101, 158, .64)',
  'rgba(49, 91, 159, .62)',
  'rgba(155, 87, 63, .58)',
  'rgba(23, 99, 79, .62)',
  'rgba(173, 142, 84, .48)',
  'rgba(97, 78, 157, .58)',
  'rgba(85, 129, 175, .42)',
]

function supportsReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function lowPowerDevice() {
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  return cores <= 4 || memory <= 4 || window.innerWidth < 820
}

function attachRibbonCanvas(hero) {
  if (!hero || instances.has(hero)) return

  const canvas = document.createElement('canvas')
  canvas.className = 'hero-ribbon-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  hero.prepend(canvas)

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
  if (!ctx) {
    canvas.remove()
    return
  }

  const reduced = supportsReducedMotion()
  const economical = lowPowerDevice()
  const targetFps = reduced ? 12 : economical ? 30 : 45
  const frameInterval = 1000 / targetFps
  const ribbonCount = reduced ? 4 : economical ? 5 : 7
  const maxDpr = economical ? 1 : 1.25

  let width = 1
  let height = 1
  let dpr = 1
  let raf = 0
  let lastFrame = 0
  let visible = true
  let destroyed = false
  let pointerTargetX = 0
  let pointerTargetY = 0
  let pointerX = 0
  let pointerY = 0
  let rect = hero.getBoundingClientRect()

  const ribbons = Array.from({ length: ribbonCount }, (_, index) => ({
    color: PALETTE[index % PALETTE.length],
    width: 56 + index * 9,
    baseY: .14 + index * .115,
    speed: .18 + index * .035,
    phase: index * 1.37,
    amplitude: .07 + (index % 3) * .018,
    drift: .05 + (index % 2) * .025,
    tilt: (index % 2 ? -1 : 1) * (.06 + index * .006),
  }))

  function resize() {
    rect = hero.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr)

    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }

  function drawRibbon(ribbon, index, time) {
    const phase = time * ribbon.speed + ribbon.phase
    const secondary = time * (ribbon.speed * .63) + ribbon.phase * .71

    const horizontalFlight = Math.sin(phase * .72) * width * ribbon.drift
    const pointerShiftX = pointerX * (8 + index * 2.2)
    const pointerShiftY = pointerY * (5 + index * 1.4)

    const startX = -width * .28 + horizontalFlight + pointerShiftX
    const endX = width * 1.28 + horizontalFlight + pointerShiftX
    const baseY = height * ribbon.baseY + pointerShiftY
    const verticalWave = Math.sin(phase) * height * ribbon.amplitude
    const startY = baseY + verticalWave + Math.cos(secondary) * height * .035
    const endY = baseY - verticalWave + Math.sin(secondary * 1.13) * height * .045

    const cp1X = width * (.20 + Math.sin(secondary * .83) * .075) + horizontalFlight
    const cp2X = width * (.80 + Math.cos(secondary * .91) * .075) + horizontalFlight
    const cp1Y = baseY + height * (ribbon.tilt + Math.sin(phase * 1.17) * .18)
    const cp2Y = baseY + height * (-ribbon.tilt + Math.cos(phase * .94) * .18)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)
    ctx.strokeStyle = ribbon.color
    ctx.lineWidth = ribbon.width * (height / 820)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  function render(now) {
    raf = 0
    if (destroyed || !hero.isConnected || document.hidden || !visible) return
    if (now - lastFrame < frameInterval) {
      raf = requestAnimationFrame(render)
      return
    }
    lastFrame = now

    pointerX += (pointerTargetX - pointerX) * .045
    pointerY += (pointerTargetY - pointerY) * .045

    ctx.clearRect(0, 0, width, height)
    const time = now / 1000

    for (let index = 0; index < ribbons.length; index += 1) {
      drawRibbon(ribbons[index], index, time)
    }

    raf = requestAnimationFrame(render)
  }

  function start() {
    if (!raf && !destroyed && visible && !document.hidden) {
      raf = requestAnimationFrame(render)
    }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function onPointerMove(event) {
    // Capture the event before the legacy hero listener can recalculate DOM styles.
    event.stopPropagation()
    if (economical || reduced) return
    pointerTargetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 2))
    pointerTargetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 2))
  }

  function onPointerLeave() {
    pointerTargetX = 0
    pointerTargetY = 0
  }

  function onVisibilityChange() {
    if (document.hidden) stop()
    else start()
  }

  const resizeObserver = new ResizeObserver(() => {
    resize()
    start()
  })
  resizeObserver.observe(hero)

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting)
    if (visible) start()
    else stop()
  }, { threshold: .01 })
  intersectionObserver.observe(hero)

  hero.addEventListener('pointermove', onPointerMove, { passive: true, capture: true })
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)

  function destroy() {
    if (destroyed) return
    destroyed = true
    stop()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    hero.removeEventListener('pointermove', onPointerMove, true)
    hero.removeEventListener('pointerleave', onPointerLeave)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    canvas.remove()
    instances.delete(hero)
  }

  instances.set(hero, { destroy })
  resize()
  start()
}

function scan() {
  document.querySelectorAll('.animated-hero.brand-hero').forEach(attachRibbonCanvas)
}

scan()

const observer = new MutationObserver(() => {
  scan()
})

observer.observe(document.documentElement, { childList: true, subtree: true })
