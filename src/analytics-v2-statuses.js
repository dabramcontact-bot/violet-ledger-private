import { createClient } from '@supabase/supabase-js'

// Lightweight live status layer for analytics category cards.
// Reads the existing requests table and does not alter React or Supabase data.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CARD_SELECTOR = '.analytics-v2-category-card'
const STATUS_FIELDS = 'category,request_sent_at,offer_received,pi_sent,pi_signed,pi_revision,shipment_status,workflow_steps,price_not_viable,not_approved'

let scanQueued = false
let statusRows = null
let statusPromise = null
let liveChannel = null

const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU')

function localDateValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function workflowStepState(row, key) {
  const raw = row?.workflow_steps?.[key]
  if (raw === true) return { done: true, completed_at: '' }
  if (!raw || typeof raw !== 'object') return { done: false, completed_at: '' }
  return { done: Boolean(raw.done), completed_at: raw.completed_at || '' }
}

function isPiOverdue(row) {
  const requestPi = workflowStepState(row, 'request_pi')
  const nextStepDone = workflowStepState(row, 'verify_characteristics').done
  if (!requestPi.done || !requestPi.completed_at || nextStepDone) return false
  if (row.pi_sent || row.pi_signed || row.price_not_viable || row.not_approved) return false

  const requestedAt = new Date(`${requestPi.completed_at}T00:00:00`)
  const today = new Date(`${localDateValue()}T00:00:00`)
  if (Number.isNaN(requestedAt.getTime())) return false
  return Math.floor((today - requestedAt) / 86400000) >= 2
}

function emptyStats() {
  return { sent: 0, offers: 0, signed: 0, revision: 0, transit: 0, overdue: 0 }
}

function buildCategoryStats(rows) {
  const map = new Map()

  ;(rows || []).forEach(row => {
    const key = normalize(row.category || 'Без категории')
    if (!map.has(key)) map.set(key, emptyStats())
    const item = map.get(key)

    if (row.request_sent_at) item.sent += 1
    if (row.offer_received) item.offers += 1
    if (row.pi_signed) item.signed += 1
    if (row.pi_revision && !row.pi_signed) item.revision += 1
    if (row.shipment_status === 'in_transit') item.transit += 1
    if (isPiOverdue(row)) item.overdue += 1
  })

  return map
}

async function loadStatusRows(force = false) {
  if (!force && statusRows) return statusRows
  if (statusPromise) return statusPromise

  statusPromise = (async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(STATUS_FIELDS)

    if (error) {
      console.warn('[analytics-v2-statuses] Could not load request statuses:', error.message)
      return statusRows || []
    }

    statusRows = data || []
    return statusRows
  })().finally(() => {
    statusPromise = null
  })

  return statusPromise
}

const STATUS_DEFS = [
  { key: 'sent', label: 'Отправлено', tone: 'neutral' },
  { key: 'offers', label: 'Ответы', tone: 'blue' },
  { key: 'signed', label: 'PI подписано', tone: 'green' },
  { key: 'revision', label: 'Доработка', tone: 'amber', attention: true },
  { key: 'transit', label: 'В пути', tone: 'violet' },
  { key: 'overdue', label: 'Просрочено', tone: 'red', attention: true },
]

function make(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function renderCardStatuses(card, stats) {
  let strip = card.querySelector(':scope > .analytics-v2-status-strip')
  if (!strip) {
    strip = make('div', 'analytics-v2-status-strip')
    const footer = card.querySelector(':scope > .analytics-v2-category-footer')
    if (footer) footer.before(strip)
    else card.append(strip)
  }

  const signature = STATUS_DEFS.map(item => `${item.key}:${stats[item.key] || 0}`).join('|')
  if (strip.dataset.statusSignature !== signature) {
    strip.dataset.statusSignature = signature
    strip.replaceChildren()

    STATUS_DEFS.forEach(({ key, label, tone, attention }) => {
      const value = Number(stats[key] || 0)
      const chip = make('span', `analytics-v2-status-chip tone-${tone}${attention && value > 0 ? ' is-attention' : ''}`)
      chip.title = `${label}: ${value}`
      chip.append(
        make('i', 'analytics-v2-status-dot'),
        make('small', '', label),
        make('strong', '', String(value)),
      )
      strip.append(chip)
    })
  }

  const attentionCount = Number(stats.revision || 0) + Number(stats.overdue || 0)
  card.classList.toggle('has-status-attention', attentionCount > 0)

  const footerLabel = card.querySelector('.analytics-v2-category-footer > span')
  if (footerLabel) {
    footerLabel.textContent = attentionCount > 0
      ? `${attentionCount} требует внимания`
      : 'Смотреть агентов'
  }

  const name = card.querySelector('.analytics-v2-category-copy h3')?.textContent?.trim() || 'Категория'
  card.setAttribute(
    'aria-label',
    `${name}. Отправлено ${stats.sent || 0}, ответов ${stats.offers || 0}, PI подписано ${stats.signed || 0}, на доработке ${stats.revision || 0}, в пути ${stats.transit || 0}, просрочено ${stats.overdue || 0}. Открыть агентов.`,
  )
}

async function applyStatuses() {
  scanQueued = false
  const cards = [...document.querySelectorAll(CARD_SELECTOR)]
  if (!cards.length) return

  const rows = await loadStatusRows()
  const statsByCategory = buildCategoryStats(rows)

  cards.forEach(card => {
    const categoryName = card.querySelector('.analytics-v2-category-copy h3')?.textContent
    renderCardStatuses(card, statsByCategory.get(normalize(categoryName)) || emptyStats())
  })
}

function scheduleApply() {
  if (scanQueued) return
  scanQueued = true
  requestAnimationFrame(applyStatuses)
}

function invalidateAndRefresh() {
  statusRows = null
  scheduleApply()
}

supabase.auth.onAuthStateChange(() => invalidateAndRefresh())

function subscribeLiveUpdates() {
  if (liveChannel) return
  liveChannel = supabase
    .channel('analytics-v2-category-statuses')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, invalidateAndRefresh)
    .subscribe()
}

subscribeLiveUpdates()
scheduleApply()

const root = document.getElementById('root') || document.body
new MutationObserver(scheduleApply).observe(root, { childList: true, subtree: true })
