// Violet Ledger — clean interactive category analytics.
// Rebuilds the existing category distribution into a light clickable matrix
// and opens an agent drawer without changing Supabase or procurement data.

const CATEGORY_LIST_SELECTOR = '.category-bars'
const VISIBLE_LIMIT = 8
let scanScheduled = false

const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU')
const parseNumber = value => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}
const plural = (value, one, few, many) => {
  const number = Math.abs(Number(value) || 0) % 100
  const tail = number % 10
  if (number > 10 && number < 20) return many
  if (tail === 1) return one
  if (tail >= 2 && tail <= 4) return few
  return many
}
const make = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const getRows = list => [...list.querySelectorAll(':scope > .category-bar')]

function supplierDirectory(content) {
  return [...content.querySelectorAll('.analytics-supplier-panel tbody tr')].map(row => {
    const cells = [...row.querySelectorAll('td')]
    return {
      name: cells[0]?.querySelector('b')?.textContent?.trim() || cells[0]?.textContent?.trim() || 'Без названия',
      total: parseNumber(cells[1]?.textContent),
      categories: (cells[3]?.textContent || '').split(',').map(item => item.trim()).filter(Boolean),
      signed: parseNumber(cells[4]?.textContent),
      revision: parseNumber(cells[5]?.textContent),
    }
  })
}

function agentsForCategory(content, categoryName) {
  const target = normalize(categoryName)
  return supplierDirectory(content).filter(agent =>
    agent.categories.some(category => normalize(category) === target)
  )
}

function ensureDrawer(content) {
  let drawer = content.querySelector(':scope > .analytics-category-drawer')
  if (drawer) return drawer

  const backdrop = make('div', 'analytics-category-backdrop')
  backdrop.dataset.categoryDrawer = 'true'
  backdrop.hidden = true

  drawer = make('aside', 'analytics-category-drawer')
  drawer.hidden = true
  drawer.tabIndex = -1
  drawer.setAttribute('role', 'dialog')
  drawer.setAttribute('aria-modal', 'true')
  drawer.setAttribute('aria-label', 'Агенты по выбранной категории')

  const top = make('div', 'analytics-category-drawer-top')
  const kicker = make('small', '', 'НАПРАВЛЕННЫЕ ПРЕДЛОЖЕНИЯ')
  const close = make('button', 'analytics-category-drawer-close', '×')
  close.type = 'button'
  close.setAttribute('aria-label', 'Закрыть список агентов')
  top.append(kicker, close)

  drawer.append(
    top,
    make('h3', 'analytics-category-drawer-title'),
    make('p', 'analytics-category-drawer-summary'),
    make('div', 'analytics-category-agent-list'),
  )
  content.append(backdrop, drawer)

  const closeDrawer = () => {
    drawer.classList.remove('is-open')
    backdrop.classList.remove('is-open')
    document.documentElement.classList.remove('analytics-drawer-open')
    window.setTimeout(() => {
      drawer.hidden = true
      backdrop.hidden = true
    }, 220)
  }

  close.addEventListener('click', closeDrawer)
  backdrop.addEventListener('click', closeDrawer)
  drawer.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDrawer()
  })
  drawer.closeDrawer = closeDrawer
  return drawer
}

function openDrawer(content, categoryName, total, agentCount) {
  const drawer = ensureDrawer(content)
  const backdrop = content.querySelector(':scope > .analytics-category-backdrop')
  const agents = agentsForCategory(content, categoryName)

  drawer.querySelector('.analytics-category-drawer-title').textContent = categoryName
  drawer.querySelector('.analytics-category-drawer-summary').textContent =
    `${total} ${plural(total, 'товарная позиция', 'товарные позиции', 'товарных позиций')} · ${agentCount} ${plural(agentCount, 'агент', 'агента', 'агентов')}`

  const list = drawer.querySelector('.analytics-category-agent-list')
  list.replaceChildren()

  if (!agents.length) {
    const empty = make('div', 'analytics-category-agent-empty')
    empty.append(
      make('strong', '', 'Агенты не найдены'),
      make('span', '', 'В текущей товарной матрице нет связанного агента для этой категории.'),
    )
    list.append(empty)
  } else {
    agents.forEach((agent, index) => {
      const card = make('article', 'analytics-category-agent-card')
      const avatar = make('div', 'analytics-category-agent-avatar', agent.name.slice(0, 2).toUpperCase())
      const copy = make('div', 'analytics-category-agent-copy')
      copy.append(
        make('small', '', `АГЕНТ ${String(index + 1).padStart(2, '0')}`),
        make('strong', '', agent.name),
      )
      const metrics = make('div', 'analytics-category-agent-metrics')
      metrics.append(
        make('span', '', `${agent.total} товаров в матрице`),
        make('span', '', `${agent.signed} PI подписано`),
        make('span', agent.revision ? 'has-revision' : '', `${agent.revision} на доработке`),
      )
      card.append(avatar, copy, metrics)
      list.append(card)
    })
  }

  drawer.hidden = false
  backdrop.hidden = false
  requestAnimationFrame(() => {
    drawer.classList.add('is-open')
    backdrop.classList.add('is-open')
    drawer.focus({ preventScroll: true })
  })
  document.documentElement.classList.add('analytics-drawer-open')
}

