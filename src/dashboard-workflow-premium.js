/* Rebuild the dashboard's three-stage story without changing React data flow. */

const SOURCE_SELECTOR = '.story-products'
let observedDataNode = null
let sourceObserver = null
let rootFrame = 0

const icon = name => {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
  const paths = {
    route: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.5l4.2 8M17.5 7.5l-4.2 8"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9M8 5.2l8 4.6"/>',
    check: '<path d="M20 11a8 8 0 1 1-3.3-6.5"/><path d="m9 11 2 2 5-6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7.2A8 8 0 0 1 19 9M5 15a8 8 0 0 0 12.9 1.8"/>',
    factory: '<path d="M3 21h18V9l-6 3V9l-6 3V5H3v16Z"/><path d="M7 16h2M12 16h2M17 16h1M6 5V2h3v3"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    warehouse: '<path d="m3 9 9-6 9 6v12H3V9Z"/><path d="M7 21v-8h10v8M7 10h10"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  }
  return `<svg ${common}>${paths[name] || paths.package}</svg>`
}

const readNumber = (root, selector) => {
  const raw = root.querySelector(selector)?.textContent || '0'
  const match = raw.replace(/\s+/g, '').match(/-?\d+/)
  return match ? Number(match[0]) : 0
}

function readMetrics(source) {
  const total = readNumber(source, '.story-cloud span')
  const active = readNumber(source, '.story-floating-pill strong')
  const offers = readNumber(source, '.message-one b')
  const revision = readNumber(source, '.message-two b')
  const signed = readNumber(source, '.story-coin span')
  const routeNumbers = [...source.querySelectorAll('.story-route-metrics b')].map(node => Number(node.textContent.trim()) || 0)
  const inTransit = routeNumbers[0] || 0
  const arrived = routeNumbers[1] || 0
  const piTotal = offers + revision + signed
  const piProgress = piTotal ? Math.round(signed / piTotal * 100) : 0
  return { total, active, offers, revision, signed, inTransit, arrived, piTotal, piProgress }
}

function createMarkup() {
  const shell = document.createElement('div')
  shell.className = 'premium-workflow-showcase-inner'
  shell.innerHTML = `
    <div class="premium-workflow-heading">
      <div class="premium-workflow-badge">${icon('route')}<span>Три рабочих этапа</span></div>
      <h2>Запрос. PI. Доставка.</h2>
      <p>Не таблица на главной, а наглядный путь каждой закупки — от первого запроса до поступления товара на склад.</p>
    </div>

    <div class="premium-workflow-grid">
      <article class="premium-flow-card premium-flow-requests">
        <button type="button" class="premium-card-action" data-go="requests" aria-label="Открыть реестр запросов">${icon('arrow')}</button>
        <h3>Все запросы<br>в одном месте.</h3>
        <p>Централизованный контроль каждой позиции: активная работа, подписанные PI и общий объём закупок.</p>
        <div class="premium-request-document" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
          <span>${icon('package')}</span>
        </div>
        <div class="premium-request-summary">
          <div class="premium-summary-main">
            <span class="premium-summary-icon">${icon('clipboard')}</span>
            <span class="premium-summary-copy"><small>ОБЩАЯ МАТРИЦА</small><b>Активные запросы</b></span>
            <strong data-metric="active">0</strong>
          </div>
          <div class="premium-summary-stats">
            <span><small>Всего</small><b data-metric="total">0</b></span>
            <span><small>В работе</small><b data-metric="active-secondary">0</b></span>
            <span><small>PI подписано</small><b data-metric="signed-left">0</b></span>
          </div>
        </div>
      </article>

      <article class="premium-flow-card premium-flow-pi">
        <button type="button" class="premium-card-action" data-go="requests" aria-label="Открыть запросы и PI">${icon('arrow')}</button>
        <h3>PI движется быстро.<br>Даже после правок.</h3>
        <p>Статус документа виден сразу: сколько ответов получено, что подписано и что вернулось на доработку.</p>
        <div class="premium-pi-stage">
          <div class="premium-pi-chip">
            <i>${icon('check')}</i><small>Получено</small><b data-metric="offers">0</b>
          </div>
          <div class="premium-pi-ring">
            <div class="premium-pi-ring-copy"><strong data-metric="signed">0</strong><span>PI подписано</span></div>
          </div>
          <div class="premium-pi-chip">
            <i>${icon('refresh')}</i><small>На доработке</small><b data-metric="revision">0</b>
          </div>
        </div>
        <div class="premium-pi-footer"><span>Общий прогресс PI</span><b data-metric="pi-note">Пока нет активных PI</b></div>
      </article>

      <article class="premium-flow-card premium-flow-route">
        <button type="button" class="premium-card-action" data-go="logistics" aria-label="Открыть логистику">${icon('arrow')}</button>
        <h3>Путь от фабрики<br>до склада виден целиком.</h3>
        <p>Каждая поставка находится на своём этапе, а ключевые показатели маршрута всегда перед глазами.</p>
        <div class="premium-route-stage">
          <div class="premium-route-track">
            <span class="premium-route-line" aria-hidden="true"></span>
            <div class="premium-route-node"><i>${icon('factory')}</i><b>Фабрика</b></div>
            <div class="premium-route-node"><i>${icon('truck')}</i><b>В пути</b></div>
            <div class="premium-route-node"><i>${icon('warehouse')}</i><b>Склад</b></div>
          </div>
          <div class="premium-route-metrics">
            <div class="premium-route-metric"><i>${icon('pin')}</i><strong data-metric="transit">0</strong><span>сейчас в пути</span></div>
            <div class="premium-route-metric"><i>${icon('warehouse')}</i><strong data-metric="arrived">0</strong><span>принято на складе</span></div>
          </div>
        </div>
      </article>
    </div>
  `

  shell.addEventListener('click', event => {
    const button = event.target.closest('[data-go]')
    if (!button) return
    const destination = button.dataset.go
    const label = destination === 'logistics' ? 'Логистика' : 'Запросы'
    const navButton = [...document.querySelectorAll('aside nav button, .mobile-bottom-nav button')]
      .find(node => node.textContent.trim().includes(label))
    navButton?.click()
  })

  return shell
}

