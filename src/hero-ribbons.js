// Precision-choreographed canvas background for the Violet Ledger home screen.
// The motion mirrors the supplied reference: fan -> stacked ribbons -> weave -> pinch -> giant discs -> pills -> restart.

const instances = new WeakMap()
const records = new Set()

const COLORS = [
  'rgba(116, 101, 158, .76)',
  'rgba(45, 85, 156, .78)',
  'rgba(159, 86, 57, .76)',
  'rgba(22, 103, 78, .76)',
  'rgba(176, 145, 67, .68)',
  'rgba(96, 76, 151, .76)',
  'rgba(155, 146, 142, .66)',
  'rgba(72, 75, 87, .54)',
]

const RIBBON_PRESETS = [
  { color: COLORS[0], fromLeft: true,  y0: -.05, y1: .90, width: 76, phase: .10, bend: -.16 },
  { color: COLORS[1], fromLeft: true,  y0:  .19, y1: .72, width: 82, phase: .72, bend:  .12 },
  { color: COLORS[2], fromLeft: false, y0:  .03, y1: .79, width: 94, phase: 1.34, bend: -.08, foreground: true },
  { color: COLORS[3], fromLeft: false, y0:  .14, y1: .58, width: 76, phase: 1.96, bend:  .16 },
  { color: COLORS[4], fromLeft: true,  y0:  .35, y1: .91, width: 68, phase: 2.58, bend: -.18 },
  { color: COLORS[5], fromLeft: false, y0:  .29, y1: .95, width: 80, phase: 3.20, bend:  .11 },
  { color: COLORS[6], fromLeft: true,  y0:  .69, y1: .08, width: 60, phase: 3.82, bend: -.10 },
  { color: COLORS[7], fromLeft: false, y0:  .82, y1: .21, width: 58, phase: 4.44, bend:  .09 },
]

const BLOB_PRESETS = [
  { color: COLORS[2], sourceX: -0.35, giantX: .12, giantY: .53, giantRx: .31, giantRy: .43, pillX: .28, pillY: .55, pillRx: .075, pillRy: .105, exitX: -0.25 },
  { color: '#211a32', sourceX: -0.20, giantX: .34, giantY: .60, giantRx: .27, giantRy: .34, pillX: .40, pillY: .48, pillRx: .060, pillRy: .090, exitX: -0.10 },
  { color: COLORS[0], sourceX:  0.50, giantX: .53, giantY: .49, giantRx: .19, giantRy: .28, pillX: .52, pillY: .55, pillRx: .066, pillRy: .100, exitX:  0.48 },
  { color: COLORS[6], sourceX:  1.14, giantX: .69, giantY: .56, giantRx: .21, giantRy: .29, pillX: .64, pillY: .48, pillRx: .071, pillRy: .095, exitX:  1.10 },
  { color: COLORS[3], sourceX:  1.30, giantX: .88, giantY: .48, giantRx: .27, giantRy: .37, pillX: .76, pillY: .55, pillRx: .080, pillRy: .110, exitX:  1.24 },
]

const clamp01 = value => Math.max(0, Math.min(1, value))
const lerp = (from, to, amount) => from + (to - from) * amount
const mixPoint = (a, b, amount) => ({ x: lerp(a.x, b.x, amount), y: lerp(a.y, b.y, amount) })
const smoothstep = (from, to, value) => {
  const amount = clamp01((value - from) / Math.max(to - from, .0001))
  return amount * amount * (3 - 2 * amount)
}
const easeInOutCubic = value => value < .5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2
const easeOutCubic = value => 1 - Math.pow(1 - clamp01(value), 3)
const easeInCubic = value => Math.pow(clamp01(value), 3)

function supportsReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function lowPowerDevice() {
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  return cores <= 4 || memory <= 4 || window.innerWidth < 820
}

function cubicPoint(geometry, t) {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  return {
    x: geometry.p0.x * mt2 * mt + 3 * geometry.p1.x * mt2 * t + 3 * geometry.p2.x * mt * t2 + geometry.p3.x * t2 * t,
    y: geometry.p0.y * mt2 * mt + 3 * geometry.p1.y * mt2 * t + 3 * geometry.p2.y * mt * t2 + geometry.p3.y * t2 * t,
  }
}

