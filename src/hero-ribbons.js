// Choreographed canvas background for the Violet Ledger home screen.
// The scene follows the reference video: fast crossing ribbons, a central pinch,
// a short overlapping-blob composition, then a clean release into the next cycle.

const instances = new WeakMap()
const records = new Set()

const COLORS = {
  violet: 'rgba(116, 101, 158, .72)',
  blue: 'rgba(49, 91, 159, .72)',
  rust: 'rgba(155, 87, 63, .68)',
  green: 'rgba(23, 99, 79, .70)',
  gold: 'rgba(173, 142, 84, .60)',
  plum: 'rgba(97, 78, 157, .70)',
  stone: 'rgba(151, 137, 133, .70)',
  graphite: 'rgba(91, 93, 105, .34)',
}

const RIBBON_PRESETS = [
  { color: COLORS.violet, width: 66, fromLeft: true,  y0: .02, y1: .84, bend: -.13, phase: .15 },
  { color: COLORS.blue,   width: 72, fromLeft: true,  y0: .26, y1: .70, bend:  .10, phase: .82 },
  { color: COLORS.rust,   width: 78, fromLeft: false, y0: .07, y1: .77, bend: -.07, phase: 1.45 },
  { color: COLORS.green,  width: 64, fromLeft: false, y0: .16, y1: .57, bend:  .14, phase: 2.10 },
  { color: COLORS.gold,   width: 58, fromLeft: true,  y0: .36, y1: .88, bend: -.16, phase: 2.72 },
  { color: COLORS.plum,   width: 70, fromLeft: false, y0: .30, y1: .92, bend:  .08, phase: 3.35 },
]

