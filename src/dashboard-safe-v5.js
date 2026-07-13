const HERO_SELECTOR = '.animated-hero[data-scene="hero"]'
const BODY_CLASS = 'safe-orbit-overview'
let currentHero = null
let pointerFrame = 0
let syncFrame = 0

const icons = {
  logistics: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/><path d="M2 20h22"/>',
  requests: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  payments: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 13h4"/>',
  route: '<path d="M5 7h10a3 3 0 0 1 3 3 3 3 0 0 1-3 3H9a3 3 0 0 0-3 3 3 3 0 0 0 3 3h10"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="19" r="2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
}

function svg(name, size = 28) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
}

function findNav(label) {
  return [...document.querySelectorAll('aside nav button, .mobile-bottom-nav button')]
    .find(button => button.textContent?.replace(/\s+/g, ' ').includes(label))
}

function goTo(label) {
  document.body.classList.remove(BODY_CLASS)
  findNav(label)?.click()
}

function cardMarkup(icon, label, note) {
  return `<span class="safe-orbit-card-icon">${svg(icon, 34)}</span><b>${label}</b><small>${note}</small>`
}

function prepareCard(node, icon, label, note, target) {
  if (!node) return
  node.classList.add('safe-orbit-card')
  node.setAttribute('role', 'button')
  node.setAttribute('tabindex', '0')
  node.setAttribute('aria-label', `Открыть раздел ${label}`)
  node.innerHTML = cardMarkup(icon, label, note)
  const open = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    goTo(target)
  }
  node.addEventListener('click', open)
  node.addEventListener('keydown', open)
}

function rewriteHero(hero) {
  const eyebrow = hero.querySelector('.hero-eyebrow')
  const firstLine = hero.querySelector('.hero-title-line:not(.hero-title-line-two)')
  const secondLine = hero.querySelector('.hero-title-line-two')
  const paragraph = hero.querySelector('.hero-copy > p')
  const action = hero.querySelector('.hero-actions .primary')
  const cue = hero.querySelector('.hero-scroll-cue')

  if (eyebrow) eyebrow.innerHTML = '<span></span> CHINA PROCUREMENT OPERATING SYSTEM <span></span>'
  if (firstLine) firstLine.textContent = 'Управление закупками'
  if (secondLine) secondLine.innerHTML = `для <i class="safe-route-orb">${svg('route', 36)}</i> всей <em>команды</em>`
  if (paragraph) paragraph.innerHTML = 'Контролируйте каждый этап поставок из Китая.<br>Прозрачно, быстро и в едином пространстве.'
  if (action) {
    action.innerHTML = `<span>Смотреть этапы</span>${svg('arrow', 22)}`
    action.onclick = event => {
      event.preventDefault()
      event.stopPropagation()
      goTo('Запросы')
    }
  }
  if (cue) cue.innerHTML = '<span>Рабочий контур</span><i></i>'
}

function enhanceHero(hero) {
  if (!hero || hero.dataset.safeOrbitEnhanced === 'true') return
  hero.dataset.safeOrbitEnhanced = 'true'
  hero.classList.add('safe-orbit-hero')
  rewriteHero(hero)

  prepareCard(hero.querySelector('.ambient-one'), 'logistics', 'Логистика', 'Перевозки и объём', 'Логистика')
  prepareCard(hero.querySelector('.ambient-two'), 'analytics', 'Аналитика', 'Динамика и показатели', 'Аналитика')
  prepareCard(hero.querySelector('.showcase-layer.layer-three'), 'requests', 'Запросы', 'Предложения поставщиков', 'Запросы')
  prepareCard(hero.querySelector('.showcase-layer.layer-two'), 'payments', 'Платежи', 'Сроки и напоминания', 'Платежи')

  const onPointer = event => {
    if (event.pointerType === 'touch' || pointerFrame) return
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0
      const rect = hero.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 2
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 2
      hero.style.setProperty('--safe-pointer-x', x.toFixed(3))
      hero.style.setProperty('--safe-pointer-y', y.toFixed(3))
    })
  }
  hero.addEventListener('pointermove', onPointer, { passive: true })
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--safe-pointer-x', '0')
    hero.style.setProperty('--safe-pointer-y', '0')
  })
}

function overviewIsActive() {
  return [...document.querySelectorAll('aside nav button')]
    .some(button => button.classList.contains('active') && button.textContent?.includes('Обзор'))
}

function sync() {
  syncFrame = 0
  const hero = document.querySelector(HERO_SELECTOR)
  const shouldActivate = Boolean(hero && overviewIsActive())
  document.body.classList.toggle(BODY_CLASS, shouldActivate)
  if (!shouldActivate) {
    currentHero = null
    return
  }
  currentHero = hero
  enhanceHero(hero)
}

function scheduleSync() {
  if (!syncFrame) syncFrame = requestAnimationFrame(sync)
}

document.addEventListener('click', event => {
  if (event.target.closest('aside nav button, .mobile-bottom-nav button')) requestAnimationFrame(scheduleSync)
}, true)

scheduleSync()
const observer = new MutationObserver(scheduleSync)
observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
