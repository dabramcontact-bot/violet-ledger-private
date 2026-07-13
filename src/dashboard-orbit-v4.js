const ROOT_ID = 'vl-orbit-dashboard-v4'
const BODY_CLASS = 'vl-orbit-dashboard-active'
let active = false
let mountFrame = 0
let pointerFrame = 0
let pendingPointer = { x: 0, y: 0 }

const icons = {
  route: '<path d="M5 7h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h10"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="19" r="2"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/><path d="M2 20h22"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  wallet: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 13h4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
}

function svg(name, size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
}

function particles() {
  return Array.from({ length: 42 }, (_, index) => {
    const left = (index * 37 + 11) % 100
    const top = (index * 53 + 7) % 100
    const size = 1 + (index % 3)
    const delay = -((index * 0.37) % 7).toFixed(2)
    const duration = 5 + (index % 6)
    return `<i style="--star-x:${left}%;--star-y:${top}%;--star-size:${size}px;--star-delay:${delay}s;--star-duration:${duration}s"></i>`
  }).join('')
}

function orbitCard(kind, label, icon, className, description) {
  return `<button type="button" class="orbit-feature-card ${className}" data-go="${kind}" aria-label="Открыть раздел ${label}">
    <span class="orbit-card-icon">${svg(icon, 38)}</span>
    <b>${label}</b>
    <small>${description}</small>
  </button>`
}

function pageMarkup() {
  return `<section class="orbit-dashboard" aria-label="Главная страница Violet Ledger">
    <div class="orbit-stars" aria-hidden="true">${particles()}</div>
    <div class="orbit-aurora aurora-left" aria-hidden="true"></div>
    <div class="orbit-aurora aurora-right" aria-hidden="true"></div>
    <div class="orbit-cursor-glow" aria-hidden="true"></div>

    <svg class="orbit-map" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="orbit-line-one" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7c4dff" stop-opacity=".18"/>
          <stop offset=".48" stop-color="#b074ff" stop-opacity=".92"/>
          <stop offset="1" stop-color="#7240e8" stop-opacity=".16"/>
        </linearGradient>
        <linearGradient id="orbit-line-two" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7b58ff" stop-opacity=".08"/>
          <stop offset=".52" stop-color="#975df6" stop-opacity=".72"/>
          <stop offset="1" stop-color="#6042cf" stop-opacity=".1"/>
        </linearGradient>
        <filter id="orbit-node-glow" x="-200%" y="-200%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <path id="orbit-path-main" d="M-40 340 C 310 860, 1120 930, 1650 430"/>
        <path id="orbit-path-upper" d="M-80 210 C 460 760, 1230 670, 1650 90"/>
        <path id="orbit-path-dash" d="M80 620 C 510 980, 1260 680, 1570 260"/>
      </defs>
      <use href="#orbit-path-main" class="orbit-line orbit-line-main"/>
      <use href="#orbit-path-upper" class="orbit-line orbit-line-upper"/>
      <use href="#orbit-path-dash" class="orbit-line orbit-line-dashed"/>
      <circle r="6" class="orbit-moving-dot dot-one" filter="url(#orbit-node-glow)"><animateMotion dur="12s" repeatCount="indefinite"><mpath href="#orbit-path-main"/></animateMotion></circle>
      <circle r="4" class="orbit-moving-dot dot-two" filter="url(#orbit-node-glow)"><animateMotion dur="17s" begin="-7s" repeatCount="indefinite"><mpath href="#orbit-path-upper"/></animateMotion></circle>
      <circle r="3.5" class="orbit-moving-dot dot-three" filter="url(#orbit-node-glow)"><animateMotion dur="15s" begin="-4s" repeatCount="indefinite"><mpath href="#orbit-path-dash"/></animateMotion></circle>
      <circle cx="242" cy="635" r="5" class="orbit-static-dot"/>
      <circle cx="1000" cy="781" r="7" class="orbit-static-dot large"/>
      <circle cx="1410" cy="615" r="4" class="orbit-static-dot"/>
    </svg>

    <div class="orbit-features" aria-label="Разделы системы">
      ${orbitCard('logistics', 'Логистика', 'truck', 'feature-logistics', 'Перевозки и объём')}
      ${orbitCard('analytics', 'Аналитика', 'chart', 'feature-analytics', 'Динамика и показатели')}
      ${orbitCard('requests', 'Запросы', 'clipboard', 'feature-requests', 'Предложения поставщиков')}
      ${orbitCard('payments', 'Платежи', 'wallet', 'feature-payments', 'Сроки и напоминания')}
    </div>

    <div class="orbit-hero-copy">
      <div class="orbit-kicker"><span></span> CHINA PROCUREMENT OPERATING SYSTEM <span></span></div>
      <h1>
        <span>Управление закупками</span>
        <span class="orbit-title-second">для <i class="orbit-route-orb">${svg('route', 39)}</i> всей <em>команды</em></span>
      </h1>
      <p>Контролируйте каждый этап поставок из Китая.<br>Прозрачно, быстро и в едином пространстве.</p>
      <button type="button" class="orbit-primary-action" data-go="requests">
        <span>Смотреть этапы</span>${svg('arrow', 24)}
      </button>
    </div>

    <button type="button" class="orbit-scroll-cue" data-scroll="true" aria-label="Показать разделы">
      <span>Рабочий контур</span>${svg('chevron', 22)}
    </button>
  </section>`
}

