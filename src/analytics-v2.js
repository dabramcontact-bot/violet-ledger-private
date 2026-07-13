// Violet Ledger — stable analytics category view.
// Builds a presentation layer from the existing React-rendered analytics data.

const ANALYTICS_ROOT_SELECTOR = '.analytics-stats'
let scanQueued = false
let activeDrawer = null

const make = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const numberFrom = value => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU')

const plural = (value, one, few, many) => {
  const number = Math.abs(Number(value) || 0) % 100
  const tail = number % 10
  if (number > 10 && number < 20) return many
  if (tail === 1) return one
  if (tail >= 2 && tail <= 4) return few
  return many
}

function parseSuppliers(panel) {
  if (!panel) return []
  return [...panel.querySelectorAll('tbody tr')].map(row => {
    const cells = [...row.querySelectorAll('td')]
    return {
      name: cells[0]?.querySelector('b')?.textContent?.trim() || cells[0]?.textContent?.trim() || 'Без названия',
      total: numberFrom(cells[1]?.textContent),
      categoriesCount: numberFrom(cells[2]?.textContent),
      categoryText: cells[3]?.textContent?.trim() || '',
      signed: numberFrom(cells[4]?.textContent),
      revision: numberFrom(cells[5]?.textContent),
    }
  })
}

function parseCategories(list) {
  if (!list) return []
  return [...list.querySelectorAll(':scope > .category-bar')].map((row, index) => ({
    index,
    name: row.querySelector('b')?.textContent?.trim() || 'Без категории',
    agentsCount: numberFrom(row.querySelector('small')?.textContent),
    total: numberFrom(row.querySelector(':scope > strong')?.textContent),
  }))
}

function closeDrawer() {
  if (!activeDrawer) return
  activeDrawer.classList.remove('is-open')
  document.body.classList.remove('analytics-v2-lock')
  const drawer = activeDrawer
  activeDrawer = null
  window.setTimeout(() => drawer.remove(), 220)
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'AG'
}

function openDrawer(category, suppliers) {
  closeDrawer()

  const related = suppliers.filter(supplier => normalize(supplier.categoryText).includes(normalize(category.name)))
  const shell = make('div', 'analytics-v2-drawer-shell')
  shell.setAttribute('role', 'presentation')

  const backdrop = make('button', 'analytics-v2-drawer-backdrop')
  backdrop.type = 'button'
  backdrop.setAttribute('aria-label', 'Закрыть список агентов')
  backdrop.addEventListener('click', closeDrawer)

  const drawer = make('aside', 'analytics-v2-drawer')
  drawer.setAttribute('role', 'dialog')
  drawer.setAttribute('aria-modal', 'true')
  drawer.setAttribute('aria-label', `Агенты категории ${category.name}`)

  const header = make('div', 'analytics-v2-drawer-head')
  const heading = make('div', 'analytics-v2-drawer-heading')
  heading.append(
    make('small', '', 'НАПРАВЛЕННЫЕ ПРЕДЛОЖЕНИЯ'),
    make('h3', '', category.name),
    make('p', '', `${related.length} ${plural(related.length, 'агент связан', 'агента связаны', 'агентов связаны')} с этой категорией`),
  )

  const close = make('button', 'analytics-v2-drawer-close', '×')
  close.type = 'button'
  close.setAttribute('aria-label', 'Закрыть')
  close.addEventListener('click', closeDrawer)
  header.append(heading, close)

  const categorySummary = make('div', 'analytics-v2-drawer-summary')
  ;[
    ['Товаров', category.total],
    ['Агентов', related.length || category.agentsCount],
  ].forEach(([label, value]) => {
    const metric = make('div', 'analytics-v2-drawer-metric')
    metric.append(make('strong', '', String(value)), make('span', '', label))
    categorySummary.append(metric)
  })

  const body = make('div', 'analytics-v2-drawer-body')
  if (related.length) {
    related.forEach((supplier, index) => {
      const card = make('article', 'analytics-v2-agent-card')
      const top = make('div', 'analytics-v2-agent-top')
      const avatar = make('span', 'analytics-v2-agent-avatar', initials(supplier.name))
      const copy = make('div', 'analytics-v2-agent-copy')
      copy.append(
        make('small', '', `АГЕНТ ${String(index + 1).padStart(2, '0')}`),
        make('h4', '', supplier.name),
        make('p', '', 'Связан с товарными предложениями этой категории'),
      )
      top.append(avatar, copy)

      const metrics = make('div', 'analytics-v2-agent-metrics')
      ;[
        ['Всего товаров', supplier.total],
        ['PI подписано', supplier.signed],
        ['На доработке', supplier.revision],
      ].forEach(([label, value]) => {
        const metric = make('div', 'analytics-v2-agent-metric')
        metric.append(make('strong', '', String(value)), make('span', '', label))
        metrics.append(metric)
      })
      card.append(top, metrics)
      body.append(card)
    })
  } else {
    const empty = make('div', 'analytics-v2-drawer-empty')
    empty.append(
      make('span', '', '—'),
      make('strong', '', 'Связанные агенты не найдены'),
      make('p', '', 'В текущей матрице нет агента с этой категорией. Проверьте название категории в запросах.'),
    )
    body.append(empty)
  }

  drawer.append(header, categorySummary, body)
  shell.append(backdrop, drawer)
  document.body.append(shell)
  document.body.classList.add('analytics-v2-lock')
  activeDrawer = shell

  requestAnimationFrame(() => shell.classList.add('is-open'))
  close.focus()
}

