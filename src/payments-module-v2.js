import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PAGE_CLASS = 'payments-page-active'
const NAV_ID = 'vl-payments-nav'
const ROOT_ID = 'vl-payments-root'
const TODAY = () => new Date().toISOString().slice(0, 10)
const INTERNAL_REMINDER_LEAD_DAYS = 15

const PAYMENT_TYPES = {
  prepayment: 'Предоплата',
  balance: 'Баланс',
}

const STATUS_META = {
  planned: ['Запланирован', 'neutral'],
  submit: ['Пора оплачивать', 'attention'],
  partial: ['Оплачено частично', 'partial'],
  paid: ['Оплачено полностью', 'paid'],
  overdue: ['Просрочен', 'overdue'],
}

const CURRENCIES = ['CNY', 'USD', 'EUR', 'BYN', 'RUB']

const SUPPLIERS = [
  'NINGBO RSG IMP&EXP CO.,LTD',
  'ZHONGSHAN LINKTEX IMPORT & EXPORT CO., LTD',
  'Ningbo White Stork Trade Co., Ltd.',
  'Market Union Co., Ltd.',
  'Union Source Co., Ltd.',
  'TOP SHINE CO.,LTD',
  'Union Service CO., LTD.',
  'OFFICEMART STATIONERY CO.,LTD.',
  'TAIZHOU XUSHENG OUTDOOR PRODUCTS CO.,LTD',
  'NINGBO IHOME INTERNATIONAL TRADING CO., LTD',
  'Union Grand CO LTD.',
]

const state = {
  active: false,
  session: null,
  profile: null,
  payments: [],
  loading: false,
  error: '',
  query: '',
  status: 'all',
  currency: 'all',
  sort: 'due',
  selected: null,
  audit: [],
  modal: null,
  notificationModal: false,
  notificationSettings: null,
  notificationMessage: '',
  channel: null,
  mountFrame: 0,
}

const icons = {
  wallet: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 13h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 2.8 1.8 17.5A2 2 0 0 0 3.5 20h17a2 2 0 0 0 1.7-2.5L13.7 2.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  bank: '<path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 21h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  coins: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  telegram: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
}

function svg(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.wallet}</svg>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function addDays(value, days) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + Number(days || 0))
  return date.toISOString().slice(0, 10)
}

function daysBetween(from, to) {
  if (!from || !to) return null
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU').format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatMoney(value, currency = '') {
  const number = Number(value || 0)
  const text = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(number)
  return `${text}${currency ? ` ${currency}` : ''}`
}

function groupedMoney(items, selector) {
  const grouped = new Map()
  items.forEach(item => {
    const currency = item.currency || 'CNY'
    grouped.set(currency, (grouped.get(currency) || 0) + Number(selector(item) || 0))
  })
  const parts = [...grouped.entries()].filter(([, value]) => Math.abs(value) > 0.0001).map(([currency, value]) => formatMoney(value, currency))
  return parts.length ? parts.join(' · ') : '0'
}

function typeLabel(value) {
  return PAYMENT_TYPES[value] || PAYMENT_TYPES.prepayment
}

function calculatedPaid(payment) {
  const total = Number(payment.amount || 0)
  const percent = Math.min(100, Math.max(0, Number(payment.percent_of_order || 0)))
  return Math.round(total * percent) / 100
}

function calculatedBalance(payment) {
  return Math.max(0, Number(payment.amount || 0) - calculatedPaid(payment))
}

function calculateDates(form) {
  const documentDate = form.document_date || ''
  const deferral = Math.max(0, Number(form.deferral_days || 0))
  const due = documentDate ? addDays(documentDate, deferral) : ''
  const submit = due ? addDays(due, -INTERNAL_REMINDER_LEAD_DAYS) : ''
  return { deferral, due, submit }
}

function effectiveStatus(payment) {
  const balance = calculatedBalance(payment)
  if (balance <= 0 && Number(payment.amount || 0) > 0) return 'paid'
  if (payment.due_date && TODAY() > payment.due_date) return 'overdue'
  if (payment.submit_by_date && TODAY() >= payment.submit_by_date) return 'submit'
  if (calculatedPaid(payment) > 0) return 'partial'
  return 'planned'
}

function statusPill(payment) {
  const status = effectiveStatus(payment)
  const [label, tone] = STATUS_META[status] || STATUS_META.planned
  return `<span class="payment-status ${tone}"><i></i>${escapeHtml(label)}</span>`
}

function migrationError(error) {
  const message = String(error?.message || '')
  return /relation .*payments.* does not exist|Could not find the table.*payments|column payments\.pi_number does not exist/i.test(message)
}

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return error instanceof TypeError || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')
}

