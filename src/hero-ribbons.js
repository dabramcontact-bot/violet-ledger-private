// Violet Ledger — autonomous smooth-dynamic hero motion.
// This module only paints the background of `.animated-hero.brand-hero`.
// It never changes Dashboard markup, cards, tables, copy, navigation or app state.

const instances = new WeakMap()
const records = new Set()

const TAU = Math.PI * 2
const COLORS = [
  [126, 106, 177],
  [49, 91, 169],
  [173, 92, 64],
  [27, 112, 84],
  [190, 153, 72],
  [100, 78, 158],
  [153, 146, 154],
  [67, 74, 94],
]

const PRESETS = COLORS.map((color, index) => ({
  color,
  phase: index * .73,
  side: index % 2 === 0 ? 1 : -1,
  depth: [.16, .38, .86, .68, .32, .76, .12, .08][index],
  speed: [.48, .60, .57, .68, .46, .59, .40, .36][index],
  width: [86, 108, 134, 112, 96, 118, 78, 70][index],
  y0: [.02, .18, .00, .24, .44, .55, .74, .85][index],
  y1: [.80, .65, .84, .56, .92, .96, .12, .20][index],
  slotX: [.12, .26, .42, .58, .74, .88, .35, .66][index],
  slotY: [.34, .67, .28, .65, .31, .68, .80, .82][index],
})).sort((a, b) => a.depth - b.depth)

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const lerp = (from, to, amount) => from + (to - from) * amount
const smooth = value => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}
const smoother = value => {
  const t = clamp(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function supportsReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function isEconomicalDevice() {
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

function widthAt(geometry, t) {
  const linear = lerp(geometry.w0, geometry.w1, t)
  const middle = geometry.wm - (geometry.w0 + geometry.w1) * .5
  return Math.max(1, linear + Math.sin(Math.PI * t) * middle)
}

function drawRibbon(ctx, geometry, fill, alpha, segments) {
  if (alpha <= .002) return
  const top = []
  const bottom = []

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const point = cubicPoint(geometry, t)
    const derivative = cubicDerivative(geometry, t)
    const length = Math.hypot(derivative.x, derivative.y) || 1
    const normalX = -derivative.y / length
    const normalY = derivative.x / length
    const halfWidth = widthAt(geometry, t) * .5
    top.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth })
    bottom.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth })
  }

  ctx.beginPath()
  ctx.moveTo(top[0].x, top[0].y)
  for (let index = 1; index < top.length; index += 1) ctx.lineTo(top[index].x, top[index].y)
  for (let index = bottom.length - 1; index >= 0; index -= 1) ctx.lineTo(bottom[index].x, bottom[index].y)
  ctx.closePath()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fill
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawSuperellipse(ctx, x, y, rx, ry, rotation, exponent, wobble, phase, fill, alpha, points) {
  if (alpha <= .002) return
  const cosRotation = Math.cos(rotation)
  const sinRotation = Math.sin(rotation)
  ctx.beginPath()

  for (let index = 0; index <= points; index += 1) {
    const angle = index / points * TAU
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const localScale = 1 + wobble * (Math.sin(angle * 3 + phase) * .58 + Math.sin(angle * 5 - phase) * .24)
    const px = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / exponent) * rx * localScale
    const py = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / exponent) * ry * localScale
    const drawX = x + px * cosRotation - py * sinRotation
    const drawY = y + px * sinRotation + py * cosRotation
    if (index === 0) ctx.moveTo(drawX, drawY)
    else ctx.lineTo(drawX, drawY)
  }

  ctx.closePath()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fill
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
  const economical = isEconomicalDevice()
  const cycleDuration = reduced ? 20 : economical ? 18 : 16
  const objectCount = reduced ? 5 : economical ? 6 : PRESETS.length
  const objects = PRESETS.slice(0, objectCount)

  let targetFps = reduced ? 10 : economical ? 30 : 42
  let frameInterval = 1000 / targetFps
  let renderScale = reduced ? .46 : economical ? .58 : .72
  let segments = reduced ? 10 : economical ? 16 : 22
  let shapePoints = reduced ? 28 : economical ? 44 : 58
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

  hero.dataset.heroMotionCycle = String(cycleDuration)

  function hideUnsynchronisedGeometry() {
    const geometry = hero.querySelector('.hero-geometry-canvas')
    if (geometry) {
      geometry.style.setProperty('display', 'none', 'important')
      return
    }
    if (!destroyed) requestAnimationFrame(hideUnsynchronisedGeometry)
  }
  requestAnimationFrame(hideUnsynchronisedGeometry)

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

  function rgba(object, opacity = 1) {
    const [r, g, b] = object.color
    return `rgba(${r},${g},${b},${opacity})`
  }

  function timeline(time) {
    const progress = ((time / cycleDuration) % 1 + 1) % 1
    const scaled = progress * 6
    const scene = Math.floor(scaled) % 6
    const local = scaled - Math.floor(scaled)
    const blend = smoother(clamp((local - .52) / .48))
    return { progress, scene, next: (scene + 1) % 6, local, blend }
  }

  function ribbonGeometry(object, index, time, mode) {
    const waveA = Math.sin(time * object.speed + object.phase)
    const waveB = Math.cos(time * object.speed * .77 + object.phase)
    const waveC = Math.sin(time * object.speed * .49 + object.phase)
    const startX = object.side > 0 ? -width * .42 : width * 1.42
    const endX = object.side > 0 ? width * 1.42 : -width * .42
    const centerX = width * .51 + Math.sin(time * .17 + object.phase) * width * (.025 + object.depth * .024)
    const centerY = height * .49 + Math.cos(time * .15 + object.phase) * height * (.022 + object.depth * .020)
    const baseWidth = object.width * (height / 840) * (1 + waveA * .04)

    if (mode === 'vortex') {
      const angle = time * (.52 + object.speed * .14) + object.phase
      const radiusX = width * (.105 + object.depth * .07)
      const radiusY = height * (.085 + object.depth * .05)
      const orbitX = centerX + Math.cos(angle) * radiusX
      const orbitY = centerY + Math.sin(angle * .86) * radiusY
      return {
        p0: { x: startX, y: height * (object.y0 + waveA * .035) },
        p1: { x: orbitX - width * .16 * object.side, y: orbitY - height * .13 },
        p2: { x: orbitX + width * .16 * object.side, y: orbitY + height * .13 },
        p3: { x: endX, y: height * (object.y1 - waveB * .035) },
        w0: baseWidth * .85,
        wm: baseWidth * (1.16 + object.depth * .34),
        w1: baseWidth * .85,
      }
    }

    const returnBoost = mode === 'return' ? 1.28 : 1
    const driftX = Math.sin(time * .25 + object.phase) * width * (.042 + object.depth * .035) * returnBoost
    const driftY = Math.cos(time * .21 + object.phase) * height * (.038 + object.depth * .027) * returnBoost
    const tension = mode === 'pinch' ? .18 : .52 + object.depth * .08
    const middleWidth = mode === 'pinch' ? .16 : .46 + object.depth * .34

    return {
      p0: { x: startX, y: height * (object.y0 + waveA * .04) + driftY },
      p1: { x: lerp(startX, centerX + driftX, .76), y: centerY + height * (object.side * tension + waveB * .065) },
      p2: { x: lerp(endX, centerX - driftX, .76), y: centerY - height * (object.side * tension + waveC * .065) },
      p3: { x: endX, y: height * (object.y1 - waveB * .04) - driftY },
      w0: baseWidth * (mode === 'pinch' ? .78 : 1),
      wm: baseWidth * middleWidth,
      w1: baseWidth * (mode === 'pinch' ? .74 : .94),
    }
  }

  function renderRibbons(alpha, time, mode) {
    for (let index = 0; index < objects.length; index += 1) {
      const object = objects[index]
      const objectAlpha = alpha * (.32 + object.depth * .38)
      drawRibbon(ctx, ribbonGeometry(object, index, time, mode), rgba(object), objectAlpha, segments)
    }
  }

  function renderPortals(alpha, time, local) {
    for (let index = 0; index < objects.length; index += 1) {
      const object = objects[index]
      const angle = time * (.24 + object.speed * .08) + object.phase
      const nearCamera = index === objects.length - 1
      const zoom = 1 + smooth(local) * (nearCamera ? 2.0 : .42)
      const x = width * (.5 + Math.cos(angle + index * .4) * (.18 + object.depth * .07))
      const y = height * (.50 + Math.sin(angle * .82 + index * .55) * (.15 + object.depth * .05))
      const rx = width * (.075 + object.depth * .065) * zoom
      const ry = height * (.105 + object.depth * .080) * zoom
      const objectAlpha = alpha * (.20 + object.depth * .28)
      drawSuperellipse(ctx, x, y, rx, ry, angle * .28, 2.15, .025, time * .32 + object.phase, rgba(object), objectAlpha, shapePoints)
    }
  }

  function renderParticleFlow(alpha, time, local, reverse = false) {
    const count = economical ? 90 : 150
    const centerX = width * .5
    const centerY = height * .49
    const amount = reverse ? 1 - local : local
    const eased = smoother(amount)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963 + Math.sin(index) * .15
      const seed = (index % 19) / 19
      const radius = 26 + Math.pow(eased, .72) * Math.max(width, height) * (.16 + seed * .72)
      const swirl = (1 - eased) * 2.1 + time * .12
      const x = centerX + Math.cos(angle + swirl) * radius + Math.sin(time * .7 + index) * 7
      const y = centerY + Math.sin(angle + swirl) * radius * .64 + Math.cos(time * .62 + index) * 6
      const color = COLORS[index % COLORS.length]
      const size = 1 + (index % 5) * .58 * (1 - eased * .32)
      ctx.beginPath()
      ctx.arc(x, y, size, 0, TAU)
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * (.18 + (1 - eased) * .44)})`
      ctx.fill()
    }
    ctx.restore()
  }

  function renderCapsules(alpha, time, local) {
    for (let index = 0; index < objects.length; index += 1) {
      const object = objects[index]
      const angle = time * (.38 + object.speed * .11) + object.phase
      const x = width * object.slotX + Math.cos(angle) * width * (.018 + object.depth * .014)
      const y = height * object.slotY + Math.sin(angle * .86) * height * (.023 + object.depth * .016)
      const scaleIn = .62 + smooth(local) * .48
      const rx = width * (.032 + object.depth * .032) * scaleIn
      const ry = height * (.058 + object.depth * .047) * scaleIn
      const objectAlpha = alpha * (.18 + object.depth * .34)
      drawSuperellipse(ctx, x, y, rx, ry, angle * .44 + (index % 2 ? -.55 : .55), 5.8, .018, time * .45 + object.phase, rgba(object), objectAlpha, shapePoints)
    }
  }

  function renderScene(scene, alpha, time, local) {
    if (alpha <= .002) return
    if (scene === 0) renderRibbons(alpha, time, 'flight')
    else if (scene === 1) renderRibbons(alpha, time, 'vortex')
    else if (scene === 2) {
      renderRibbons(alpha * .24, time, 'pinch')
      renderPortals(alpha, time, local)
    } else if (scene === 3) renderParticleFlow(alpha, time, local, false)
    else if (scene === 4) {
      renderParticleFlow(alpha * .35, time, local, true)
      renderCapsules(alpha, time, local)
    } else renderRibbons(alpha, time, 'return')
  }

  function drawAmbient(time, timelineState) {
    const centerX = width * .5
    const centerY = height * .49
    const pulse = .5 + .5 * Math.sin(time * .34)
    const flash = timelineState.scene === 2 ? Math.sin(timelineState.local * Math.PI) * .07 : 0
    const radius = Math.max(width, height) * (.21 + pulse * .025)
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    gradient.addColorStop(0, `rgba(171,153,236,${.035 + flash})`)
    gradient.addColorStop(.48, 'rgba(90,75,140,.014)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  function drawScene(time) {
    const state = timeline(time)
    renderScene(state.scene, 1 - state.blend, time, state.local)
    renderScene(state.next, state.blend, time, state.blend)
    drawAmbient(time, state)
  }

  function reduceQuality() {
    if (qualityReduced || reduced) return
    qualityReduced = true
    renderScale = Math.max(.48, renderScale * .82)
    targetFps = Math.min(targetFps, economical ? 24 : 32)
    segments = Math.max(12, segments - 4)
    shapePoints = Math.max(34, shapePoints - 10)
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

    const started = performance.now()
    ctx.clearRect(0, 0, width, height)
    drawScene((now - epoch) / 1000)

    const cost = performance.now() - started
    slowFrameStreak = cost > 12 ? slowFrameStreak + 1 : Math.max(0, slowFrameStreak - 1)
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

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) mutation.addedNodes.forEach(attachFromNode)
  cleanupDisconnected()
})
observer.observe(root, { childList: true, subtree: true })