function normalizeRow(row, index, maxTotal, content) {
  row.classList.add('analytics-category-item')
  row.style.setProperty('--category-order', String(index))

  const meta = row.querySelector(':scope > div:first-child')
  const track = row.querySelector(':scope > .bar-track')
  const totalNode = row.querySelector(':scope > strong')
  const rank = meta?.querySelector(':scope > span')
  const title = meta?.querySelector(':scope > b')
  const agents = meta?.querySelector(':scope > small')

  meta?.classList.add('analytics-category-meta')
  rank?.classList.add('analytics-category-rank')
  title?.classList.add('analytics-category-name')
  agents?.classList.add('analytics-category-agents')
  track?.classList.add('analytics-category-progress')
  totalNode?.classList.add('analytics-category-total')

  let copy = meta?.querySelector(':scope > .analytics-category-copy')
  if (meta && !copy && title) {
    copy = make('div', 'analytics-category-copy')
    title.before(copy)
    copy.append(title)
    if (agents) copy.append(agents)
  }

  let action = row.querySelector(':scope > .analytics-category-open')
  if (!action) {
    action = make('button', 'analytics-category-open')
    action.type = 'button'
    action.append(make('span', '', 'Смотреть агентов'), make('i', '', '→'))
    row.append(action)
  }

  const total = parseNumber(totalNode?.textContent)
  const categoryName = title?.textContent?.trim() || 'Без категории'
  row.style.setProperty('--category-share', `${maxTotal ? Math.max(8, total / maxTotal * 100) : 0}%`)
  row.classList.toggle('is-category-leader', index === 0 && total > 0)
  row.dataset.categoryName = categoryName

  if (!row.dataset.categoryClickBound) {
    row.dataset.categoryClickBound = 'true'
    const open = () => openDrawer(
      content,
      row.dataset.categoryName,
      parseNumber(row.querySelector('.analytics-category-total')?.textContent),
      parseNumber(row.querySelector('.analytics-category-agents')?.textContent),
    )
    row.addEventListener('click', open)
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
  }

  row.tabIndex = 0
  row.setAttribute('role', 'button')
  row.setAttribute('aria-label', `${categoryName}: показать агентов`)
}

function buildHeader(panel, rows) {
  const head = panel.querySelector(':scope > .panel-head') || panel.querySelector('.panel-head')
  if (!head) return
  head.classList.add('analytics-category-clean-head')

  let summary = panel.querySelector(':scope > .analytics-category-summaryline')
  if (!summary) {
    summary = make('div', 'analytics-category-summaryline')
    head.insertAdjacentElement('afterend', summary)
  }

  const totalProducts = rows.reduce((sum, row) => sum + parseNumber(row.querySelector(':scope > strong')?.textContent), 0)
  const leaderName = rows[0]?.querySelector('b')?.textContent?.trim() || 'Нет данных'
  const signature = `${rows.length}|${leaderName}|${totalProducts}`
  if (summary.dataset.signature === signature) return
  summary.dataset.signature = signature
  summary.replaceChildren(
    make('span', '', `${rows.length} ${plural(rows.length, 'категория', 'категории', 'категорий')}`),
    make('span', '', `Лидер · ${leaderName}`),
    make('span', '', `${totalProducts} ${plural(totalProducts, 'товар', 'товара', 'товаров')}`),
  )
}

function applyVisibility(panel, list, rows) {
  const expanded = panel.dataset.categoryExpanded === 'true'
  rows.forEach((row, index) => {
    const nextHidden = !expanded && index >= VISIBLE_LIMIT
    if (row.hidden !== nextHidden) row.hidden = nextHidden
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
      applyVisibility(panel, list, getRows(list))
    })
    footer.append(button)
    list.insertAdjacentElement('afterend', footer)
  }
  const button = footer.querySelector('.analytics-category-toggle')
  const label = expanded ? 'Свернуть категории' : `Показать все · ${rows.length}`
  if (button.textContent !== label) button.textContent = label
  if (button.getAttribute('aria-expanded') !== String(expanded)) button.setAttribute('aria-expanded', String(expanded))
}

function enhanceCategoryPanel(list) {
  const panel = list.closest('.panel')
  const content = panel?.closest('.content')
  if (!panel || !content) return

  panel.classList.add('analytics-category-clean')
  content.classList.add('analytics-category-clean-active')
  const rows = getRows(list)
  const maxTotal = Math.max(1, ...rows.map(row => parseNumber(row.querySelector(':scope > strong')?.textContent)))
  rows.forEach((row, index) => normalizeRow(row, index, maxTotal, content))
  buildHeader(panel, rows)
  applyVisibility(panel, list, rows)
  ensureDrawer(content)
}

function cleanup() {
  document.querySelectorAll('.content.analytics-category-clean-active').forEach(content => {
    if (!content.querySelector(CATEGORY_LIST_SELECTOR)) {
      content.querySelector('.analytics-category-drawer')?.closeDrawer?.()
      content.querySelectorAll('[data-category-drawer], .analytics-category-drawer').forEach(node => node.remove())
      content.classList.remove('analytics-category-clean-active')
    }
  })
}

function scan() {
  scanScheduled = false
  const list = document.querySelector(CATEGORY_LIST_SELECTOR)
  if (list) enhanceCategoryPanel(list)
  else cleanup()
}

function scheduleScan() {
  if (scanScheduled) return
  scanScheduled = true
  requestAnimationFrame(scan)
}

scheduleScan()
const root = document.getElementById('root') || document.body
const observer = new MutationObserver(scheduleScan)
observer.observe(root, { childList: true, subtree: true, characterData: true })