function friendlyError(error) {
  if (!error) return 'Неизвестная ошибка.'
  if (migrationError(error)) return 'Финансовый модуль нужно обновить. Повторно выполните supabase/payments-upgrade.sql в Supabase SQL Editor.'
  if (isNetworkError(error)) return 'Нет связи с Supabase. Проверьте интернет, VPN или блокировщик и повторите сохранение — данные формы не потеряны.'
  if (error.code === '42501') return 'Недостаточно прав для изменения платежей.'
  if (error.code === '23514') return 'Проверьте тип платежа, процент и сумму.'
  return error.message || 'Не удалось выполнить операцию.'
}

async function withNetworkRetry(operation, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation()
      if (result?.error) throw result.error
      return result
    } catch (error) {
      lastError = error
      if (!isNetworkError(error) || attempt === attempts) throw error
      await new Promise(resolve => setTimeout(resolve, 450 * attempt))
    }
  }
  throw lastError
}

function canEdit() {
  return state.profile?.role === 'admin'
}

function defaultPayment() {
  return {
    pi_number: '',
    request_number: '',
    request_id: null,
    supplier_name: '',
    payment_type: 'prepayment',
    amount: '',
    currency: 'CNY',
    percent_of_order: 60,
    document_number: '',
    document_date: TODAY(),
    deferral_days: 0,
    due_date: TODAY(),
    submit_by_date: addDays(TODAY(), -INTERNAL_REMINDER_LEAD_DAYS),
    status: 'planned',
    paid_amount: 0,
    paid_at: '',
  }
}

async function loadContext() {
  const { data: sessionData } = await supabase.auth.getSession()
  state.session = sessionData.session
  if (!state.session) throw new Error('Сессия не найдена. Войдите в систему снова.')
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', state.session.user.id).single()
  if (error) throw error
  state.profile = profile
}

async function loadNotificationSettings() {
  if (!state.session) return
  const { data, error } = await supabase.from('payment_notification_settings').select('*').eq('user_id', state.session.user.id).maybeSingle()
  if (!error) state.notificationSettings = data || null
}

async function loadData() {
  state.loading = true
  state.error = ''
  render()
  try {
    if (!state.session || !state.profile) await loadContext()
    const { data, error } = await supabase.from('payments').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (error) throw error
    state.payments = data || []
    await loadNotificationSettings()
    state.error = ''
    maybeNotify()
  } catch (error) {
    state.error = friendlyError(error)
  } finally {
    state.loading = false
    render()
  }
}

