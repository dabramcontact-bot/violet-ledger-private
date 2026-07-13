// Violet Ledger — lightweight depth and geometry pass for the animated hero.
// It reuses the existing ribbon canvas, creating exact offset shadows and edge highlights
// without redrawing the ribbon geometry or adding expensive blur filters.

const depthInstances = new WeakMap()
const depthRecords = new Set()

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / Math.max(.0001, to - from), 0, 1)
  return t * t * (3 - 2 * t)
}

function isEconomicalDevice() {
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  return cores <= 4 || memory <= 4 || window.innerWidth < 820
}

function attachDepthLayers(hero) {
  if (!hero || depthInstances.has(hero)) return

  const ribbonCanvas = hero.querySelector('.hero-ribbon-canvas')
  if (!ribbonCanvas) return

  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.className = 'hero-ribbon-shadow'
  shadowCanvas.setAttribute('aria-hidden', 'true')

  const highlightCanvas = document.createElement('canvas')
  highlightCanvas.className = 'hero-ribbon-highlight'
  highlightCanvas.setAttribute('aria-hidden', 'true')

  const geometryCanvas = document.createElement('canvas')
  geometryCanvas.className = 'hero-geometry-canvas'
  geometryCanvas.setAttribute('aria-hidden', 'true')

  ribbonCanvas.before(shadowCanvas)
  ribbonCanvas.after(highlightCanvas)
  highlightCanvas.after(geometryCanvas)

  const shadowCtx = shadowCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const highlightCtx = highlightCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const geometryCtx = geometryCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const maskCanvas = document.createElement('canvas')
  const maskCtx = maskCanvas.getContext('2d', { alpha: true, desynchronized: true })

  if (!shadowCtx || !highlightCtx || !geometryCtx || !maskCtx) {
    shadowCanvas.remove()
    highlightCanvas.remove()
    geometryCanvas.remove()
    return
  }

  const economical = isEconomicalDevice()
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let targetFps = reducedMotion ? 8 : economical ? 16 : 24
  let frameInterval = 1000 / targetFps
  let detailLevel = reducedMotion ? 0 : economical ? 1 : 2
  let width = 1
  let height = 1
  let ratioX = 1
  let ratioY = 1
  let raf = 0
  let lastFrame = 0
  let visible = true
  let destroyed = false
  let slowFrames = 0
  let pointerTargetX = 0
  let pointerTargetY = 0
  let pointerX = 0
  let pointerY = 0
  let epoch = performance.now()
  let record = null

  function syncSize() {
    const rect = hero.getBoundingClientRect()
    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)

    const pixelWidth = Math.max(1, ribbonCanvas.width || Math.round(width * .58))
    const pixelHeight = Math.max(1, ribbonCanvas.height || Math.round(height * .58))
    ratioX = pixelWidth / width
    ratioY = pixelHeight / height

    for (const canvas of [shadowCanvas, highlightCanvas, geometryCanvas, maskCanvas]) {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
    }

    shadowCanvas.style.width = `${width}px`
    shadowCanvas.style.height = `${height}px`
    highlightCanvas.style.width = `${width}px`
    highlightCanvas.style.height = `${height}px`
    geometryCanvas.style.width = `${width}px`
    geometryCanvas.style.height = `${height}px`
  }

  function createRibbonMask() {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    maskCtx.globalCompositeOperation = 'source-over'
    maskCtx.globalAlpha = 1
    maskCtx.drawImage(ribbonCanvas, 0, 0, maskCanvas.width, maskCanvas.height)
    maskCtx.globalCompositeOperation = 'source-in'
    maskCtx.fillStyle = '#000'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    maskCtx.globalCompositeOperation = 'source-over'
  }

  function drawRibbonDepth() {
    createRibbonMask()

    const smallOffset = Math.max(3, Math.round(9 * ratioY))
    const largeOffset = Math.max(6, Math.round(18 * ratioY))

    shadowCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height)
    shadowCtx.globalAlpha = .13
    shadowCtx.drawImage(maskCanvas, 0, largeOffset)
    shadowCtx.globalAlpha = .28
    shadowCtx.drawImage(maskCanvas, 0, smallOffset)
    shadowCtx.globalAlpha = 1

    highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height)
    if (detailLevel < 1) return

    const edge = Math.max(1, Math.round(2.4 * ratioX))
    highlightCtx.drawImage(ribbonCanvas, -edge, -edge, highlightCanvas.width, highlightCanvas.height)
    highlightCtx.globalCompositeOperation = 'source-in'
    highlightCtx.fillStyle = 'rgba(230, 225, 255, .46)'
    highlightCtx.fillRect(0, 0, highlightCanvas.width, highlightCanvas.height)
    highlightCtx.globalCompositeOperation = 'destination-out'
    highlightCtx.drawImage(ribbonCanvas, 0, 0, highlightCanvas.width, highlightCanvas.height)
    highlightCtx.globalCompositeOperation = 'source-over'
  }

  function drawPolygon(ctx, cx, cy, radius, sides, rotation, alpha) {
    ctx.beginPath()
    for (let index = 0; index <= sides; index += 1) {
      const angle = rotation + (index / sides) * Math.PI * 2
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(220, 214, 255, ${alpha})`
    ctx.lineWidth = Math.max(.7, ratioX)
    ctx.stroke()
  }

  function drawGeometry(now) {
    geometryCtx.clearRect(0, 0, geometryCanvas.width, geometryCanvas.height)
    if (detailLevel < 1) return

    const time = (now - epoch) / 1000
    const cycleDuration = economical ? 2.55 : 2.15
    const progress = ((time / cycleDuration) % 1 + 1) % 1
    const blobPhase = smoothstep(.62, .76, progress) * (1 - smoothstep(.90, .995, progress))
    const ribbonPhase = 1 - blobPhase

    const cx = geometryCanvas.width * .54 + pointerX * geometryCanvas.width * .008
    const cy = geometryCanvas.height * .48 + pointerY * geometryCanvas.height * .010
    const baseRadius = Math.min(geometryCanvas.width, geometryCanvas.height)

    geometryCtx.save()
    geometryCtx.translate(cx, cy)
    geometryCtx.rotate(time * .10)
    geometryCtx.strokeStyle = `rgba(205, 197, 255, ${.070 * ribbonPhase})`
    geometryCtx.lineWidth = Math.max(.7, ratioX)

    for (let index = 0; index < 3; index += 1) {
      geometryCtx.beginPath()
      geometryCtx.ellipse(
        0,
        0,
        geometryCanvas.width * (.18 + index * .095),
        geometryCanvas.height * (.13 + index * .066),
        index * .34,
        0,
        Math.PI * 2,
      )
      geometryCtx.stroke()
    }
    geometryCtx.restore()

    drawPolygon(
      geometryCtx,
      cx,
      cy,
      baseRadius * (.14 + blobPhase * .08),
      6,
      -Math.PI / 2 - time * .08,
      .055 + blobPhase * .045,
    )

    if (detailLevel < 2) return

    for (let index = 0; index < 10; index += 1) {
      const angle = time * (.30 + index * .006) + index * .67
      const orbitX = cx + Math.cos(angle) * geometryCanvas.width * (.16 + (index % 3) * .065)
      const orbitY = cy + Math.sin(angle * .91) * geometryCanvas.height * (.11 + (index % 2) * .07)
      const radius = index % 4 === 0 ? 2.1 * ratioX : 1.1 * ratioX
      geometryCtx.beginPath()
      geometryCtx.arc(orbitX, orbitY, Math.max(.7, radius), 0, Math.PI * 2)
      geometryCtx.fillStyle = `rgba(231, 226, 255, ${.15 * ribbonPhase + .06 * blobPhase})`
      geometryCtx.fill()
    }

    const planeShift = Math.sin(time * .72) * geometryCanvas.width * .025
    geometryCtx.beginPath()
    geometryCtx.moveTo(cx - geometryCanvas.width * .24 + planeShift, cy - geometryCanvas.height * .11)
    geometryCtx.lineTo(cx + geometryCanvas.width * .18 + planeShift, cy - geometryCanvas.height * .19)
    geometryCtx.lineTo(cx + geometryCanvas.width * .27 + planeShift, cy + geometryCanvas.height * .09)
    geometryCtx.lineTo(cx - geometryCanvas.width * .15 + planeShift, cy + geometryCanvas.height * .17)
    geometryCtx.closePath()
    geometryCtx.fillStyle = `rgba(162, 145, 224, ${.022 * ribbonPhase})`
    geometryCtx.fill()
  }

  function reduceQuality() {
    if (detailLevel === 0) return
    detailLevel -= 1
    targetFps = Math.min(targetFps, 16)
    frameInterval = 1000 / targetFps
  }

  function render(now) {
    raf = 0
    if (destroyed || !hero.isConnected || document.hidden || !visible) return
    if (now - lastFrame < frameInterval) {
      raf = requestAnimationFrame(render)
      return
    }
    lastFrame = now

    pointerX += (pointerTargetX - pointerX) * .05
    pointerY += (pointerTargetY - pointerY) * .05

    const started = performance.now()
    if (ribbonCanvas.width !== shadowCanvas.width || ribbonCanvas.height !== shadowCanvas.height) syncSize()
    drawRibbonDepth()
    drawGeometry(now)

    const cost = performance.now() - started
    slowFrames = cost > 7 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
    if (slowFrames >= 8) {
      reduceQuality()
      slowFrames = 0
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

  function onPointerMove(event) {
    if (economical || reducedMotion) return
    const rect = hero.getBoundingClientRect()
    pointerTargetX = clamp(((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2, -1, 1)
    pointerTargetY = clamp(((event.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2, -1, 1)
  }

  function onPointerLeave() {
    pointerTargetX = 0
    pointerTargetY = 0
  }

  function onVisibilityChange() {
    if (document.hidden) stop()
    else {
      epoch = performance.now()
      start()
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    syncSize()
    start()
  })
  resizeObserver.observe(hero)

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting)
    if (visible) start()
    else stop()
  }, { threshold: .01 })
  intersectionObserver.observe(hero)

  hero.addEventListener('pointermove', onPointerMove, { passive: true })
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)

  function destroy() {
    if (destroyed) return
    destroyed = true
    stop()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    hero.removeEventListener('pointermove', onPointerMove)
    hero.removeEventListener('pointerleave', onPointerLeave)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    shadowCanvas.remove()
    highlightCanvas.remove()
    geometryCanvas.remove()
    depthInstances.delete(hero)
    if (record) depthRecords.delete(record)
  }

  record = { hero, destroy }
  depthRecords.add(record)
  depthInstances.set(hero, record)
  syncSize()
  start()
}

function scanNode(node) {
  if (!(node instanceof Element)) return

  const candidates = []
  if (node.matches('.animated-hero.brand-hero')) candidates.push(node)
  node.querySelectorAll?.('.animated-hero.brand-hero').forEach(hero => candidates.push(hero))

  for (const hero of candidates) {
    if (hero.querySelector('.hero-ribbon-canvas')) attachDepthLayers(hero)
    else requestAnimationFrame(() => attachDepthLayers(hero))
  }
}

function cleanupDepthLayers() {
  depthRecords.forEach(record => {
    if (!record.hero.isConnected) record.destroy()
  })
}

const depthRoot = document.getElementById('root') || document.body
scanNode(depthRoot)

const depthObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) mutation.addedNodes.forEach(scanNode)
  cleanupDepthLayers()
})
depthObserver.observe(depthRoot, { childList: true, subtree: true })