function cubicDerivative(geometry, t) {
  const mt = 1 - t
  return {
    x: 3 * mt * mt * (geometry.p1.x - geometry.p0.x) + 6 * mt * t * (geometry.p2.x - geometry.p1.x) + 3 * t * t * (geometry.p3.x - geometry.p2.x),
    y: 3 * mt * mt * (geometry.p1.y - geometry.p0.y) + 6 * mt * t * (geometry.p2.y - geometry.p1.y) + 3 * t * t * (geometry.p3.y - geometry.p2.y),
  }
}

function mixGeometry(a, b, amount) {
  return {
    p0: mixPoint(a.p0, b.p0, amount),
    p1: mixPoint(a.p1, b.p1, amount),
    p2: mixPoint(a.p2, b.p2, amount),
    p3: mixPoint(a.p3, b.p3, amount),
    w0: lerp(a.w0, b.w0, amount),
    wm: lerp(a.wm, b.wm, amount),
    w1: lerp(a.w1, b.w1, amount),
  }
}

function ribbonWidthAt(geometry, t) {
  const linear = lerp(geometry.w0, geometry.w1, t)
  const middleDelta = geometry.wm - (geometry.w0 + geometry.w1) * .5
  return Math.max(1, linear + Math.sin(Math.PI * t) * middleDelta)
}

