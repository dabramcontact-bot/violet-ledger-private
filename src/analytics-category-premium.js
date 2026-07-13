// Violet Ledger — premium category distribution presentation.
// Enhances the existing React markup without changing data or Supabase logic.

const CATEGORY_LIST_SELECTOR = '.category-bars'
const VISIBLE_LIMIT = 6
let scanScheduled = false

const plural = (value, one, few, many) => {
  const number = Math.abs(Number(value) || 0) % 100
  const tail = number % 10
  if (number > 10 && number < 20) return many
  if (tail === 1) return one
  if (tail >= 2 && tail <= 4) return few
  return many
}

const parseNumber = value => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const make = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function getCategoryRows(list) {
  return [...list.querySelectorAll(':scope > .category-bar')]
}

function normalizeRow(row, index, maxTotal) {
  row.classList.add('analytics-category-item')
  row.style.setProperty('--category-order', String(index))

  const meta = row.querySelector(':scope > div:first-child')
  const track = row.querySelector(':scope > .bar-track')
  const totalNode = row.querySelector(':scope > strong')

  if (meta) {
    meta.classList.add('analytics-category-meta')
    const rank = meta.querySelector(':scope > span')
    const title = meta.querySelector(':scope > b')
    const agents = meta.querySelector(':scope > small')

    rank?.classList.add('analytics-category-rank')

    let copy = meta.querySelector(':scope > .analytics-category-copy')
    if (!copy && title) {
      copy = make('div', 'analytics-category-copy')
      title.before(copy)
      copy.append(title)
      if (agents) copy.append(agents)
    }

    if (title) title.classList.add('analytics-category-name')
    if (agents) agents.classList.add('analytics-category-agents')
  }

  track?.classList.add('analytics-category-progress')

  const total = parseNumber(totalNode?.textContent)
  row.style.setProperty('--category-share', `${maxTotal ? Math.max(7, total / maxTotal * 100) : 0}%`)

  if (totalNode) {
    totalNode.classList.add('analytics-category-total')
    totalNode.dataset.caption = plural(total, 'позиция', 'позиции', 'позиций')
  }

  row.classList.toggle('is-category-leader', index === 0 && total > 0)
}

function buildOverview(panel, rows) {
  const head = panel.querySelector(':scope > .panel-head') || panel.querySelector('.panel-head')
  if (!head) return

  let overview = panel.querySelector(':scope > .analytics-category-overview')
  if (!overview) {
    overview = make('section', 'analytics-category-overview')
    overview.setAttribute('aria-label', 'Сводка по товарным категориям')
    head.insertAdjacentElement('afterend', overview)
  }

  const first = rows[0]
  const leaderName = first?.querySelector('.analytics-category-name')?.textContent?.trim() || 'Нет данных'
  const leaderTotal = parseNumber(first?.querySelector('.analytics-category-total')?.textContent)
  const totalProducts = rows.reduce((sum, row) => sum + parseNumber(row.querySelector('.analytics-category-total')?.textContent), 0)

  overview.replaceChildren()

  const items = [
    ['Категорий', String(rows.length), 'в активной матрице'],
    ['Лидер', leaderName, leaderTotal ? `${leaderTotal} ${plural(leaderTotal, 'позиция', 'позиции', 'позиций')}` : 'нет данных'],
    ['Всего товаров', String(totalProducts), 'распределено по категориям'],
  ]

  items.forEach(([label, value, note], index) => {
    const item = make('article', `analytics-category-summary analytics-category-summary-${index + 1}`)
    item.append(
      make('small', '', label),
      make('strong', '', value),
      make('span', '', note),
    )
    overview.append(item)
  })
}

function applyVisibility(panel, list, rows) {
  const expanded = panel.dataset.categoryExpanded === 'true'
  rows.forEach((row, index) => {
    row.hidden = !expanded && index >= VISIBLE_LIMIT
  })

  let footer = panel.querySelector(':scope > .analytics-category-footer')
  if (rows.length <= VISIBLE_LIMIT) {
    footer?.remove()
    return
  }

  if (!footer) {
    footer = make('div', 'analytics-category-footer')
    const button = make('button', 'analytics-category-toggle')
    button.type = 'button'
    button.addEventListener('click', () => {
      panel.dataset.categoryExpanded = panel.dataset.categoryExpanded === 'true' ? 'false' : 'true'
      applyVisibility(panel, list, getCategoryRows(list))
    })
    footer.append(button)
    list.insertAdjacentElement('afterend', footer)
  }

  const button = footer.querySelector('.analytics-category-toggle')
  if (button) {
    button.textContent = expanded ? 'Свернуть категории' : `Показать все категории · ${rows.length}`
    button.setAttribute('aria-expanded', String(expanded))
  }
}

function enhanceCategoryPanel(list) {
  const panel = list.closest('.panel')
  if (!panel) return

  panel.classList.add('analytics-category-premium')
  panel.closest('.content')?.classList.add('analytics-category-premium-active')

  const rows = getCategoryRows(list)
  const maxTotal = Math.max(1, ...rows.map(row => parseNumber(row.querySelector(':scope > strong')?.textContent)))
  const signature = rows.map(row => [
    row.querySelector('b')?.textContent?.trim(),
    row.querySelector('small')?.textContent?.trim(),
    row.querySelector(':scope > strong')?.textContent?.trim(),
  ].join(':')).join('|')

  rows.forEach((row, index) => normalizeRow(row, index, maxTotal))

  if (panel.dataset.categoryPremiumSignature !== signature) {
    panel.dataset.categoryPremiumSignature = signature
    buildOverview(panel, rows)
  }

  applyVisibility(panel, list, rows)
}

function cleanupCategoryMode() {
  document.querySelectorAll('.content.analytics-category-premium-active').forEach(content => {
    if (!content.querySelector(CATEGORY_LIST_SELECTOR)) content.classList.remove('analytics-category-premium-active')
  })
}

function scanCategoryPanel() {
  scanScheduled = false
  const list = document.querySelector(CATEGORY_LIST_SELECTOR)
  if (list) enhanceCategoryPanel(list)
  else cleanupCategoryMode()
}

function scheduleCategoryScan() {
  if (scanScheduled) return
  scanScheduled = true
  requestAnimationFrame(scanCategoryPanel)
}

scheduleCategoryScan()

const categoryRoot = document.getElementById('root') || document.body
const categoryObserver = new MutationObserver(scheduleCategoryScan)
categoryObserver.observe(categoryRoot, { childList: true, subtree: true, characterData: true })