function findNavButton(label) {
  return [...document.querySelectorAll('aside nav button')].find(button => button.textContent.replace(/\s+/g, ' ').includes(label))
}

function goTo(kind) {
  const labels = { requests: 'Запросы', logistics: 'Логистика', analytics: 'Аналитика', payments: 'Платежи' }
  const button = findNavButton(labels[kind])
  deactivate()
  button?.click()
}

function handleRootClick(event) {
  const target = event.target.closest('[data-go], [data-scroll]')
  if (!target) return
  event.preventDefault()
  if (target.dataset.go) goTo(target.dataset.go)
  else document.querySelector('.orbit-features')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function handlePointer(event) {
  if (!active || event.pointerType === 'touch') return
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  const rect = root.getBoundingClientRect()
  pendingPointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 2
  pendingPointer.y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 2
  if (pointerFrame) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    root.style.setProperty('--orbit-pointer-x', pendingPointer.x.toFixed(3))
    root.style.setProperty('--orbit-pointer-y', pendingPointer.y.toFixed(3))
    root.style.setProperty('--orbit-cursor-x', `${event.clientX - rect.left}px`)
    root.style.setProperty('--orbit-cursor-y', `${event.clientY - rect.top}px`)
  })
}

function resetPointer() {
  const root = document.getElementById(ROOT_ID)
  root?.style.setProperty('--orbit-pointer-x', '0')
  root?.style.setProperty('--orbit-pointer-y', '0')
}

function ensureRoot() {
  if (!active) return null
  const content = document.querySelector('main.content')
  if (!content) return null
  let root = document.getElementById(ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    root.className = 'orbit-dashboard-root'
    root.innerHTML = pageMarkup()
    root.addEventListener('click', handleRootClick)
    root.addEventListener('pointermove', handlePointer, { passive: true })
    root.addEventListener('pointerleave', resetPointer)
    content.append(root)
  }
  return root
}

function activate() {
  if (active) {
    ensureRoot()
    return
  }
  active = true
  document.body.classList.add(BODY_CLASS)
  ensureRoot()
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function deactivate() {
  if (!active) return
  active = false
  document.body.classList.remove(BODY_CLASS)
  document.getElementById(ROOT_ID)?.remove()
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
  pointerFrame = 0
}

function isOverviewButton(button) {
  return Boolean(button?.textContent?.replace(/\s+/g, ' ').includes('Обзор'))
}

document.addEventListener('click', event => {
  const navButton = event.target.closest('aside nav button, .mobile-bottom-nav button')
  if (!navButton) return
  if (isOverviewButton(navButton)) requestAnimationFrame(activate)
  else deactivate()
}, true)

function syncFromApp() {
  mountFrame = 0
  const overview = findNavButton('Обзор')
  if (overview?.classList.contains('active')) activate()
  else if (active && !document.querySelector('aside')) deactivate()
  if (active) ensureRoot()
}

function scheduleSync() {
  if (!mountFrame) mountFrame = requestAnimationFrame(syncFromApp)
}

scheduleSync()
new MutationObserver(scheduleSync).observe(document.getElementById('root') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