function updateShowcase(showcase, metrics) {
  const set = (name, value) => {
    const next = String(value)
    showcase.querySelectorAll(`[data-metric="${name}"]`).forEach(node => {
      if (node.textContent !== next) node.textContent = next
    })
  }
  set('total', metrics.total)
  set('active', metrics.active)
  set('active-secondary', metrics.active)
  set('signed-left', metrics.signed)
  set('offers', metrics.offers)
  set('revision', metrics.revision)
  set('signed', metrics.signed)
  set('transit', metrics.inTransit)
  set('arrived', metrics.arrived)
  set('pi-note', metrics.piTotal ? `${metrics.signed} из ${metrics.piTotal} завершено · ${metrics.piProgress}%` : 'Пока нет активных PI')

  const ring = showcase.querySelector('.premium-pi-ring')
  const ringValue = `${metrics.piProgress * 3.6}deg`
  if (ring?.style.getPropertyValue('--pi-progress') !== ringValue) ring?.style.setProperty('--pi-progress', ringValue)
}

function connectSourceObserver(source, showcase) {
  const dataNode = source.querySelector(':scope > .story-grid') || source
  if (observedDataNode === dataNode && sourceObserver) return
  sourceObserver?.disconnect()
  observedDataNode = dataNode
  sourceObserver = new MutationObserver(() => updateShowcase(showcase, readMetrics(source)))
  sourceObserver.observe(dataNode, { childList: true, subtree: true, characterData: true })
}

function ensureShowcase() {
  rootFrame = 0
  const source = document.querySelector(SOURCE_SELECTOR)
  if (!source) return

  source.classList.add('workflow-premium-source')
  let showcase = source.querySelector(':scope > .premium-workflow-showcase-inner')
  if (!showcase) {
    showcase = createMarkup()
    source.append(showcase)
  }

  updateShowcase(showcase, readMetrics(source))
  connectSourceObserver(source, showcase)
}

function scheduleEnsure() {
  if (rootFrame) return
  rootFrame = requestAnimationFrame(ensureShowcase)
}

scheduleEnsure()
const root = document.getElementById('root') || document.body
new MutationObserver(scheduleEnsure).observe(root, { childList: true, subtree: true })
