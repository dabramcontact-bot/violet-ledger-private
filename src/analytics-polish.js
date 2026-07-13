// Violet Ledger — presentation layer for the analytics screen.
// Uses the existing React-rendered metrics and tables, adding hierarchy and responsive summaries
// without changing procurement data or Supabase queries.

const ANALYTICS_SELECTOR = '.analytics-stats'
let scheduled = false

const numberFrom = value => {
  const normalized = String(value || '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function supplierData(panel) {
  if (!panel) return []
  return [...panel.querySelectorAll('tbody tr')].map(row => {
    const cells = [...row.querySelectorAll('td')]
    const item = {
      row,
      name: cells[0]?.querySelector('b')?.textContent?.trim() || cells[0]?.textContent?.trim() || 'Без названия',
      total: numberFrom(cells[1]?.textContent),
      categories: numberFrom(cells[2]?.textContent),
      categoriesText: cells[3]?.textContent?.trim() || '—',
      signed: numberFrom(cells[4]?.textContent),
      revision: numberFrom(cells[5]?.textContent),
    }

    const labels = ['Агент', 'Товаров', 'Категорий', 'Товарная матрица', 'PI подписано', 'На доработке']
    cells.forEach((cell, index) => cell.dataset.label = labels[index] || '')
    row.classList.add('analytics-supplier-row')
    return item
  })
}

function categoryData(panel) {
  if (!panel) return []
  return [...panel.querySelectorAll('.category-bar')].map(row => {
    const item = {
      row,
      name: row.querySelector('b')?.textContent?.trim() || 'Без категории',
      suppliersText: row.querySelector('small')?.textContent?.trim() || '—',
      total: numberFrom(row.querySelector(':scope > strong')?.textContent),
    }
    row.classList.add('analytics-category-row')
    return item
  })
}

function ring(value, label) {
  const wrap = element('div', 'analytics-ring')
  wrap.style.setProperty('--analytics-value', `${Math.max(0, Math.min(100, value))}`)
  const center = element('div', 'analytics-ring-center')
  center.append(element('strong', '', `${Math.round(value)}%`), element('span', '', label))
  wrap.append(center)
  return wrap
}

function buildInsightStrip({ totalProducts, supplierCount, categoryCount, signed, revision, topSupplier, topCategory }) {
  const signedRate = totalProducts ? signed / totalProducts * 100 : 0
  const strip = element('section', 'analytics-insight-strip')
  strip.dataset.analyticsGenerated = 'true'
  strip.setAttribute('aria-label', 'Ключевые выводы аналитики')

  const conversion = element('article', 'analytics-insight analytics-insight-conversion')
  const conversionCopy = element('div', 'analytics-insight-copy')
  conversionCopy.append(
    element('small', '', 'ГОТОВНОСТЬ PI'),
    element('strong', '', `${signed} из ${totalProducts}`),
    element('p', '', 'Подписанные PI в общей товарной матрице'),
  )
  conversion.append(ring(signedRate, 'подписано'), conversionCopy)

  const attention = element('article', `analytics-insight analytics-insight-attention ${revision ? 'has-alerts' : ''}`)
  const attentionMark = element('div', 'analytics-insight-mark', revision ? '!' : '✓')
  const attentionCopy = element('div', 'analytics-insight-copy')
  attentionCopy.append(
    element('small', '', 'ТРЕБУЮТ ВНИМАНИЯ'),
    element('strong', '', String(revision)),
    element('p', '', revision ? 'PI находятся на доработке' : 'Нет PI на доработке'),
  )
  attention.append(attentionMark, attentionCopy)

  const supplier = element('article', 'analytics-insight analytics-insight-leader')
  const supplierCopy = element('div', 'analytics-insight-copy')
  supplierCopy.append(
    element('small', '', 'ЛИДЕР ПО ОБЪЁМУ'),
    element('strong', '', topSupplier?.name || 'Нет данных'),
    element('p', '', topSupplier ? `${topSupplier.total} товаров · ${topSupplier.categories} категорий` : `${supplierCount} агентов в системе`),
  )
  supplier.append(element('div', 'analytics-leader-index', '01'), supplierCopy)

  const category = element('article', 'analytics-insight analytics-insight-category')
  const categoryCopy = element('div', 'analytics-insight-copy')
  categoryCopy.append(
    element('small', '', 'КЛЮЧЕВАЯ КАТЕГОРИЯ'),
    element('strong', '', topCategory?.name || 'Нет данных'),
    element('p', '', topCategory ? `${topCategory.total} товарных позиций` : `${categoryCount} категорий в системе`),
  )
  category.append(element('div', 'analytics-category-glyph', '◇'), categoryCopy)

  strip.append(conversion, attention, supplier, category)
  return strip
}

function enhanceAnalytics(stats) {
  const content = stats.parentElement
  if (!content) return

  const supplierPanel = [...content.children].find(node => node.classList?.contains('supplier-table-panel'))
  const categoryPanel = supplierPanel?.nextElementSibling?.classList?.contains('panel')
    ? supplierPanel.nextElementSibling
    : null

  content.classList.add('analytics-page-active')
  stats.classList.add('analytics-metrics')
  supplierPanel?.classList.add('analytics-supplier-panel')
  categoryPanel?.classList.add('analytics-category-panel')

  const statCards = [...stats.querySelectorAll('.stat')]
  statCards.forEach((card, index) => {
    card.classList.add('analytics-metric-card')
    card.style.setProperty('--metric-order', String(index))
  })

  const metricValues = statCards.map(card => numberFrom(card.querySelector('strong')?.textContent))
  const suppliers = supplierData(supplierPanel)
  const categories = categoryData(categoryPanel)
  const maxSupplier = Math.max(1, ...suppliers.map(item => item.total))
  const maxCategory = Math.max(1, ...categories.map(item => item.total))

  suppliers.forEach(item => {
    item.row.style.setProperty('--supplier-share', `${item.total / maxSupplier * 100}%`)
    item.row.style.setProperty('--signed-share', `${item.total ? item.signed / item.total * 100 : 0}%`)
  })
  categories.forEach(item => item.row.style.setProperty('--category-share', `${item.total / maxCategory * 100}%`))

  const signed = suppliers.reduce((sum, item) => sum + item.signed, 0)
  const revision = suppliers.reduce((sum, item) => sum + item.revision, 0)
  const signature = [
    metricValues.join('|'),
    suppliers.map(item => `${item.name}:${item.total}:${item.signed}:${item.revision}`).join('|'),
    categories.map(item => `${item.name}:${item.total}`).join('|'),
  ].join('::')

  if (content.dataset.analyticsSignature === signature && content.querySelector('[data-analytics-generated]')) return
  content.dataset.analyticsSignature = signature
  content.querySelectorAll('[data-analytics-generated]').forEach(node => node.remove())

  const insightStrip = buildInsightStrip({
    supplierCount: metricValues[0] || suppliers.length,
    totalProducts: metricValues[1] || suppliers.reduce((sum, item) => sum + item.total, 0),
    categoryCount: metricValues[2] || categories.length,
    signed,
    revision,
    topSupplier: suppliers[0],
    topCategory: categories[0],
  })
  stats.insertAdjacentElement('afterend', insightStrip)

  supplierPanel?.querySelector('.panel-head')?.classList.add('analytics-panel-heading')
  categoryPanel?.querySelector('.panel-head')?.classList.add('analytics-panel-heading')
}

function cleanupAnalytics() {
  const content = document.querySelector('.content.analytics-page-active')
  if (!content || content.querySelector(ANALYTICS_SELECTOR)) return
  content.classList.remove('analytics-page-active')
  delete content.dataset.analyticsSignature
  content.querySelectorAll('[data-analytics-generated]').forEach(node => node.remove())
}

function scanAnalytics() {
  scheduled = false
  const stats = document.querySelector(ANALYTICS_SELECTOR)
  if (stats) enhanceAnalytics(stats)
  else cleanupAnalytics()
}

function scheduleScan() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(scanAnalytics)
}

scheduleScan()

const analyticsRoot = document.getElementById('root') || document.body
const analyticsObserver = new MutationObserver(scheduleScan)
analyticsObserver.observe(analyticsRoot, { childList: true, subtree: true, characterData: true })
