// Fast morphing ribbon field for the Violet Ledger home screen.
// One low-resolution canvas recreates the rapid ribbon-to-blob motion from the reference video.

const instances = new WeakMap()
const records = new Set()

const PALETTE = [
  'rgba(116, 101, 158, .68)',
  'rgba(49, 91, 159, .66)',
  'rgba(155, 87, 63, .62)',
  'rgba(23, 99, 79, .66)',
  'rgba(173, 142, 84, .54)',
  'rgba(97, 78, 157, .64)',
]

const clamp01 = value => Math.max(0, Math.min(1, value))
const lerp = (from, to, amount) => from + (to - from) * amount
const smoothstep = (from, to, value) => {
  const amount = clamp01((value - from) / Math.max(to - from, .0001))
  return amount * amount * (3 - 2 * amount)
}
const easeInOutCubic = value => value < .5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2

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
  const targetFps = reduced ? 8 : economical ? 22 : 30
  const frameInterval = 1000 / targetFps
  const ribbonCount = reduced ? 4 : economical ? 5 : 6
  const renderScale = reduced ? .55 : economical ? .62 : .78
  const cycleDuration = reduced ? 8.4 : economical ? 5.7 : 4.7

  let width = 1
  let height = 1
  let scale = 1
  let raf = 0
  let lastFrame = 0
  let visible = true
  let destroyed = false
  let rect = hero.getBoundingClientRect()
  let record = null
  let epoch = performance.now()

  const ribbons = Array.from({ length: ribbonCount }, (_, index) => ({
    color: PALETTE[index % PALETTE.length],
    width: 54 + index * 10,
    baseY: .12 + index * (ribbonCount > 1 ? .76 / (ribbonCount - 1) : 0),
    speed: .84 + index * .095,
    phase: index * 1.31,
    amplitude: .10 + (index % 3) * .025,
    drift: .11 + (index % 2) * .045,
    tilt: (index % 2 ? -1 : 1) * (.08 + index * .01),
    blobX: ribbonCount === 1 ? .5 : .12 + index * (.76 / (ribbonCount - 1)),
    blobY: .49 + ((index % 3) - 1) * .085,
    blobSize: .12 + (index % 3) * .025,
  }))

  function resize() {
    rect = hero.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    scale = Math.min(1, renderScale)

    const pixelWidth = Math.max(1, Math.round(width * scale))
    const pixelHeight = Math.max(1, Math.round(height * scale))
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
    }
  }

  function sceneState(time) {
    const progress = ((time / cycleDuration) % 1 + 1) % 1

    // The reference video spends most of the time in fast ribbon flight,
    // then quickly folds the ribbons into overlapping discs and releases them again.
    const foldIn = smoothstep(.48, .66, progress)
    const foldOut = smoothstep(.82, .98, progress)
    const blobMix = clamp01(foldIn * (1 - foldOut))
    const compression = easeInOutCubic(blobMix)
    const launch = smoothstep(.08, .48, progress) * (1 - smoothstep(.55, .70, progress))
    const release = smoothstep(.86, 1, progress)

    return { progress, blobMix, compression, launch, release }
  }

  function drawRibbon(ribbon, index, time, state) {
    const phase = time * ribbon.speed + ribbon.phase
    const secondary = time * (ribbon.speed * .73) + ribbon.phase * .69
    const direction = index % 2 ? -1 : 1

    const flightX = (
      Math.sin(phase * .92) * ribbon.drift +
      Math.cos(secondary * .51) * ribbon.drift * .54
    ) * width
    const launchX = direction * state.launch * width * (.18 + index * .012)
    const releaseX = -direction * state.release * width * .14
    const horizontalFlight = flightX + launchX + releaseX

    const baseY = height * ribbon.baseY
    const wave = Math.sin(phase * 1.08) * height * ribbon.amplitude
    const flutter = Math.cos(secondary * 1.27) * height * .06

    const fullStartX = -width * .38 + horizontalFlight
    const fullEndX = width * 1.38 + horizontalFlight
    const fullStartY = baseY + wave + flutter
    const fullEndY = baseY - wave + Math.sin(secondary * 1.17) * height * .07
    const fullCp1X = width * (.15 + Math.sin(secondary * .91) * .16) + horizontalFlight
    const fullCp2X = width * (.85 + Math.cos(secondary * .83) * .16) + horizontalFlight
    const fullCp1Y = baseY + height * (ribbon.tilt + Math.sin(phase * 1.34) * .28)
    const fullCp2Y = baseY + height * (-ribbon.tilt + Math.cos(phase * 1.11) * .28)

    const blobOrbit = time * (.52 + index * .035) + ribbon.phase
    const blobCenterX = width * ribbon.blobX + Math.sin(blobOrbit) * width * .035
    const blobCenterY = height * ribbon.blobY + Math.cos(blobOrbit * .83) * height * .045
    const blobRadius = Math.min(width, height) * ribbon.blobSize
    const capsuleLength = blobRadius * (.42 + .12 * Math.sin(blobOrbit * 1.3))
    const capsuleTilt = direction * (.32 + .12 * Math.cos(blobOrbit))
    const capsuleDx = Math.cos(capsuleTilt) * capsuleLength
    const capsuleDy = Math.sin(capsuleTilt) * capsuleLength

    const blobStartX = blobCenterX - capsuleDx
    const blobStartY = blobCenterY - capsuleDy
    const blobEndX = blobCenterX + capsuleDx
    const blobEndY = blobCenterY + capsuleDy
    const blobCp1X = blobCenterX - capsuleDx * .28
    const blobCp1Y = blobCenterY - capsuleDy * .28
    const blobCp2X = blobCenterX + capsuleDx * .28
    const blobCp2Y = blobCenterY + capsuleDy * .28

    const mix = state.compression
    const startX = lerp(fullStartX, blobStartX, mix)
    const startY = lerp(fullStartY, blobStartY, mix)
    const endX = lerp(fullEndX, blobEndX, mix)
    const endY = lerp(fullEndY, blobEndY, mix)
    const cp1X = lerp(fullCp1X, blobCp1X, mix)
    const cp1Y = lerp(fullCp1Y, blobCp1Y, mix)
    const cp2X = lerp(fullCp2X, blobCp2X, mix)
    const cp2Y = lerp(fullCp2Y, blobCp2Y, mix)

    const ribbonWidth = ribbon.width * (height / 820)
    const blobWidth = blobRadius * (1.45 + (index % 2) * .18)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)
    ctx.strokeStyle = ribbon.color
    ctx.lineWidth = lerp(ribbonWidth, blobWidth, mix)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = lerp(.94, .88, state.blobMix)
    ctx.stroke()

    // A lightweight ellipse makes the compressed phase read as large overlapping circles,
    // while the capsule above preserves the impression that the ribbons are morphing into them.
    if (state.blobMix > .02) {
      const ellipseAlpha = smoothstep(.08, .72, state.blobMix) * .48
      ctx.beginPath()
      ctx.ellipse(
        blobCenterX,
        blobCenterY,
        blobRadius * (1.05 + .08 * Math.sin(blobOrbit)),
        blobRadius * (.82 + .08 * Math.cos(blobOrbit * .91)),
        capsuleTilt,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = ribbon.color
      ctx.globalAlpha = ellipseAlpha
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  function render(now) {
    raf = 0
    if (destroyed || !hero.isConnected || document.hidden || !visible) return
    if (now - lastFrame < frameInterval) {
      raf = requestAnimationFrame(render)
      return
    }
    lastFrame = now

    ctx.clearRect(0, 0, width, height)
    const time = (now - epoch) / 1000
    const state = sceneState(time)

    // Draw from back to front. No shadows, filters or per-frame gradients.
    for (let index = 0; index < ribbons.length; index += 1) {
      drawRibbon(ribbons[index], index, time, state)
    }

    raf = requestAnimationFrame(render)
  }

  function start() {
    if (!raf && !destroyed && visible && !document.hidden) raf = requestAnimationFrame(render)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function onVisibilityChange() {
    if (document.hidden) stop()
    else {
      epoch = performance.now()
      start()
    }
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

  function destroy() {
    if (destroyed) return
    destroyed = true
    stop()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    canvas.remove()
    instances.delete(hero)
    if (record) records.delete(record)
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  record = { hero, destroy }
  records.add(record)
  instances.set(hero, record)
  resize()
  start()
}

function scan() {
  records.forEach(record => {
    if (!record.hero.isConnected) record.destroy()
  })
  document.querySelectorAll('.animated-hero.brand-hero').forEach(attachRibbonCanvas)
}

scan()

const observer = new MutationObserver(scan)
observer.observe(document.documentElement, { childList: true, subtree: true })