function drawVariableRibbon(ctx, geometry, color, alpha, segments) {
  if (alpha <= .002) return

  const left = []
  const right = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const point = cubicPoint(geometry, t)
    const derivative = cubicDerivative(geometry, t)
    const length = Math.hypot(derivative.x, derivative.y) || 1
    const normalX = -derivative.y / length
    const normalY = derivative.x / length
    const halfWidth = ribbonWidthAt(geometry, t) * .5
    left.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth })
    right.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth })
  }

  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (let index = 1; index < left.length; index += 1) ctx.lineTo(left[index].x, left[index].y)
  for (let index = right.length - 1; index >= 0; index -= 1) ctx.lineTo(right[index].x, right[index].y)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
  ctx.globalAlpha = 1
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
  const ribbonCount = reduced ? 4 : economical ? 6 : 8
  const ribbons = RIBBON_PRESETS.slice(0, ribbonCount)
  const cycleDuration = reduced ? 5.2 : economical ? 2.35 : 1.95

  let targetFps = reduced ? 8 : economical ? 20 : 28
  let frameInterval = 1000 / targetFps
  let renderScale = reduced ? .44 : economical ? .50 : .62
  let segmentCount = reduced ? 8 : economical ? 10 : 14
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

  function fanScene(ribbon, index, time) {
    const direction = ribbon.fromLeft ? 1 : -1
    const wobble = Math.sin(time * 2.1 + ribbon.phase)
    const wobble2 = Math.cos(time * 1.7 + ribbon.phase)
    const startX = ribbon.fromLeft ? -width * .32 : width * 1.32
    const endX = ribbon.fromLeft ? width * 1.32 : -width * .32
    const centerX = width * (.54 + wobble * .025)
    const centerY = height * (.47 + wobble2 * .035)
    const baseWidth = ribbon.width * (height / 820)

    return {
      p0: { x: startX, y: height * (ribbon.y0 + wobble * .025) },
      p1: { x: lerp(startX, centerX, .78), y: centerY + height * (ribbon.bend + wobble2 * .05) },
      p2: { x: lerp(endX, centerX, .78), y: centerY - height * (ribbon.bend + wobble * .05) },
      p3: { x: endX, y: height * (ribbon.y1 - wobble2 * .025) },
      w0: baseWidth * 1.05,
      wm: baseWidth * (.42 + index * .018),
      w1: baseWidth * .95,
      direction,
    }
  }

  function stackScene(ribbon, index, time) {
    const direction = ribbon.fromLeft ? 1 : -1
    const row = (index - (ribbons.length - 1) * .5)
    const y = height * (.47 + row * .062)
    const wave = Math.sin(time * 2.8 + ribbon.phase) * height * .055
    const sweep = Math.cos(time * 2.2 + ribbon.phase) * width * .045
    const baseWidth = ribbon.width * (height / 820)
    const foregroundBoost = ribbon.foreground ? 1.32 : 1

    return {
      p0: { x: -width * .26 + sweep * direction, y: y + wave },
      p1: { x: width * .22 + sweep, y: y - wave * 1.25 + row * 8 },
      p2: { x: width * .78 + sweep, y: y + wave * 1.15 - row * 8 },
      p3: { x: width * 1.26 + sweep * direction, y: y - wave * .72 },
      w0: baseWidth * foregroundBoost,
      wm: baseWidth * (1.08 + (index % 2) * .12) * foregroundBoost,
      w1: baseWidth * .95 * foregroundBoost,
    }
  }

  function weaveScene(ribbon, index, time) {
    const direction = ribbon.fromLeft ? 1 : -1
    const startX = ribbon.fromLeft ? -width * .34 : width * 1.34
    const endX = ribbon.fromLeft ? width * 1.34 : -width * .34
    const lane = (index - (ribbons.length - 1) * .5) / Math.max(1, ribbons.length - 1)
    const pulse = Math.sin(time * 3.4 + ribbon.phase)
    const pulse2 = Math.cos(time * 2.7 + ribbon.phase)
    const baseWidth = ribbon.width * (height / 820)

    return {
      p0: { x: startX, y: height * (.20 + (index % 4) * .17 + pulse * .035) },
      p1: { x: width * (.20 + direction * .05), y: height * (.76 - lane * .28 + pulse2 * .13) },
      p2: { x: width * (.80 - direction * .05), y: height * (.24 + lane * .30 - pulse * .14) },
      p3: { x: endX, y: height * (.78 - (index % 4) * .16 - pulse2 * .035) },
      w0: baseWidth * .92,
      wm: baseWidth * (ribbon.foreground ? 1.46 : 1.02),
      w1: baseWidth * 1.04,
    }
  }

  function pinchScene(ribbon, index, time) {
    const direction = ribbon.fromLeft ? 1 : -1
    const startX = ribbon.fromLeft ? -width * .36 : width * 1.36
    const endX = ribbon.fromLeft ? width * 1.36 : -width * .36
    const pinchX = width * (.55 + Math.sin(time * 2.4) * .018)
    const pinchY = height * (.49 + Math.cos(time * 2.1) * .022)
    const ray = index - (ribbons.length - 1) * .5
    const baseWidth = ribbon.width * (height / 820)

    return {
      p0: { x: startX, y: height * (.08 + (index % 5) * .20) },
      p1: { x: pinchX - direction * width * .08, y: pinchY + ray * height * .012 },
      p2: { x: pinchX + direction * width * .08, y: pinchY - ray * height * .012 },
      p3: { x: endX, y: height * (.91 - (index % 5) * .19) },
      w0: baseWidth * .76,
      wm: baseWidth * .15,
      w1: baseWidth * .70,
    }
  }

  function collapsedScene(ribbon, index, time) {
    const pinchX = width * (.55 + Math.sin(time * 2.3) * .012)
    const pinchY = height * (.49 + Math.cos(time * 2.0) * .014)
    const offset = (index - (ribbons.length - 1) * .5) * height * .010
    const baseWidth = ribbon.width * (height / 820)
    return {
      p0: { x: pinchX - width * .075, y: pinchY + offset },
      p1: { x: pinchX - width * .025, y: pinchY - offset },
      p2: { x: pinchX + width * .025, y: pinchY + offset },
      p3: { x: pinchX + width * .075, y: pinchY - offset },
      w0: baseWidth * .20,
      wm: baseWidth * .88,
      w1: baseWidth * .20,
    }
  }

  function sceneGeometry(ribbon, index, progress, time) {
    const fan = fanScene(ribbon, index, time)
    const stack = stackScene(ribbon, index, time)
    const weave = weaveScene(ribbon, index, time)
    const pinch = pinchScene(ribbon, index, time)
    const collapsed = collapsedScene(ribbon, index, time)

    if (progress < .18) return mixGeometry(fan, stack, easeInOutCubic(progress / .18))
    if (progress < .43) return mixGeometry(stack, weave, easeInOutCubic((progress - .18) / .25))
    if (progress < .63) return mixGeometry(weave, pinch, easeInOutCubic((progress - .43) / .20))
    if (progress < .73) return mixGeometry(pinch, collapsed, easeInCubic((progress - .63) / .10))
    if (progress < .90) return collapsed
    return mixGeometry(collapsed, fan, easeOutCubic((progress - .90) / .10))
  }

  function ribbonOpacity(progress, ribbon) {
    const fadeOut = smoothstep(.64, .75, progress)
    const fadeIn = smoothstep(.90, .985, progress)
    const base = clamp01(1 - fadeOut + fadeIn)
    const foregroundPulse = ribbon.foreground ? 1 + Math.sin(clamp01((progress - .26) / .28) * Math.PI) * .10 : 1
    return Math.min(1, base * foregroundPulse)
  }

  function drawRibbons(progress, time) {
    const order = ribbons.map((_, index) => index).filter(index => !ribbons[index].foreground)
    const foregroundIndex = ribbons.findIndex(ribbon => ribbon.foreground)
    if (foregroundIndex >= 0) order.push(foregroundIndex)

    for (const index of order) {
      const ribbon = ribbons[index]
      const geometry = sceneGeometry(ribbon, index, progress, time)
      drawVariableRibbon(ctx, geometry, ribbon.color, ribbonOpacity(progress, ribbon), segmentCount)
    }
  }

  function drawBlobs(progress, time) {
    const giantIn = smoothstep(.66, .76, progress)
    const exit = smoothstep(.92, .995, progress)
    const visibleAmount = clamp01(giantIn * (1 - exit))
    if (visibleAmount <= .002) return

    const blobLimit = economical ? 4 : BLOB_PRESETS.length
    for (let index = 0; index < blobLimit; index += 1) {
      const blob = BLOB_PRESETS[index]
      const delay = index * .018
      const localIn = smoothstep(.66 + delay, .77 + delay, progress)
      const localPill = smoothstep(.79 + delay, .91 + delay, progress)
      const localExit = smoothstep(.92 + delay * .5, .995, progress)
      const opacity = clamp01(localIn * (1 - localExit))
      if (opacity <= .002) continue

      const sourceX = width * blob.sourceX
      const sourceY = height * (.49 + (index % 2 ? .09 : -.07))
      const giantX = width * blob.giantX
      const giantY = height * blob.giantY
      const pillX = width * blob.pillX
      const pillY = height * blob.pillY
      const exitX = width * blob.exitX
      const exitY = height * (blob.pillY + (index % 2 ? .12 : -.12))

      const arrivedX = lerp(sourceX, giantX, easeOutCubic(localIn))
      const arrivedY = lerp(sourceY, giantY, easeOutCubic(localIn))
      const pillTargetX = lerp(arrivedX, pillX, easeInOutCubic(localPill))
      const pillTargetY = lerp(arrivedY, pillY, easeInOutCubic(localPill))
      const x = lerp(pillTargetX, exitX, easeInCubic(localExit))
      const y = lerp(pillTargetY, exitY, easeInCubic(localExit))

      const rx = lerp(width * blob.giantRx, width * blob.pillRx, easeInOutCubic(localPill)) * (1 - localExit * .45)
      const ry = lerp(height * blob.giantRy, height * blob.pillRy, easeInOutCubic(localPill)) * (1 - localExit * .45)
      const rotation = (index % 2 ? -.16 : .14) + Math.sin(time * 2.2 + index) * .025

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.beginPath()
      ctx.ellipse(0, 0, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      ctx.fillStyle = blob.color
      ctx.globalAlpha = opacity * .96
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  function drawScene(time) {
    const progress = ((time / cycleDuration) % 1 + 1) % 1
    drawRibbons(progress, time)
    drawBlobs(progress, time)
  }

  function reduceQuality() {
    if (qualityReduced || reduced) return
    qualityReduced = true
    renderScale = Math.max(.42, renderScale * .78)
    targetFps = Math.min(targetFps, economical ? 17 : 21)
    segmentCount = Math.max(8, segmentCount - 3)
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
    drawScene((now - epoch) / 1000)

    const drawCost = performance.now() - drawStarted
    slowFrameStreak = drawCost > 10 ? slowFrameStreak + 1 : Math.max(0, slowFrameStreak - 1)
    if (slowFrameStreak >= 7) reduceQuality()

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

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) mutation.addedNodes.forEach(attachFromNode)
  cleanupDisconnected()
})
observer.observe(root, { childList: true, subtree: true })