function summaryCard(label, value, note, tone) {
  const card = make('article', `analytics-v2-summary analytics-v2-summary-${tone}`)
  card.append(make('small', '', label), make('strong', '', String(value)), make('span', '', note))
  return card
}

function categoryCard(category, maxTotal, suppliers) {
  const card = make('button', 'analytics-v2-category-card')
  card.type = 'button'
  card.setAttribute('aria-label', `Открыть агентов категории ${category.name}`)
  card.style.setProperty('--analytics-v2-share', `${Math.max(8, category.total / Math.max(maxTotal, 1) * 100)}%`)

  const top = make('div', 'analytics-v2-category-top')
  const rank = make('span', 'analytics-v2-category-rank', String(category.index + 1).padStart(2, '0'))
  const copy = make('div', 'analytics-v2-category-copy')
  copy.append(
    make('h3', '', category.name),
    make('p', '', `${category.agentsCount} ${plural(category.agentsCount, 'агент', 'агента', 'агентов')}`),
  )
  const amount = make('div', 'analytics-v2-category-amount')
  amount.append(make('strong', '', String(category.total)), make('span', '', plural(category.total, 'позиция', 'позиции', 'позиций')))
  top.append(rank, copy, amount)

  const progress = make('div', 'analytics-v2-category-progress')
  progress.append(make('i', ''))

  const footer = make('div', 'analytics-v2-category-footer')
  footer.append(make('span', '', 'Смотреть агентов'), make('b', '', '→'))

  card.append(top, progress, footer)
  card.addEventListener('click', () => openDrawer(category, suppliers))
  return card
}

function enhanceAnalytics(stats) {
  const content = stats.parentElement
  if (!content) return

  const supplierPanel = content.querySelector('.supplier-table-panel')
  const categoryList = content.querySelector('.category-bars')
  const categoryPanel = categoryList?.closest('.panel')
  if (!supplierPanel || !categoryList || !categoryPanel) return

  const suppliers = parseSuppliers(supplierPanel)
  const categories = parseCategories(categoryList)
  const signature = JSON.stringify({ suppliers, categories })
  if (categoryPanel.dataset.analyticsV2Signature === signature && categoryPanel.querySelector('.analytics-v2-category-view')) return

  categoryPanel.dataset.analyticsV2Signature = signature
  categoryPanel.classList.add('analytics-v2-panel')
  content.classList.add('analytics-v2-page')

  categoryPanel.querySelectorAll(':scope > .analytics-v2-category-view').forEach(node => node.remove())
  categoryList.hidden = true

  const view = make('div', 'analytics-v2-category-view')
  const head = categoryPanel.querySelector(':scope > .panel-head')
  if (head) {
    head.classList.add('analytics-v2-panel-head')
    const title = head.querySelector('h2')
    const tag = head.querySelector('.panel-tag')
    if (tag) tag.textContent = 'CATEGORY MATRIX'
    if (title) title.textContent = 'Категории и направленные предложения'
    let description = head.querySelector('p')
    if (!description) {
      description = make('p', '', 'Нажмите на категорию, чтобы увидеть связанных китайских агентов и состояние PI.')
      head.querySelector('div')?.append(description)
    } else {
      description.textContent = 'Нажмите на категорию, чтобы увидеть связанных китайских агентов и состояние PI.'
    }
  }

  const topCategory = categories[0]
  const totalProducts = categories.reduce((sum, category) => sum + category.total, 0)
  const summaries = make('section', 'analytics-v2-summaries')
  summaries.append(
    summaryCard('Категорий', categories.length, 'в товарной матрице', 'violet'),
    summaryCard('Всего товаров', totalProducts, 'распределено по категориям', 'blue'),
    summaryCard('Лидер', topCategory?.name || 'Нет данных', topCategory ? `${topCategory.total} ${plural(topCategory.total, 'позиция', 'позиции', 'позиций')}` : 'добавьте запросы', 'green'),
  )

  const grid = make('section', 'analytics-v2-category-grid')
  const maxTotal = Math.max(1, ...categories.map(category => category.total))
  categories.forEach(category => grid.append(categoryCard(category, maxTotal, suppliers)))

  if (!categories.length) {
    const empty = make('div', 'analytics-v2-empty')
    empty.append(make('strong', '', 'Категорий пока нет'), make('p', '', 'Добавьте запросы с заполненной категорией товара.'))
    grid.append(empty)
  }

  view.append(summaries, grid)
  categoryPanel.append(view)
}

function cleanupAnalytics() {
  closeDrawer()
  document.querySelectorAll('.analytics-v2-page').forEach(content => {
    if (!content.querySelector(ANALYTICS_ROOT_SELECTOR)) content.classList.remove('analytics-v2-page')
  })
}

function scan() {
  scanQueued = false
  const stats = document.querySelector(ANALYTICS_ROOT_SELECTOR)
  if (stats) enhanceAnalytics(stats)
  else cleanupAnalytics()
}

function scheduleScan() {
  if (scanQueued) return
  scanQueued = true
  requestAnimationFrame(scan)
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeDrawer()
})

scheduleScan()
const root = document.getElementById('root') || document.body
new MutationObserver(scheduleScan).observe(root, { childList: true, subtree: true })
