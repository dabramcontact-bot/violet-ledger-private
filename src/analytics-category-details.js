import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CARD_SELECTOR = '.analytics-v2-category-card'
const REQUEST_FIELDS = [
  'id', 'request_number', 'category', 'product_name', 'agent_name', 'request_sent_at',
  'offer_received', 'offer_received_at', 'included_calculation', 'proposed_to_nikolai',
  'proposed_to_nikolai_at', 'pi_sent', 'pi_sent_at', 'pi_signed', 'pi_signed_at',
  'pi_revision', 'pi_revision_at', 'shipment_status', 'transit_started_at',
  'expected_warehouse_at', 'warehouse_arrived_at', 'workflow_steps',
  'price_not_viable', 'not_approved', 'updated_at'
].join(',')

const cache = new Map()
let activePanel = null
let liveChannel = null

const make = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
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

const parseDate = value => {
  if (!value) return null
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = value => {
  const date = value instanceof Date ? value : parseDate(value)
  return date
    ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : '—'
}

const addDays = (value, days) => {
  const date = parseDate(value)
  if (!date) return null
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function workflowStepState(row, key) {
  const raw = row?.workflow_steps?.[key]
  if (raw === true) return { done: true, completed_at: '' }
  if (!raw || typeof raw !== 'object') return { done: false, completed_at: '' }
  return { done: Boolean(raw.done), completed_at: raw.completed_at || '' }
}

function isPiOverdue(row) {
  const requestPi = workflowStepState(row, 'request_pi')
  const verified = workflowStepState(row, 'verify_characteristics').done
  if (!requestPi.done || !requestPi.completed_at || verified) return false
  if (row.pi_sent || row.pi_signed || row.price_not_viable || row.not_approved) return false
  const due = addDays(requestPi.completed_at, 2)
  if (!due) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function rowProgress(row) {
  const milestones = [
    Boolean(row.request_sent_at || row.request_number),
    Boolean(row.offer_received),
    Boolean(row.included_calculation),
    Boolean(row.proposed_to_nikolai),
    Boolean(row.pi_sent),
    Boolean(row.pi_signed),
    row.shipment_status === 'in_transit' || row.shipment_status === 'arrived',
    row.shipment_status === 'arrived',
  ]
  return milestones.filter(Boolean).length / milestones.length * 100
}

function lastActivityValue(row) {
  const candidates = [
    row.updated_at,
    row.warehouse_arrived_at,
    row.transit_started_at,
    row.pi_signed_at,
    row.pi_revision_at,
    row.pi_sent_at,
    row.proposed_to_nikolai_at,
    row.offer_received_at,
    row.request_sent_at,
  ].map(parseDate).filter(Boolean)
  if (!candidates.length) return 0
  return Math.max(...candidates.map(date => date.getTime()))
}

function stageMeta(row) {
  if (row.price_not_viable || row.not_approved) return ['Неуспешно', 'failed']
  if (row.shipment_status === 'arrived') return ['На складе', 'arrived']
  if (row.shipment_status === 'in_transit') return ['В пути', 'transit']
  if (row.pi_signed) return ['PI подписана', 'signed']
  if (row.pi_revision) return ['Доработка PI', 'revision']
  if (row.pi_sent) return ['PI отправлена', 'pi']
  if (row.proposed_to_nikolai) return ['На согласовании', 'proposed']
  if (row.included_calculation) return ['В расчёте', 'calculation']
  if (row.offer_received) return ['Ответ получен', 'offer']
  return ['Запрос отправлен', 'request']
}

function deadlineMeta(row) {
  if (row.shipment_status === 'arrived') {
    return { label: 'На складе', value: formatDate(row.warehouse_arrived_at), tone: 'success' }
  }
  if (row.shipment_status === 'in_transit' && row.expected_warehouse_at) {
    return { label: 'План склада', value: formatDate(row.expected_warehouse_at), tone: 'info' }
  }
  const requestPi = workflowStepState(row, 'request_pi')
  if (requestPi.done && requestPi.completed_at && !row.pi_sent && !row.pi_signed) {
    const due = addDays(requestPi.completed_at, 2)
    return { label: 'Срок PI', value: formatDate(due), tone: isPiOverdue(row) ? 'danger' : 'warning' }
  }
  if (row.pi_revision && row.pi_revision_at) {
    return { label: 'На доработке с', value: formatDate(row.pi_revision_at), tone: 'warning' }
  }
  return { label: 'Последнее действие', value: formatDate(new Date(lastActivityValue(row))), tone: 'muted' }
}

function aggregate(rows) {
  const agents = new Map()
  rows.forEach(row => {
    const name = row.agent_name || 'Без агента'
    if (!agents.has(name)) {
      agents.set(name, { name, total: 0, sent: 0, offers: 0, signed: 0, revision: 0, lastActivity: 0 })
    }
    const item = agents.get(name)
    item.total += 1
    if (row.request_sent_at) item.sent += 1
    if (row.offer_received) item.offers += 1
    if (row.pi_signed) item.signed += 1
    if (row.pi_revision && !row.pi_signed) item.revision += 1
    item.lastActivity = Math.max(item.lastActivity, lastActivityValue(row))
  })

  const problems = rows.filter(row =>
    (row.pi_revision && !row.pi_signed)
    || isPiOverdue(row)
    || row.price_not_viable
    || row.not_approved
  )

  const readiness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + rowProgress(row), 0) / rows.length)
    : 0

  return {
    total: rows.length,
    agents: [...agents.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    readiness,
    problems,
    overdue: rows.filter(isPiOverdue).length,
    revision: rows.filter(row => row.pi_revision && !row.pi_signed).length,
    unsuccessful: rows.filter(row => row.price_not_viable || row.not_approved).length,
  }
}

async function loadCategoryRows(category, force = false) {
  const key = normalize(category)
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.time < 30000) return cached.rows

  const { data, error } = await supabase
    .from('requests')
    .select(REQUEST_FIELDS)
    .eq('category', category)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error
  const rows = data || []
  cache.set(key, { rows, time: Date.now() })
  return rows
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

function metricCard(label, value, note, tone = '') {
  const card = make('article', `analytics-detail-metric ${tone ? `tone-${tone}` : ''}`)
  card.append(make('small', '', label), make('strong', '', String(value)), make('span', '', note))
  return card
}

function renderLoading(body) {
  body.replaceChildren()
  const loading = make('div', 'analytics-detail-loading')
  for (let index = 0; index < 6; index += 1) loading.append(make('i', ''))
  body.append(loading)
}

function renderError(body, category, error) {
  body.replaceChildren()
  const state = make('div', 'analytics-detail-error')
  state.append(
    make('span', '', '!'),
    make('strong', '', 'Не удалось загрузить данные категории'),
    make('p', '', error?.message || 'Проверьте соединение и повторите попытку.'),
  )
  const retry = make('button', '', 'Повторить')
  retry.type = 'button'
  retry.addEventListener('click', () => refreshPanel(category, true))
  state.append(retry)
  body.append(state)
}

function renderAgent(agent, index) {
  const card = make('article', 'analytics-detail-agent')
  const head = make('div', 'analytics-detail-agent-head')
  const avatar = make('span', 'analytics-detail-agent-avatar', initials(agent.name))
  const copy = make('div', 'analytics-detail-agent-copy')
  copy.append(
    make('small', '', `АГЕНТ ${String(index + 1).padStart(2, '0')}`),
    make('h4', '', agent.name),
    make('p', '', `Последнее действие: ${agent.lastActivity ? formatDate(new Date(agent.lastActivity)) : '—'}`),
  )
  const total = make('strong', 'analytics-detail-agent-total', String(agent.total))
  head.append(avatar, copy, total)

  const metrics = make('div', 'analytics-detail-agent-metrics')
  ;[
    ['Отправлено', agent.sent],
    ['Ответы', agent.offers],
    ['PI подписано', agent.signed],
    ['Доработка', agent.revision],
  ].forEach(([label, value]) => {
    const item = make('div', '')
    item.append(make('span', '', label), make('b', '', String(value)))
    metrics.append(item)
  })

  card.append(head, metrics)
  return card
}

function renderProduct(row) {
  const [stageLabel, stageTone] = stageMeta(row)
  const deadline = deadlineMeta(row)
  const card = make('article', 'analytics-detail-product')

  const main = make('div', 'analytics-detail-product-main')
  const heading = make('div', 'analytics-detail-product-copy')
  heading.append(
    make('small', '', row.request_number || 'Без номера'),
    make('h4', '', row.product_name || 'Без названия'),
    make('p', '', row.agent_name || 'Без агента'),
  )
  const stage = make('span', `analytics-detail-stage tone-${stageTone}`, stageLabel)
  main.append(heading, stage)

  const meta = make('div', 'analytics-detail-product-meta')
  const deadlineBlock = make('div', `analytics-detail-deadline tone-${deadline.tone}`)
  deadlineBlock.append(make('small', '', deadline.label), make('b', '', deadline.value))
  const open = make('button', 'analytics-detail-open-request', 'Открыть запрос')
  open.type = 'button'
  open.addEventListener('click', event => {
    event.stopPropagation()
    openRegistry(row.category, row.request_number)
  })
  meta.append(deadlineBlock, open)

  card.append(main, meta)
  return card
}

function renderPanel(panel, category, rows) {
  const summary = aggregate(rows)
  const body = panel.querySelector('.analytics-detail-body')
  const title = panel.querySelector('.analytics-detail-title h2')
  const subtitle = panel.querySelector('.analytics-detail-title p')
  if (title) title.textContent = category
  if (subtitle) subtitle.textContent = `${summary.total} ${plural(summary.total, 'товар', 'товара', 'товаров')} · ${summary.agents.length} ${plural(summary.agents.length, 'агент', 'агента', 'агентов')}`

  body.replaceChildren()

  const overview = make('section', 'analytics-detail-overview')
  const readiness = make('article', 'analytics-detail-readiness')
  const ring = make('div', 'analytics-detail-ring')
  ring.style.setProperty('--analytics-detail-progress', `${summary.readiness * 3.6}deg`)
  ring.append(make('strong', '', `${summary.readiness}%`), make('span', '', 'готовность'))
  const readinessCopy = make('div', '')
  readinessCopy.append(
    make('small', '', 'ОБЩИЙ ПРОГРЕСС'),
    make('h3', '', summary.readiness >= 75 ? 'Категория близка к завершению' : summary.readiness >= 40 ? 'Категория в активной работе' : 'Категория на начальном этапе'),
    make('p', '', 'Средний прогресс по запросу, PI, логистике и поступлению на склад.'),
  )
  readiness.append(ring, readinessCopy)

  const metrics = make('div', 'analytics-detail-metrics')
  metrics.append(
    metricCard('Товаров', summary.total, 'в выбранной категории', 'violet'),
    metricCard('Агентов', summary.agents.length, 'связаны с категорией', 'blue'),
    metricCard('Проблемных', summary.problems.length, `${summary.overdue} просрочено · ${summary.revision} доработка`, summary.problems.length ? 'danger' : 'green'),
  )
  overview.append(readiness, metrics)
  body.append(overview)

  const agentsSection = make('section', 'analytics-detail-section')
  const agentsHead = make('div', 'analytics-detail-section-head')
  agentsHead.append(
    make('div', '', ''),
    make('span', '', `${summary.agents.length} ${plural(summary.agents.length, 'агент', 'агента', 'агентов')}`),
  )
  agentsHead.firstChild.append(make('small', '', 'АГЕНТЫ'), make('h3', '', 'Работа по предложениям и PI'))
  const agentList = make('div', 'analytics-detail-agent-list')
  summary.agents.forEach((agent, index) => agentList.append(renderAgent(agent, index)))
  if (!summary.agents.length) agentList.append(make('div', 'analytics-detail-empty', 'Агенты для этой категории не найдены.'))
  agentsSection.append(agentsHead, agentList)
  body.append(agentsSection)

  const productsSection = make('section', 'analytics-detail-section')
  const productsHead = make('div', 'analytics-detail-section-head')
  productsHead.append(make('div', '', ''), make('span', '', `Последние ${Math.min(rows.length, 8)}`))
  productsHead.firstChild.append(make('small', '', 'ТОВАРЫ'), make('h3', '', 'Последние позиции категории'))
  const products = make('div', 'analytics-detail-product-list')
  rows
    .slice()
    .sort((a, b) => lastActivityValue(b) - lastActivityValue(a))
    .slice(0, 8)
    .forEach(row => products.append(renderProduct(row)))
  if (!rows.length) products.append(make('div', 'analytics-detail-empty', 'Товары этой категории не найдены.'))
  productsSection.append(productsHead, products)
  body.append(productsSection)

  const footer = panel.querySelector('.analytics-detail-footer')
  const button = footer?.querySelector('button')
  if (button) {
    button.onclick = () => openRegistry(category)
    button.disabled = false
  }
}

async function refreshPanel(category, force = false) {
  if (!activePanel || activePanel.category !== category) return
  const { panel, body, token } = activePanel
  renderLoading(body)
  try {
    const rows = await loadCategoryRows(category, force)
    if (!activePanel || activePanel.token !== token) return
    renderPanel(panel, category, rows)
  } catch (error) {
    if (!activePanel || activePanel.token !== token) return
    renderError(body, category, error)
  }
}

function closePanel() {
  if (!activePanel) return
  const shell = activePanel.shell
  activePanel = null
  shell.classList.remove('is-open')
  document.body.classList.remove('analytics-detail-lock')
  window.setTimeout(() => shell.remove(), 240)
}

function openPanel(category) {
  closePanel()
  document.querySelectorAll('.analytics-v2-drawer-shell').forEach(node => node.remove())

  const shell = make('div', 'analytics-detail-shell')
  const backdrop = make('button', 'analytics-detail-backdrop')
  backdrop.type = 'button'
  backdrop.setAttribute('aria-label', 'Закрыть панель категории')
  backdrop.addEventListener('click', closePanel)

  const panel = make('aside', 'analytics-detail-panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', `Аналитика категории ${category}`)

  const header = make('header', 'analytics-detail-header')
  const title = make('div', 'analytics-detail-title')
  title.append(make('small', '', 'CATEGORY WORKSPACE'), make('h2', '', category), make('p', '', 'Загрузка данных…'))
  const close = make('button', 'analytics-detail-close', '×')
  close.type = 'button'
  close.setAttribute('aria-label', 'Закрыть')
  close.addEventListener('click', closePanel)
  header.append(title, close)

  const body = make('div', 'analytics-detail-body')
  const footer = make('footer', 'analytics-detail-footer')
  const registryButton = make('button', '', 'Открыть категорию в реестре →')
  registryButton.type = 'button'
  registryButton.disabled = true
  footer.append(registryButton)

  panel.append(header, body, footer)
  shell.append(backdrop, panel)
  document.body.append(shell)
  document.body.classList.add('analytics-detail-lock')

  const token = Symbol(category)
  activePanel = { shell, panel, body, category, token }
  requestAnimationFrame(() => shell.classList.add('is-open'))
  close.focus()
  refreshPanel(category)
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function waitFor(check, timeout = 4500) {
  return new Promise(resolve => {
    const started = Date.now()
    const tick = () => {
      const result = check()
      if (result) return resolve(result)
      if (Date.now() - started >= timeout) return resolve(null)
      window.setTimeout(tick, 80)
    }
    tick()
  })
}

async function openRegistry(category, requestNumber = '') {
  closePanel()
  const navButton = [...document.querySelectorAll('aside nav button, .mobile-bottom-nav button')]
    .find(button => button.textContent.trim().includes('Запросы'))
  navButton?.click()

  const registry = await waitFor(() => document.querySelector('.registry'))
  if (!registry) return

  const reset = registry.querySelector('.filter-reset')
  if (reset) {
    reset.click()
    await new Promise(resolve => window.setTimeout(resolve, 120))
  }

  const categorySelect = [...registry.querySelectorAll('select')]
    .find(select => select.getAttribute('aria-label') === 'Фильтр по категории')
  if (categorySelect && [...categorySelect.options].some(option => option.value === category)) {
    setNativeValue(categorySelect, category)
  }

  const search = registry.querySelector('input[placeholder*="Номер"]')
  if (search) setNativeValue(search, requestNumber || '')

  if (requestNumber) {
    const link = await waitFor(() => [...registry.querySelectorAll('.request-number-link')]
      .find(button => button.textContent.trim().includes(requestNumber)), 3500)
    link?.click()
  } else {
    registry.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function categoryFromCard(card) {
  return card.querySelector('.analytics-v2-category-copy h3')?.textContent?.trim() || ''
}

document.addEventListener('click', event => {
  const card = event.target.closest?.(CARD_SELECTOR)
  if (!card) return
  const category = categoryFromCard(card)
  if (!category) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  openPanel(category)
}, true)

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePanel()
})

function subscribeLive() {
  if (liveChannel) return
  liveChannel = supabase
    .channel('analytics-category-details-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
      cache.clear()
      if (activePanel) refreshPanel(activePanel.category, true)
    })
    .subscribe()
}

subscribeLive()