const BLOB_PRESETS = [
  { color: COLORS.rust,   x: .19, y: .49, rx: .28, ry: .36, rotation: -.18, from: -1.0 },
  { color: '#231a35',     x: .36, y: .61, rx: .25, ry: .31, rotation:  .12, from: -1.0 },
  { color: COLORS.violet, x: .54, y: .49, rx: .16, ry: .24, rotation: -.08, from:  0.0 },
  { color: COLORS.stone,  x: .67, y: .55, rx: .18, ry: .24, rotation:  .18, from:  1.0 },
  { color: COLORS.green,  x: .86, y: .48, rx: .22, ry: .29, rotation: -.10, from:  1.0 },
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
const easeOutCubic = value => 1 - Math.pow(1 - clamp01(value), 3)

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
  const ribbonCount = reduced ? 4 : economical ? 5 : 6
  const ribbons = RIBBON_PRESETS.slice(0, ribbonCount)

  let targetFps = reduced ? 8 : economical ? 20 : 28
  let frameInterval = 1000 / targetFps
  let renderScale = reduced ? .48 : economical ? .54 : .68
  const cycleDuration = reduced ? 9.5 : economical ? 6.1 : 5.25

  let width = 1
  let height = 1
  let scale = 1
  let raf = 0
  let lastFrame = 0
  let visible = true
  let destroyed = false
  let record = null
  let epoch = performance.now()
  let slowFrameStreak = 0
  let qualityReduced = false

  function resize() {
    const rect = hero.getBoundingClientRect()
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

    // 0.00–0.50: ribbons cross and accelerate through the pinch point.
    // 0.46–0.66: the field tightens and the foreground ribbon sweeps across.
    // 0.58–0.84: overlapping circles take over the composition.
    // 0.82–1.00: circles leave and ribbons re-enter for a seamless restart.
    const attraction = smoothstep(.08, .44, progress) * (1 - smoothstep(.54, .66, progress))
    const sweep = smoothstep(.25, .47, progress) * (1 - smoothstep(.56, .66, progress))
    const blobIn = smoothstep(.54, .68, progress)
    const blobOut = smoothstep(.82, .97, progress)
    const blobMix = clamp01(blobIn * (1 - blobOut))
    const release = smoothstep(.84, 1, progress)
    const restartPulse = Math.sin(release * Math.PI)
    const ribbonAlpha = clamp01(1 - smoothstep(.56, .71, progress) * .82 + release * .82)

    return {
      progress,
      attraction: easeInOutCubic(attraction),
      sweep,
      blobMix: easeInOutCubic(blobMix),
      release,
      restartPulse,
      ribbonAlpha,
    }
  }

  function drawMutedBackLines(time, state) {
    if (economical || reduced) return

    const pinchX = width * (.54 + Math.sin(time * .38) * .025)
    const pinchY = height * (.47 + Math.cos(time * .32) * .035)
    ctx.globalAlpha = .24 * (1 - state.blobMix * .55)
    ctx.strokeStyle = COLORS.graphite
    ctx.lineCap = 'round'

    for (let index = 0; index < 2; index += 1) {
      const direction = index === 0 ? 1 : -1
      const baseY = height * (.22 + index * .56)
      ctx.beginPath()
      ctx.moveTo(direction > 0 ? -width * .18 : width * 1.18, baseY)
      ctx.bezierCurveTo(
        width * (.18 + index * .05),
        baseY + direction * height * .18,
        pinchX,
        pinchY + direction * height * .24,
        direction > 0 ? width * 1.18 : -width * .18,
        height * (.76 - index * .52),
      )
      ctx.lineWidth = (38 + index * 12) * (height / 820)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawRibbon(ribbon, index, time, state) {
    const direction = ribbon.fromLeft ? 1 : -1
    const phase = time * (1.10 + index * .055) + ribbon.phase
    const pulse = Math.sin(phase)
    const pulse2 = Math.cos(phase * .79 + ribbon.phase)

    const pinchX = width * (.55 + Math.sin(time * .44) * .035)
    const pinchY = height * (.47 + Math.cos(time * .39) * .045)

    const startX = ribbon.fromLeft ? -width * .30 : width * 1.30
    const endX = ribbon.fromLeft ? width * 1.30 : -width * .30
    const startY = height * (ribbon.y0 + pulse * .055)
    const endY = height * (ribbon.y1 - pulse2 * .060)

    const travellingShift = Math.sin(phase * .67) * width * (.055 + index * .007)
    const restartShift = state.restartPulse * direction * width * (.14 + index * .008)
    const sweepShift = (index === 2 ? state.sweep * direction * width * .18 : 0)
    const shiftX = travellingShift + restartShift + sweepShift

    const attraction = .58 + state.attraction * .30
    const cp1X = lerp(startX, pinchX, attraction) + shiftX
    const cp2X = lerp(endX, pinchX, attraction) + shiftX
    const cp1Y = lerp(startY, pinchY, attraction) + height * (ribbon.bend + pulse2 * .11)
    const cp2Y = lerp(endY, pinchY, attraction) - height * (ribbon.bend + pulse * .11)

    const collapse = state.blobMix
    const collapsedStartX = pinchX - direction * width * (.08 + index * .004)
    const collapsedEndX = pinchX + direction * width * (.08 + index * .004)
    const collapsedY = pinchY + (index - (ribbons.length - 1) / 2) * height * .017

    ctx.beginPath()
    ctx.moveTo(
      lerp(startX + shiftX, collapsedStartX, collapse),
      lerp(startY, collapsedY, collapse),
    )
    ctx.bezierCurveTo(
      lerp(cp1X, pinchX, collapse),
      lerp(cp1Y, collapsedY, collapse),
      lerp(cp2X, pinchX, collapse),
      lerp(cp2Y, collapsedY, collapse),
      lerp(endX + shiftX, collapsedEndX, collapse),
      lerp(endY, collapsedY, collapse),
    )

    ctx.strokeStyle = ribbon.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const baseWidth = ribbon.width * (height / 820)
    const foregroundBoost = index === 2 ? state.sweep * 48 * (height / 820) : 0
    ctx.lineWidth = lerp(baseWidth + foregroundBoost, baseWidth * 1.25, collapse)
    ctx.globalAlpha = state.ribbonAlpha * (index === 2 ? 1 : .90)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function drawBlobs(time, state) {
    if (state.blobMix <= .005) return

    const clusterTravel = easeOutCubic(state.blobMix)
    const exit = state.release

    for (let index = 0; index < BLOB_PRESETS.length; index += 1) {
      if (economical && index === 2) continue
      const blob = BLOB_PRESETS[index]
      const delay = index * .018
      const localIn = smoothstep(.02 + delay, .70 + delay, state.blobMix)
      const localOut = smoothstep(.18 + delay, 1, exit)
      const appear = clamp01(localIn * (1 - localOut))
      if (appear <= .003) continue

      const targetX = width * blob.x
      const targetY = height * blob.y
      const sourceX = width * (.52 + blob.from * .48)
      const sourceY = height * (.48 + ((index % 2) ? .08 : -.06))
      const drift = Math.sin(time * (.74 + index * .04) + index) * width * .012
      const exitX = targetX + blob.from * width * .62
      const exitY = targetY + ((index % 2) ? 1 : -1) * height * .10

      const settledX = lerp(sourceX, targetX, clusterTravel) + drift
      const settledY = lerp(sourceY, targetY, clusterTravel)
      const x = lerp(settledX, exitX, localOut)
      const y = lerp(settledY, exitY, localOut)
      const scaleIn = easeOutCubic(localIn)
      const scaleOut = 1 - easeInOutCubic(localOut)
      const blobScale = scaleIn * scaleOut

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(blob.rotation + Math.sin(time * .58 + index) * .035)
      ctx.beginPath()
      ctx.ellipse(
        0,
        0,
        width * blob.rx * blobScale,
        height * blob.ry * blobScale,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = blob.color
      ctx.globalAlpha = .92 * appear
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  function drawScene(time, state) {
    drawMutedBackLines(time, state)

    // Back-to-front ordering is deliberate: the reference uses dense overlaps,
    // with one wide rust ribbon crossing in front of the entire field.
    const order = ribbons.map((_, index) => index === 2 ? 999 : index)
    order.sort((a, b) => a - b)
    for (const value of order) {
      const index = value === 999 ? 2 : value
      drawRibbon(ribbons[index], index, time, state)
    }

    drawBlobs(time, state)
  }

  function reduceQuality() {
    if (qualityReduced || reduced) return
    qualityReduced = true
    renderScale = Math.max(.46, renderScale * .80)
    targetFps = Math.min(targetFps, economical ? 18 : 22)
    frameInterval = 1000 / targetFps
    resize()
  }

  function render(now) {
    raf = 0
    if (destroyed || !hero.isConnected || document.hidden || !visible) return
    if (now - lastFrame < frameInterval) {
      raf = requestAnimationFrame(render)
      return
    }
    lastFrame = now

    const drawStarted = performance.now()
    ctx.clearRect(0, 0, width, height)
    const time = (now - epoch) / 1000
    drawScene(time, sceneState(time))

    const drawCost = performance.now() - drawStarted
    slowFrameStreak = drawCost > 13 ? slowFrameStreak + 1 : Math.max(0, slowFrameStreak - 1)
    if (slowFrameStreak >= 8) reduceQuality()

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

function attachFromNode(node) {
  if (!(node instanceof Element)) return
  if (node.matches('.animated-hero.brand-hero')) attachRibbonCanvas(node)
  node.querySelectorAll?.('.animated-hero.brand-hero').forEach(attachRibbonCanvas)
}

function cleanupDisconnected() {
  records.forEach(record => {
    if (!record.hero.isConnected) record.destroy()
  })
}

const root = document.getElementById('root') || document.body
attachFromNode(root)

// Inspect only newly inserted nodes instead of rescanning the whole document
// after every React update. This removes a significant source of avoidable work.
const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(attachFromNode)
  }
  cleanupDisconnected()
})
observer.observe(root, { childList: true, subtree: true })