function subscribeRealtime() {
  if (state.channel) return
  state.channel = supabase
    .channel('payments-module-v2-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => state.active && loadData())
    .subscribe()
}

function filteredPayments() {
  const query = state.query.trim().toLowerCase()
  let items = state.payments.filter(payment => {
    const status = effectiveStatus(payment)
    const haystack = [payment.pi_number, payment.request_number, payment.supplier_name, payment.document_number, typeLabel(payment.payment_type)].join(' ').toLowerCase()
    return (!query || haystack.includes(query))
      && (state.status === 'all' || status === state.status)
      && (state.currency === 'all' || payment.currency === state.currency)
  })
  if (state.sort === 'amount') items = [...items].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  else if (state.sort === 'created') items = [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  else items = [...items].sort((a, b) => String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31')))
  return items
}

function urgentPayments() {
  const today = TODAY()
  const limit = addDays(today, INTERNAL_REMINDER_LEAD_DAYS)
  return state.payments
    .filter(payment => {
      const status = effectiveStatus(payment)
      if (status === 'paid') return false
      return status === 'overdue' || (payment.due_date && payment.due_date <= limit)
    })
    .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
}

function summary() {
  const paid = state.payments.filter(item => effectiveStatus(item) === 'paid')
  const overdue = state.payments.filter(item => effectiveStatus(item) === 'overdue')
  const dueSoon = urgentPayments().filter(item => effectiveStatus(item) !== 'overdue')
  return { paid, overdue, dueSoon }
}

function notificationButton() {
  const configured = Boolean(state.notificationSettings?.enabled)
  return `<button class="payments-notify ${configured ? 'enabled' : ''}" data-action="notification-settings">${configured ? svg('check') : svg('bell')} ${configured ? 'Уведомления настроены' : 'Настроить уведомления'}</button>`
}

function maybeNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const today = TODAY()
  urgentPayments().slice(0, 5).forEach(payment => {
    const key = `vl-payment-notified-v2:${today}:${payment.id}:${effectiveStatus(payment)}`
    if (localStorage.getItem(key)) return
    const title = effectiveStatus(payment) === 'overdue' ? 'Платёж по PI просрочен' : 'Приближается платёж по PI'
    const body = `PI ${payment.pi_number || payment.request_number || 'без номера'} · оплатить до ${formatDate(payment.due_date)}`
    try {
      new Notification(title, { body, tag: `vl-payment-${payment.id}` })
      localStorage.setItem(key, '1')
    } catch {
      // In-app reminders stay available.
    }
  })
}

function renderSummaryCard(icon, label, value, note, tone) {
  return `<article class="payment-kpi ${tone}"><span class="payment-kpi-icon">${svg(icon, 20)}</span><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></div></article>`
}

function renderUrgent(payment) {
  const status = effectiveStatus(payment)
  const days = daysBetween(TODAY(), payment.due_date)
  const deadlineText = status === 'overdue'
    ? `Просрочено на ${Math.abs(days || 0)} дн.`
    : days === 0 ? 'Оплатить сегодня' : days === 1 ? 'Оплатить завтра' : `До оплаты ${days} дн.`
  return `<button class="payment-alert-row" data-action="open" data-id="${payment.id}">
    <span class="payment-alert-icon ${status}">${svg(status === 'overdue' ? 'alert' : 'clock')}</span>
    <span class="payment-alert-copy"><b>PI ${escapeHtml(payment.pi_number || payment.request_number || 'Без номера')}</b><small>${escapeHtml(typeLabel(payment.payment_type))} · ${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</small></span>
    <span class="payment-alert-amount"><b>${escapeHtml(formatMoney(calculatedBalance(payment), payment.currency))}</b><small>${escapeHtml(deadlineText)}</small></span>
    ${svg('arrow', 16)}
  </button>`
}

function renderRow(payment) {
  const paid = calculatedPaid(payment)
  const balance = calculatedBalance(payment)
  const progress = Number(payment.amount || 0) > 0 ? Math.min(100, paid / Number(payment.amount) * 100) : 0
  return `<article class="payment-row" data-action="open" data-id="${payment.id}" tabindex="0">
    <div class="payment-row-order"><span>${svg('document')}</span><div><b>PI ${escapeHtml(payment.pi_number || payment.request_number || 'Без номера')}</b><small>${escapeHtml(typeLabel(payment.payment_type))}</small></div></div>
    <div class="payment-row-supplier"><b>${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</b><small>${escapeHtml(payment.document_number ? `Документ ${payment.document_number}` : 'Документ не указан')}</small></div>
    <div class="payment-row-date"><small>Оплатить до</small><b>${escapeHtml(formatDate(payment.due_date))}</b><span>Напоминание за ${INTERNAL_REMINDER_LEAD_DAYS} дней</span></div>
    <div class="payment-row-money"><b>${escapeHtml(formatMoney(paid, payment.currency))}</b><small>Остаток ${escapeHtml(formatMoney(balance, payment.currency))}</small><i><u style="width:${progress.toFixed(1)}%"></u></i></div>
    <div class="payment-row-status">${statusPill(payment)}</div>
    <button class="payment-row-arrow" data-action="open" data-id="${payment.id}" aria-label="Открыть платёж">${svg('arrow')}</button>
  </article>`
}

function renderMigrationNotice() {
  return `<section class="payments-migration"><span>${svg('bank', 28)}</span><div><small>ТРЕБУЕТСЯ ОБНОВЛЕНИЕ БАЗЫ</small><h2>Обновите финансовый модуль</h2><p>${escapeHtml(state.error)}</p><code>supabase/payments-upgrade.sql</code></div></section>`
}

function renderPageContent() {
  const totals = summary()
  const urgent = urgentPayments()
  const items = filteredPayments()
  const totalOutstanding = groupedMoney(state.payments, calculatedBalance)
  return `
    <header class="payments-header">
      <div class="payments-title"><span class="payments-code">Violet Ledger · finance</span><h1>Платежи по PI</h1><p>Самостоятельный финансовый реестр: поставщик, сумма PI, процент оплаты, остаток и срок.</p></div>
      <div class="payments-header-actions">${notificationButton()}${canEdit() ? `<button class="payments-primary" data-action="new">${svg('plus')} Новый платёж</button>` : ''}</div>
    </header>
    ${state.error && state.error.includes('payments-upgrade.sql') ? renderMigrationNotice() : ''}
    ${state.error && !state.error.includes('payments-upgrade.sql') ? `<div class="payments-error">${svg('alert')}<span>${escapeHtml(state.error)}</span><button data-action="reload">Повторить</button></div>` : ''}
    <section class="payment-kpi-grid">
      ${renderSummaryCard('calendar', 'К оплате', String(totals.dueSoon.length), `В ближайшие ${INTERNAL_REMINDER_LEAD_DAYS} дней`, 'violet')}
      ${renderSummaryCard('alert', 'Просрочено', String(totals.overdue.length), totals.overdue.length ? 'Требует внимания' : 'Сроки соблюдаются', 'rose')}
      ${renderSummaryCard('check', 'Закрыто', String(totals.paid.length), 'PI оплачены полностью', 'mint')}
      ${renderSummaryCard('coins', 'Остаток', totalOutstanding, 'Необходимо доплатить', 'gold')}
    </section>
    <section class="payments-calendar-panel">
      <div class="payments-panel-head"><div><span>PAYMENT CALENDAR</span><h2>Ближайшие сроки</h2><p>Система предупреждает за ${INTERNAL_REMINDER_LEAD_DAYS} дней до рассчитанной даты оплаты.</p></div><span class="payments-calendar-count">${urgent.length}</span></div>
      <div class="payment-alert-list">${urgent.length ? urgent.slice(0, 6).map(renderUrgent).join('') : `<div class="payments-empty compact">${svg('check', 30)}<b>Срочных платежей нет</b><span>Новые напоминания появятся автоматически.</span></div>`}</div>
    </section>
    <section class="payments-register-panel">
      <div class="payments-panel-head register"><div><span>PI PAYMENT REGISTER</span><h2>Реестр платежей</h2><p>${state.payments.length} записей по PI.</p></div></div>
      <div class="payments-toolbar">
        <label class="payments-search">${svg('search')}<input data-filter="query" value="${escapeHtml(state.query)}" placeholder="Номер PI, поставщик, документ…"></label>
        <select data-filter="status"><option value="all">Все статусы</option>${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}" ${state.status === key ? 'selected' : ''}>${escapeHtml(meta[0])}</option>`).join('')}</select>
        <select data-filter="currency"><option value="all">Все валюты</option>${CURRENCIES.map(currency => `<option value="${currency}" ${state.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select>
        <select data-filter="sort"><option value="due" ${state.sort === 'due' ? 'selected' : ''}>По сроку оплаты</option><option value="amount" ${state.sort === 'amount' ? 'selected' : ''}>По сумме</option><option value="created" ${state.sort === 'created' ? 'selected' : ''}>Сначала новые</option></select>
      </div>
      <div class="payment-row-list">${state.loading ? `<div class="payments-loading"><i></i><span>Загружаем платежи…</span></div>` : items.length ? items.map(renderRow).join('') : `<div class="payments-empty">${svg('wallet', 36)}<b>Платежи не найдены</b><span>${state.payments.length ? 'Измените фильтры поиска.' : 'Создайте первый платёж по номеру PI.'}</span>${canEdit() && !state.payments.length ? `<button class="payments-primary" data-action="new">${svg('plus')} Создать платёж</button>` : ''}</div>`}</div>
    </section>
  `
}

function render() {
  const root = document.getElementById(ROOT_ID)
  if (!root || !state.active) return
  root.innerHTML = renderPageContent()
  if (state.modal) root.insertAdjacentHTML('beforeend', renderModal(state.modal))
  if (state.selected) root.insertAdjacentHTML('beforeend', renderDrawer(state.selected))
  if (state.notificationModal) root.insertAdjacentHTML('beforeend', renderNotificationModal())
}

function supplierOptions(current) {
  const options = [...SUPPLIERS]
  if (current && !options.includes(current)) options.push(current)
  return options.map(name => `<option value="${escapeHtml(name)}" ${current === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')
}

function renderModal(payment) {
  const item = { ...defaultPayment(), ...payment }
  item.pi_number = item.pi_number || item.request_number || ''
  const dates = calculateDates(item)
  const paid = calculatedPaid(item)
  const balance = calculatedBalance(item)
  return `<div class="payment-modal-backdrop" data-action="close-modal"><form class="payment-modal payment-modal-v2" id="payment-form" data-payment-id="${escapeHtml(item.id || '')}" onsubmit="return false">
    <div class="payment-modal-head"><div><small>${item.id ? 'EDIT PI PAYMENT' : 'NEW PI PAYMENT'}</small><h2>${item.id ? 'Редактировать платёж' : 'Новый платёж'}</h2></div><button type="button" data-action="close-modal" aria-label="Закрыть">${svg('close')}</button></div>
    <div class="payment-modal-scroll">
      <section class="payment-form-section"><div class="payment-form-title"><span>01</span><div><b>Данные PI</b><small>Платёж ведётся отдельно от запросов и заказов.</small></div></div>
        <div class="payment-form-grid">
          <label>Номер PI *<input name="pi_number" required value="${escapeHtml(item.pi_number)}" placeholder="Например, PI-2026-0158"></label>
          <label>Поставщик *<select name="supplier_name" required><option value="">Выберите поставщика</option>${supplierOptions(item.supplier_name)}</select></label>
          <label class="full">Тип платежа<select name="payment_type">${Object.entries(PAYMENT_TYPES).map(([key, label]) => `<option value="${key}" ${item.payment_type === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
        </div>
      </section>
      <section class="payment-form-section"><div class="payment-form-title"><span>02</span><div><b>Сумма и расчёт</b><small>Оплачено и остаток рассчитываются автоматически.</small></div></div>
        <div class="payment-form-grid three">
          <label>Сумма PI *<input name="amount" type="number" min="0.01" step="0.01" required value="${escapeHtml(item.amount)}"></label>
          <label>Валюта<select name="currency">${CURRENCIES.map(currency => `<option value="${currency}" ${item.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select></label>
          <label>% от заказа *<input name="percent_of_order" type="number" min="0" max="100" step="0.01" required value="${escapeHtml(item.percent_of_order)}"></label>
          <label class="calculated">Оплачено<input name="paid_amount_display" value="${escapeHtml(paid.toFixed(2))}" readonly></label>
          <label class="calculated">Остаток<input name="remaining_amount_display" value="${escapeHtml(balance.toFixed(2))}" readonly></label>
          <label>Дата оплаты<input name="paid_at" type="date" value="${escapeHtml(item.paid_at || '')}"></label>
        </div>
        <div class="payment-calculation-line"><span>Расчёт</span><b data-payment-calculation>${escapeHtml(formatMoney(paid, item.currency))} оплачено · ${escapeHtml(formatMoney(balance, item.currency))} осталось</b></div>
      </section>
      <section class="payment-form-section"><div class="payment-form-title"><span>03</span><div><b>Документ и срок</b><small>Дата оплаты рассчитывается автоматически.</small></div></div>
        <div class="payment-form-grid four-compact">
          <label>Номер документа *<input name="document_number" required value="${escapeHtml(item.document_number)}" placeholder="Номер документа / set of docs"></label>
          <label>Дата документа *<input name="document_date" required type="date" value="${escapeHtml(item.document_date)}"></label>
          <label>Отсрочка, дней<input name="deferral_days" type="number" min="0" max="3650" value="${dates.deferral}"></label>
          <label class="calculated">Оплатить до<input name="due_date" type="date" value="${escapeHtml(dates.due)}" readonly></label>
        </div>
        <input name="submit_by_date" type="hidden" value="${escapeHtml(dates.submit)}">
        <div class="payment-form-hint">${svg('clock')} Срок: дата документа + отсрочка. Напоминание будет подготовлено автоматически за ${INTERNAL_REMINDER_LEAD_DAYS} дней.</div>
      </section>
      <div class="payment-form-error" hidden></div>
    </div>
    <div class="payment-modal-actions"><button type="button" class="payments-secondary" data-action="close-modal">Отмена</button><button type="submit" class="payments-primary" data-action="save">${svg('check')} Сохранить платёж</button></div>
  </form></div>`
}

function renderDrawer(payment) {
  const paid = calculatedPaid(payment)
  const balance = calculatedBalance(payment)
  const progress = Number(payment.amount || 0) > 0 ? Math.min(100, paid / Number(payment.amount) * 100) : 0
  const audit = state.audit.length ? state.audit.map(item => `<div class="payment-history-row"><span>${item.action === 'INSERT' ? svg('plus') : svg('edit')}</span><div><b>${escapeHtml(item.actor_email || 'Система')}</b><small>${item.action === 'INSERT' ? 'создал(а) платёж' : 'изменил(а) платёж'} · ${escapeHtml(formatDateTime(item.created_at))}</small></div></div>`).join('') : `<div class="payment-history-empty">История появится после изменений.</div>`
  return `<div class="payment-drawer-backdrop" data-action="close-drawer"><aside class="payment-drawer">
    <div class="payment-drawer-top"><span>КАРТОЧКА PI</span><button data-action="close-drawer">${svg('close')}</button></div>
    <div class="payment-drawer-hero"><div class="payment-drawer-icon">${svg('wallet', 28)}</div><div><small>PI ${escapeHtml(payment.pi_number || payment.request_number || 'Без номера')}</small><h2>${escapeHtml(typeLabel(payment.payment_type))}</h2><p>${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</p></div>${statusPill(payment)}</div>
    <div class="payment-drawer-amount"><small>Сумма PI</small><strong>${escapeHtml(formatMoney(payment.amount, payment.currency))}</strong><div><i><u style="width:${progress.toFixed(1)}%"></u></i><span>Оплачено ${escapeHtml(formatMoney(paid, payment.currency))}</span></div></div>
    <div class="payment-drawer-grid">
      <span><small>Процент</small><b>${Number(payment.percent_of_order || 0)}%</b></span>
      <span><small>Остаток</small><b>${escapeHtml(formatMoney(balance, payment.currency))}</b></span>
      <span><small>Оплатить до</small><b>${escapeHtml(formatDate(payment.due_date))}</b></span>
      <span><small>Дата оплаты</small><b>${escapeHtml(formatDate(payment.paid_at))}</b></span>
      <span><small>Документ</small><b>${escapeHtml(payment.document_number || '—')}</b></span>
      <span><small>Отсрочка</small><b>${Number(payment.deferral_days || 0)} дней</b></span>
    </div>
    <section class="payment-history"><div class="payment-history-head">${svg('history')}<b>История изменений</b></div>${audit}</section>
    <div class="payment-drawer-actions">${canEdit() ? `<button class="payments-primary" data-action="edit" data-id="${payment.id}">${svg('edit')} Редактировать</button>` : ''}</div>
  </aside></div>`
}

function renderNotificationModal() {
  const settings = state.notificationSettings || { enabled: false, channel: 'email', email: state.session?.user?.email || '', telegram_chat_id: '' }
  return `<div class="payment-modal-backdrop" data-action="close-notifications"><form class="payment-notification-modal" id="payment-notification-form" onsubmit="return false">
    <div class="payment-modal-head"><div><small>PAYMENT REMINDERS</small><h2>Уведомления</h2></div><button type="button" data-action="close-notifications">${svg('close')}</button></div>
    <div class="payment-notification-body">
      <p>Напоминания формируются за 15, 7, 3 дня и в день оплаты. Можно выбрать email, Telegram или оба канала.</p>
      <label class="payment-notification-toggle"><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}><span></span><b>Отправлять напоминания</b></label>
      <label>Канал<select name="channel"><option value="email" ${settings.channel === 'email' ? 'selected' : ''}>Email</option><option value="telegram" ${settings.channel === 'telegram' ? 'selected' : ''}>Telegram</option><option value="both" ${settings.channel === 'both' ? 'selected' : ''}>Email + Telegram</option></select></label>
      <label>${svg('mail')} Email<input name="email" type="email" value="${escapeHtml(settings.email || state.session?.user?.email || '')}" placeholder="finance@company.com"></label>
      <label>${svg('telegram')} Telegram Chat ID<input name="telegram_chat_id" value="${escapeHtml(settings.telegram_chat_id || '')}" placeholder="Например, 123456789"></label>
      <div class="payment-notification-info">Для отправки через Telegram или email серверная функция должна быть развёрнута в Supabase. Настройки сохраняются безопасно в базе.</div>
      ${state.notificationMessage ? `<div class="payment-notification-message">${escapeHtml(state.notificationMessage)}</div>` : ''}
    </div>
    <div class="payment-modal-actions"><button type="button" class="payments-secondary" data-action="test-notifications">Отправить тест</button><button type="submit" class="payments-primary" data-action="save-notifications">${svg('check')} Сохранить</button></div>
  </form></div>`
}

function formToPayload(form) {
  const value = Object.fromEntries(new FormData(form).entries())
  const dates = calculateDates(value)
  const amount = Number(value.amount || 0)
  const percent = Math.min(100, Math.max(0, Number(value.percent_of_order || 0)))
  const paidAmount = Math.round(amount * percent) / 100
  const balance = Math.max(0, amount - paidAmount)
  let status = balance <= 0 && amount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'planned'
  if (dates.due && TODAY() > dates.due && balance > 0) status = 'overdue'
  return {
    request_id: null,
    request_number: String(value.pi_number || '').trim(),
    pi_number: String(value.pi_number || '').trim(),
    supplier_name: String(value.supplier_name || '').trim(),
    payment_type: value.payment_type === 'balance' ? 'balance' : 'prepayment',
    amount,
    currency: value.currency || 'CNY',
    percent_of_order: percent,
    document_number: String(value.document_number || '').trim(),
    document_date: value.document_date || null,
    deferral_days: dates.deferral,
    submission_lead_days: INTERNAL_REMINDER_LEAD_DAYS,
    due_date: dates.due || null,
    submit_by_date: dates.submit || null,
    status,
    paid_amount: paidAmount,
    paid_at: value.paid_at || (status === 'paid' ? TODAY() : null),
    payment_reference: '',
    fee_amount: 0,
    exchange_rate: null,
    attachment_url: '',
    notes: '',
    updated_by: state.session.user.id,
  }
}

async function savePayment(form) {
  if (!canEdit()) throw new Error('Изменения может вносить только администратор.')
  const payload = formToPayload(form)
  if (!payload.pi_number) throw new Error('Введите номер PI.')
  if (!payload.supplier_name) throw new Error('Выберите поставщика.')
  if (!(payload.amount > 0)) throw new Error('Укажите сумму PI.')
  if (!payload.document_number || !payload.document_date) throw new Error('Введите номер и дату документа.')
  const existingId = form.dataset.paymentId
  if (existingId) {
    await withNetworkRetry(() => supabase.from('payments').update(payload).eq('id', existingId).select('id').single())
  } else {
    const id = crypto.randomUUID()
    await withNetworkRetry(() => supabase.from('payments').upsert({ id, ...payload, created_by: state.session.user.id }, { onConflict: 'id' }).select('id').single())
  }
  state.modal = null
  await loadData()
}

async function saveNotificationSettings(form) {
  const value = Object.fromEntries(new FormData(form).entries())
  const payload = {
    user_id: state.session.user.id,
    enabled: form.elements.enabled.checked,
    channel: ['email', 'telegram', 'both'].includes(value.channel) ? value.channel : 'email',
    email: String(value.email || '').trim(),
    telegram_chat_id: String(value.telegram_chat_id || '').trim(),
    updated_at: new Date().toISOString(),
  }
  if (payload.enabled && ['email', 'both'].includes(payload.channel) && !payload.email) throw new Error('Укажите email для уведомлений.')
  if (payload.enabled && ['telegram', 'both'].includes(payload.channel) && !payload.telegram_chat_id) throw new Error('Укажите Telegram Chat ID.')
  const { data, error } = await supabase.from('payment_notification_settings').upsert(payload, { onConflict: 'user_id' }).select('*').single()
  if (error) throw error
  state.notificationSettings = data
  state.notificationMessage = 'Настройки сохранены.'
}

async function testNotification() {
  const form = document.getElementById('payment-notification-form')
  if (form) await saveNotificationSettings(form)
  const { error } = await supabase.functions.invoke('payment-reminders', { body: { test: true } })
  if (error) throw new Error('Функция уведомлений ещё не развёрнута или не настроены секреты Telegram/email.')
  state.notificationMessage = 'Тестовое уведомление отправлено.'
}

async function openDrawer(id) {
  const payment = state.payments.find(item => item.id === id)
  if (!payment) return
  state.selected = payment
  state.audit = []
  render()
  const { data } = await supabase.from('payment_audit_log').select('*').eq('payment_id', id).order('created_at', { ascending: false }).limit(20)
  if (state.selected?.id === id) {
    state.audit = data || []
    render()
  }
}

function updateCalculatedFields(form) {
  const value = Object.fromEntries(new FormData(form).entries())
  const amount = Number(value.amount || 0)
  const percent = Math.min(100, Math.max(0, Number(value.percent_of_order || 0)))
  const paid = Math.round(amount * percent) / 100
  const balance = Math.max(0, amount - paid)
  const dates = calculateDates(value)
  form.elements.paid_amount_display.value = paid.toFixed(2)
  form.elements.remaining_amount_display.value = balance.toFixed(2)
  form.elements.due_date.value = dates.due
  form.elements.submit_by_date.value = dates.submit
  const line = form.querySelector('[data-payment-calculation]')
  if (line) line.textContent = `${formatMoney(paid, value.currency)} оплачено · ${formatMoney(balance, value.currency)} осталось`
}

function closeOverlays() {
  state.modal = null
  state.selected = null
  state.audit = []
  state.notificationModal = false
  state.notificationMessage = ''
  document.body.classList.remove('payment-overlay-open')
  render()
}

async function onClick(event) {
  const actionNode = event.target.closest('[data-action]')
  if (!actionNode) return
  const action = actionNode.dataset.action
  if (action === 'close-modal' && event.target !== actionNode && actionNode.classList.contains('payment-modal-backdrop')) return
  if (action === 'close-drawer' && event.target !== actionNode && actionNode.classList.contains('payment-drawer-backdrop')) return
  if (action === 'close-notifications' && event.target !== actionNode && actionNode.classList.contains('payment-modal-backdrop')) return
  event.preventDefault()
  event.stopPropagation()

  if (action === 'new') {
    state.modal = defaultPayment()
    document.body.classList.add('payment-overlay-open')
    render()
  } else if (action === 'edit') {
    state.modal = state.payments.find(item => item.id === actionNode.dataset.id) || null
    state.selected = null
    document.body.classList.add('payment-overlay-open')
    render()
  } else if (action === 'close-modal') {
    state.modal = null
    document.body.classList.remove('payment-overlay-open')
    render()
  } else if (action === 'close-drawer') {
    state.selected = null
    state.audit = []
    document.body.classList.remove('payment-overlay-open')
    render()
  } else if (action === 'open') {
    document.body.classList.add('payment-overlay-open')
    await openDrawer(actionNode.dataset.id)
  } else if (action === 'reload') {
    await loadData()
  } else if (action === 'notification-settings') {
    state.notificationModal = true
    state.notificationMessage = ''
    document.body.classList.add('payment-overlay-open')
    render()
  } else if (action === 'close-notifications') {
    state.notificationModal = false
    state.notificationMessage = ''
    document.body.classList.remove('payment-overlay-open')
    render()
  } else if (action === 'save') {
    const form = actionNode.closest('form')
    const errorBox = form.querySelector('.payment-form-error')
    if (!form.reportValidity()) return
    actionNode.disabled = true
    actionNode.innerHTML = 'Сохранение…'
    errorBox.hidden = true
    try {
      await savePayment(form)
      document.body.classList.remove('payment-overlay-open')
    } catch (error) {
      errorBox.textContent = friendlyError(error)
      errorBox.hidden = false
    } finally {
      actionNode.disabled = false
      actionNode.innerHTML = `${svg('check')} Сохранить платёж`
    }
  } else if (action === 'save-notifications' || action === 'test-notifications') {
    const form = document.getElementById('payment-notification-form')
    actionNode.disabled = true
    state.notificationMessage = ''
    try {
      if (action === 'test-notifications') await testNotification()
      else await saveNotificationSettings(form)
    } catch (error) {
      state.notificationMessage = friendlyError(error)
    } finally {
      actionNode.disabled = false
      render()
    }
  }
}

function onChange(event) {
  const filter = event.target.dataset.filter
  if (filter) {
    state[filter] = event.target.value
    render()
    return
  }
  const form = event.target.closest('#payment-form')
  if (form && ['payment_type', 'amount', 'currency', 'percent_of_order', 'document_date', 'deferral_days'].includes(event.target.name)) updateCalculatedFields(form)
}

let searchTimer = 0
function onInput(event) {
  const form = event.target.closest('#payment-form')
  if (form && ['amount', 'percent_of_order', 'document_date', 'deferral_days'].includes(event.target.name)) {
    updateCalculatedFields(form)
    return
  }
  if (event.target.dataset.filter !== 'query') return
  window.clearTimeout(searchTimer)
  const value = event.target.value
  searchTimer = window.setTimeout(() => {
    state.query = value
    render()
    document.querySelector('[data-filter="query"]')?.focus()
  }, 180)
}

function ensureRoot() {
  if (!state.active) return null
  const content = document.querySelector('main.content')
  if (!content) return null
  let root = document.getElementById(ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    root.className = 'payments-page-root payments-page-v2'
    root.addEventListener('click', onClick)
    root.addEventListener('change', onChange)
    root.addEventListener('input', onInput)
    content.append(root)
  }
  return root
}

function activatePayments() {
  state.active = true
  document.body.classList.add(PAGE_CLASS)
  document.querySelectorAll('aside nav button').forEach(button => button.classList.toggle('active', button.id === NAV_ID))
  const root = ensureRoot()
  if (root) render()
  subscribeRealtime()
  loadData()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function deactivatePayments() {
  if (!state.active) return
  state.active = false
  document.body.classList.remove(PAGE_CLASS, 'payment-overlay-open')
  state.modal = null
  state.selected = null
  state.audit = []
  state.notificationModal = false
  document.getElementById(ROOT_ID)?.remove()
}

function createNavButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = NAV_ID
  button.innerHTML = `<span class="nav-index">04</span>${svg('wallet', 17)}<span>Платежи</span><span class="payments-nav-badge"></span>`
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    activatePayments()
  })
  return button
}

function ensureNav() {
  state.mountFrame = 0
  const nav = document.querySelector('aside nav')
  if (!nav) return
  let button = document.getElementById(NAV_ID)
  if (!button) {
    button = createNavButton()
    const logistics = [...nav.querySelectorAll('button')].find(item => item.textContent.includes('Логистика'))
    if (logistics?.nextSibling) nav.insertBefore(button, logistics.nextSibling)
    else nav.append(button)
  }
  if (state.active) nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button))
  const badge = button.querySelector('.payments-nav-badge')
  const count = urgentPayments().length
  if (badge) {
    badge.textContent = count ? String(count) : ''
    badge.hidden = !count
  }
  if (state.active) ensureRoot()
}

function scheduleEnsure() {
  if (!state.mountFrame) state.mountFrame = requestAnimationFrame(ensureNav)
}

document.addEventListener('click', event => {
  const originalNavigation = event.target.closest('aside nav button:not(#vl-payments-nav), .mobile-bottom-nav button')
  if (originalNavigation) deactivatePayments()
})

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.active && (state.modal || state.selected || state.notificationModal)) closeOverlays()
})

scheduleEnsure()
const appRoot = document.getElementById('root') || document.body
new MutationObserver(scheduleEnsure).observe(appRoot, { childList: true, subtree: true })
