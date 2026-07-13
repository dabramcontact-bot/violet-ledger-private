// Violet Ledger — jewelry-grade light, depth and precision geometry for the hero.
// The layer samples the existing ribbon canvas, so shadows, rims and glints always
// follow the live ribbon silhouettes without duplicating the ribbon choreography.

const depthInstances = new WeakMap()
const depthRecords = new Set()

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lerp = (from, to, amount) => from + (to - from) * amount
const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / Math.max(.0001, to - from), 0, 1)
  return t * t * (3 - 2 * t)
}

const MICRO_POINTS = [
  [.08, .24, .18], [.14, .68, .42], [.23, .15, .72], [.29, .82, 1.10],
  [.37, .31, 1.48], [.43, .72, 1.84], [.57, .18, 2.22], [.64, .78, 2.58],
  [.72, .28, 2.96], [.79, .66, 3.32], [.88, .20, 3.72], [.92, .74, 4.06],
]

const BLOB_HALOS = [
  [.12, .53, .31, .43],
  [.34, .60, .27, .34],
  [.53, .49, .19, .28],
  [.69, .56, .21, .29],
  [.88, .48, .27, .37],
]

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

  const lightCanvas = document.createElement('canvas')
  lightCanvas.className = 'hero-ribbon-highlight'
  lightCanvas.setAttribute('aria-hidden', 'true')

  const geometryCanvas = document.createElement('canvas')
  geometryCanvas.className = 'hero-geometry-canvas'
  geometryCanvas.setAttribute('aria-hidden', 'true')

  ribbonCanvas.before(shadowCanvas)
  ribbonCanvas.after(lightCanvas)
  lightCanvas.after(geometryCanvas)

  const shadowCtx = shadowCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const lightCtx = lightCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const geometryCtx = geometryCanvas.getContext('2d', { alpha: true, desynchronized: true })

  const maskCanvas = document.createElement('canvas')
  const maskCtx = maskCanvas.getContext('2d', { alpha: true, desynchronized: true })
  const workCanvas = document.createElement('canvas')
  const workCtx = workCanvas.getContext('2d', { alpha: true, desynchronized: true })

  if (!shadowCtx || !lightCtx || !geometryCtx || !maskCtx || !workCtx) {
    shadowCanvas.remove()
    lightCanvas.remove()
    geometryCanvas.remove()
    return
  }

  const economical = isEconomicalDevice()
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const cycleDuration = reducedMotion ? 5.2 : economical ? 2.35 : 1.95

  let targetFps = reducedMotion ? 8 : economical ? 14 : 20
  let frameInterval = 1000 / targetFps
  let detailLevel = reducedMotion ? 0 : economical ? 1 : 3
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

    for (const canvas of [shadowCanvas, lightCanvas, geometryCanvas, maskCanvas, workCanvas]) {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
    }

    for (const canvas of [shadowCanvas, lightCanvas, geometryCanvas]) {
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
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

  function clearWork() {
    workCtx.setTransform(1, 0, 0, 1, 0, 0)
    workCtx.globalCompositeOperation = 'source-over'
    workCtx.globalAlpha = 1
    workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height)
  }

  function drawEdge(targetCtx, dx, dy, fillStyle, alpha) {
    clearWork()
    workCtx.drawImage(maskCanvas, dx, dy)
    workCtx.globalCompositeOperation = 'destination-out'
    workCtx.drawImage(maskCanvas, 0, 0)
    workCtx.globalCompositeOperation = 'source-in'
    workCtx.fillStyle = fillStyle
    workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height)
    workCtx.globalCompositeOperation = 'source-over'

    targetCtx.globalAlpha = alpha
    targetCtx.drawImage(workCanvas, 0, 0)
    targetCtx.globalAlpha = 1
  }

  function drawMaskedGradient(targetCtx, gradient, alpha) {
    clearWork()
    workCtx.drawImage(maskCanvas, 0, 0)
    workCtx.globalCompositeOperation = 'source-in'
    workCtx.fillStyle = gradient
    workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height)
    workCtx.globalCompositeOperation = 'source-over'

    targetCtx.globalAlpha = alpha
    targetCtx.drawImage(workCanvas, 0, 0)
    targetCtx.globalAlpha = 1
  }

  function drawRibbonDepth(now) {
    createRibbonMask()

    const time = (now - epoch) / 1000
    const lightX = -1 + pointerX * .18
    const lightY = -1 + pointerY * .12
    const contactX = Math.round((5 + pointerX * 1.5) * ratioX)
    const contactY = Math.round((8 + pointerY * 1.5) * ratioY)
    const ambientX = Math.round((10 + pointerX * 2) * ratioX)
    const ambientY = Math.round((18 + pointerY * 2) * ratioY)

    shadowCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height)

    shadowCtx.globalAlpha = detailLevel >= 2 ? .11 : .08
    shadowCtx.drawImage(maskCanvas, ambientX, ambientY)
    shadowCtx.globalAlpha = .24
    shadowCtx.drawImage(maskCanvas, contactX, contactY)
    shadowCtx.globalAlpha = 1

    if (detailLevel >= 2) {
      const shadowTint = shadowCtx.createLinearGradient(0, 0, shadowCanvas.width, shadowCanvas.height)
      shadowTint.addColorStop(0, 'rgba(43, 25, 65, .10)')
      shadowTint.addColorStop(.48, 'rgba(18, 12, 31, .14)')
      shadowTint.addColorStop(1, 'rgba(35, 20, 44, .10)')
      drawMaskedGradient(shadowCtx, shadowTint, .75)
    }

    lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height)
    if (detailLevel < 1) return

    const edgeX = Math.max(1, Math.round((2.2 + Math.abs(lightX) * .5) * ratioX))
    const edgeY = Math.max(1, Math.round((2.0 + Math.abs(lightY) * .5) * ratioY))

    const coolEdge = lightCtx.createLinearGradient(0, 0, lightCanvas.width, lightCanvas.height)
    coolEdge.addColorStop(0, 'rgba(248, 246, 255, .82)')
    coolEdge.addColorStop(.46, 'rgba(210, 207, 255, .54)')
    coolEdge.addColorStop(1, 'rgba(151, 190, 255, .28)')
    drawEdge(lightCtx, -edgeX, -edgeY, coolEdge, detailLevel >= 3 ? .58 : .42)

    const warmEdge = lightCtx.createLinearGradient(0, lightCanvas.height, lightCanvas.width, 0)
    warmEdge.addColorStop(0, 'rgba(179, 99, 69, .23)')
    warmEdge.addColorStop(.55, 'rgba(105, 75, 151, .18)')
    warmEdge.addColorStop(1, 'rgba(53, 93, 150, .14)')
    drawEdge(lightCtx, edgeX, edgeY, warmEdge, detailLevel >= 3 ? .34 : .22)

    if (detailLevel < 2) return

    const travel = ((time * .17) % 1 + 1) % 1
    const bandX = lerp(-lightCanvas.width * .34, lightCanvas.width * 1.28, travel)
    const glint = lightCtx.createLinearGradient(
      bandX - lightCanvas.width * .16,
      0,
      bandX + lightCanvas.width * .16,
      lightCanvas.height,
    )
    glint.addColorStop(0, 'rgba(255,255,255,0)')
    glint.addColorStop(.43, 'rgba(232,229,255,.02)')
    glint.addColorStop(.50, 'rgba(255,255,255,.34)')
    glint.addColorStop(.57, 'rgba(184,205,255,.05)')
    glint.addColorStop(1, 'rgba(255,255,255,0)')
    drawMaskedGradient(lightCtx, glint, detailLevel >= 3 ? .42 : .28)
  }

  function drawArc(ctx, cx, cy, rx, ry, rotation, start, end, alpha, widthPx = 1) {
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, rotation, start, end)
    ctx.strokeStyle = `rgba(221, 216, 255, ${alpha})`
    ctx.lineWidth = Math.max(.55, widthPx * ratioX)
    ctx.stroke()
  }

  function drawDiamond(ctx, x, y, radius, rotation, alpha, filled = false) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.beginPath()
    ctx.moveTo(0, -radius)
    ctx.lineTo(radius, 0)
    ctx.lineTo(0, radius)
    ctx.lineTo(-radius, 0)
    ctx.closePath()
    if (filled) {
      ctx.fillStyle = `rgba(235, 231, 255, ${alpha})`
      ctx.fill()
    } else {
      ctx.strokeStyle = `rgba(222, 216, 255, ${alpha})`
      ctx.lineWidth = Math.max(.55, ratioX)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawGeometry(now) {
    geometryCtx.clearRect(0, 0, geometryCanvas.width, geometryCanvas.height)
    if (detailLevel < 1) return

    const time = (now - epoch) / 1000
    const progress = ((time / cycleDuration) % 1 + 1) % 1
    const pinch = smoothstep(.50, .72, progress) * (1 - smoothstep(.74, .84, progress))
    const blob = smoothstep(.66, .76, progress) * (1 - smoothstep(.90, .995, progress))
    const ribbonEnergy = clamp(1 - blob * .88, 0, 1)

    const px = pointerX * geometryCanvas.width * .010
    const py = pointerY * geometryCanvas.height * .012
    const cx = geometryCanvas.width * .54 + px
    const cy = geometryCanvas.height * .48 + py
    const minSide = Math.min(geometryCanvas.width, geometryCanvas.height)
    const contraction = lerp(1, .52, pinch)

    geometryCtx.save()
    geometryCtx.lineCap = 'round'
    geometryCtx.lineJoin = 'round'

    for (let index = 0; index < (detailLevel >= 3 ? 5 : 3); index += 1) {
      const orbit = index * .72 + time * (.055 + index * .011)
      const rx = geometryCanvas.width * (.14 + index * .047) * contraction
      const ry = geometryCanvas.height * (.10 + index * .032) * contraction
      const gap = .55 + (index % 2) * .22
      const alpha = (.036 + index * .008) * ribbonEnergy + blob * .012
      drawArc(
        geometryCtx,
        cx,
        cy,
        rx,
        ry,
        index * .27 - time * .025,
        orbit,
        orbit + Math.PI * (1.18 + gap),
        alpha,
        index === 0 ? 1.15 : .8,
      )
    }

    const facetRadius = minSide * lerp(.17, .08, pinch)
    geometryCtx.save()
    geometryCtx.translate(cx, cy)
    geometryCtx.rotate(-Math.PI / 4 + time * .035)
    for (let layer = 0; layer < 2; layer += 1) {
      const radius = facetRadius * (1 + layer * .42)
      geometryCtx.beginPath()
      for (let side = 0; side <= 4; side += 1) {
        const angle = Math.PI / 4 + side * Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius * .72
        if (side === 0) geometryCtx.moveTo(x, y)
        else geometryCtx.lineTo(x, y)
      }
      geometryCtx.strokeStyle = `rgba(211, 203, 255, ${(.032 - layer * .010) * ribbonEnergy})`
      geometryCtx.lineWidth = Math.max(.55, ratioX)
      geometryCtx.stroke()
    }
    geometryCtx.restore()

    if (detailLevel >= 2) {
      const nodes = []
      const nodeCount = detailLevel >= 3 ? 8 : 5
      for (let index = 0; index < nodeCount; index += 1) {
        const angle = time * (.13 + index * .003) + index * (Math.PI * 2 / nodeCount)
        const radiusX = geometryCanvas.width * (.18 + (index % 3) * .035) * contraction
        const radiusY = geometryCanvas.height * (.12 + (index % 2) * .035) * contraction
        nodes.push({
          x: cx + Math.cos(angle) * radiusX,
          y: cy + Math.sin(angle * .94) * radiusY,
        })
      }

      geometryCtx.strokeStyle = `rgba(205, 198, 244, ${.026 * ribbonEnergy})`
      geometryCtx.lineWidth = Math.max(.45, ratioX * .65)
      for (let index = 0; index < nodes.length; index += 2) {
        const next = nodes[(index + 3) % nodes.length]
        geometryCtx.beginPath()
        geometryCtx.moveTo(nodes[index].x, nodes[index].y)
        geometryCtx.lineTo(next.x, next.y)
        geometryCtx.stroke()
      }

      nodes.forEach((node, index) => {
        drawDiamond(
          geometryCtx,
          node.x,
          node.y,
          Math.max(1.8 * ratioX, (index % 3 === 0 ? 3.0 : 2.1) * ratioX),
          time * .20 + index,
          (.12 + (index % 3) * .025) * ribbonEnergy,
          index % 4 === 0,
        )
      })
    }

    if (detailLevel >= 3) {
      MICRO_POINTS.forEach(([nx, ny, phase], index) => {
        const driftX = Math.sin(time * (.18 + index * .006) + phase) * geometryCanvas.width * .012
        const driftY = Math.cos(time * (.15 + index * .004) + phase) * geometryCanvas.height * .014
        const x = geometryCanvas.width * nx + driftX + pointerX * (index % 2 ? 2 : -2) * ratioX
        const y = geometryCanvas.height * ny + driftY + pointerY * (index % 2 ? -2 : 2) * ratioY
        const pulse = .5 + .5 * Math.sin(time * .8 + phase)
        geometryCtx.beginPath()
        geometryCtx.arc(x, y, Math.max(.55, (index % 4 === 0 ? 1.55 : .8) * ratioX), 0, Math.PI * 2)
        geometryCtx.fillStyle = `rgba(238, 234, 255, ${(.045 + pulse * .065) * ribbonEnergy})`
        geometryCtx.fill()
      })
    }

    if (blob > .01) {
      const haloLimit = economical ? 3 : BLOB_HALOS.length
      for (let index = 0; index < haloLimit; index += 1) {
        const [x, y, rx, ry] = BLOB_HALOS[index]
        const local = smoothstep(.04 + index * .03, .62 + index * .02, blob)
        if (local <= .002) continue
        const rotation = (index % 2 ? -.12 : .10) + time * .018
        drawArc(
          geometryCtx,
          geometryCanvas.width * x,
          geometryCanvas.height * y,
          geometryCanvas.width * rx * (1.025 + local * .025),
          geometryCanvas.height * ry * (1.025 + local * .025),
          rotation,
          .2 + index * .34,
          Math.PI * 1.55 + index * .34,
          local * .055,
          .9,
        )
      }
    }

    if (pinch > .01) {
      const flare = geometryCtx.createRadialGradient(cx, cy, 0, cx, cy, minSide * .055)
      flare.addColorStop(0, `rgba(245,241,255,${pinch * .15})`)
      flare.addColorStop(.18, `rgba(193,181,255,${pinch * .08})`)
      flare.addColorStop(1, 'rgba(120,95,180,0)')
      geometryCtx.fillStyle = flare
      geometryCtx.fillRect(cx - minSide * .07, cy - minSide * .07, minSide * .14, minSide * .14)
    }

    geometryCtx.globalCompositeOperation = 'destination-out'
    const calm = geometryCtx.createRadialGradient(
      geometryCanvas.width * .51,
      geometryCanvas.height * .47,
      0,
      geometryCanvas.width * .51,
      geometryCanvas.height * .47,
      geometryCanvas.width * .28,
    )
    calm.addColorStop(0, 'rgba(0,0,0,.88)')
    calm.addColorStop(.46, 'rgba(0,0,0,.52)')
    calm.addColorStop(1, 'rgba(0,0,0,0)')
    geometryCtx.fillStyle = calm
    geometryCtx.fillRect(0, 0, geometryCanvas.width, geometryCanvas.height)
    geometryCtx.globalCompositeOperation = 'source-over'
    geometryCtx.restore()
  }

  function reduceQuality() {
    if (detailLevel === 0) return
    detailLevel -= 1
    targetFps = Math.min(targetFps, detailLevel >= 2 ? 18 : 14)
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

    pointerX += (pointerTargetX - pointerX) * .045
    pointerY += (pointerTargetY - pointerY) * .045

    const started = performance.now()
    if (ribbonCanvas.width !== shadowCanvas.width || ribbonCanvas.height !== shadowCanvas.height) syncSize()
    drawRibbonDepth(now)
    drawGeometry(now)

    const cost = performance.now() - started
    slowFrames = cost > 7.5 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
    if (slowFrames >= 7) {
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
    lightCanvas.remove()
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
