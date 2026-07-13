import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PAGE_CLASS = 'payments-page-active'
const NAV_ID = 'vl-payments-nav'
const ROOT_ID = 'vl-payments-root'
const TODAY = () => new Date().toISOString().slice(0, 10)

const PAYMENT_TYPES = {
  prepayment: 'Предоплата',
  balance: 'Остаток поставщику',
  deferred: 'Оплата по отсрочке',
  logistics: 'Логистика',
  customs: 'Таможенные платежи',
  other: 'Другой платёж',
}

const STATUS_META = {
  planned: ['Запланирован', 'neutral'],
  waiting_documents: ['Ожидает документов', 'waiting'],
  submit: ['Нужно подать', 'attention'],
  submitted: ['Подан на оплату', 'submitted'],
  approved: ['Согласован', 'approved'],
  partial: ['Оплачен частично', 'partial'],
  paid: ['Оплачен', 'paid'],
  overdue: ['Просрочен', 'overdue'],
  cancelled: ['Отменён', 'cancelled'],
}

const CURRENCIES = ['USD', 'CNY', 'EUR', 'BYN', 'RUB']

const state = {
  active: false,
  session: null,
  profile: null,
  requests: [],
  payments: [],
  loading: false,
  error: '',
  query: '',
  status: 'all',
  currency: 'all',
  sort: 'submit',
  selected: null,
  audit: [],
  modal: null,
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
  order: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>',
  bank: '<path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 21h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  coins: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
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
    const currency = item.currency || 'USD'
    grouped.set(currency, (grouped.get(currency) || 0) + Number(selector(item) || 0))
  })
  const parts = [...grouped.entries()].filter(([, value]) => Math.abs(value) > 0.0001).map(([currency, value]) => formatMoney(value, currency))
  return parts.length ? parts.join(' · ') : '0'
}

function typeLabel(value) {
  return PAYMENT_TYPES[value] || PAYMENT_TYPES.other
}

function effectiveStatus(payment) {
  if (payment.status === 'cancelled') return 'cancelled'
  const amount = Number(payment.amount || 0)
  const paid = Number(payment.paid_amount || 0)
  if (amount > 0 && paid >= amount) return 'paid'
  if (paid > 0) return 'partial'
  if (payment.status === 'paid' || payment.status === 'partial') return payment.status
  const today = TODAY()
  if (payment.due_date && today > payment.due_date) return 'overdue'
  if (payment.submit_by_date && today >= payment.submit_by_date && !['submitted', 'approved'].includes(payment.status)) return 'submit'
  return payment.status || 'planned'
}

function statusPill(payment) {
  const status = effectiveStatus(payment)
  const [label, tone] = STATUS_META[status] || STATUS_META.planned
  return `<span class="payment-status ${tone}"><i></i>${escapeHtml(label)}</span>`
}

function calculateDates(form) {
  const type = form.payment_type || 'prepayment'
  const documentDate = form.document_date || ''
  let deferral = Number(form.deferral_days || 0)
  let lead = Number(form.submission_lead_days ?? 15)
  if (type === 'prepayment') {
    deferral = 0
    lead = 0
  }
  const due = documentDate ? addDays(documentDate, deferral) : ''
  const submit = due ? addDays(due, -lead) : ''
  return { deferral, lead, due, submit }
}

function paymentProgress(payment) {
  const amount = Number(payment.amount || 0)
  const paid = Number(payment.paid_amount || 0)
  return amount > 0 ? Math.min(100, Math.max(0, paid / amount * 100)) : 0
}

function migrationError(error) {
  const message = String(error?.message || '')
  return /relation .*payments.* does not exist|Could not find the table.*payments/i.test(message)
}

function friendlyError(error) {
  if (!error) return 'Неизвестная ошибка.'
  if (migrationError(error)) return 'Финансовый модуль ещё не подключён к базе. Выполните файл supabase/payments-upgrade.sql в Supabase SQL Editor.'
  if (error.code === '42501') return 'Недостаточно прав для изменения платежей.'
  if (error.code === '23503') return 'Связанный заказ не найден.'
  return error.message || 'Не удалось выполнить операцию.'
}

function canEdit() {
  return state.profile?.role === 'admin'
}

function requestById(id) {
  return state.requests.find(item => item.id === id)
}

function defaultPayment() {
  return {
    request_id: '',
    request_number: '',
    supplier_name: '',
    payment_type: 'prepayment',
    amount: '',
    currency: 'USD',
    percent_of_order: '',
    document_number: '',
    document_date: TODAY(),
    deferral_days: 0,
    submission_lead_days: 0,
    due_date: TODAY(),
    submit_by_date: TODAY(),
    status: 'planned',
    paid_amount: '',
    paid_at: '',
    payment_reference: '',
    fee_amount: '',
    exchange_rate: '',
    attachment_url: '',
    notes: '',
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

async function loadData() {
  state.loading = true
  state.error = ''
  render()
  try {
    if (!state.session || !state.profile) await loadContext()
    const [requestsResult, paymentsResult] = await Promise.all([
      supabase.from('requests').select('id,request_number,product_name,category,agent_name,article_numbers,pi_signed_at,created_at').order('updated_at', { ascending: false }),
      supabase.from('payments').select('*').order('submit_by_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    ])
    if (requestsResult.error) throw requestsResult.error
    if (paymentsResult.error) throw paymentsResult.error
    state.requests = requestsResult.data || []
    state.payments = paymentsResult.data || []
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
    .channel('payments-module-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => state.active && loadData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => state.active && loadData())
    .subscribe()
}

function filteredPayments() {
  const query = state.query.trim().toLowerCase()
  let items = state.payments.filter(payment => {
    const status = effectiveStatus(payment)
    const haystack = [payment.request_number, payment.supplier_name, payment.document_number, payment.payment_reference, typeLabel(payment.payment_type)].join(' ').toLowerCase()
    return (!query || haystack.includes(query))
      && (state.status === 'all' || status === state.status)
      && (state.currency === 'all' || payment.currency === state.currency)
  })
  if (state.sort === 'amount') items = [...items].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  else if (state.sort === 'created') items = [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  else items = [...items].sort((a, b) => String(a.submit_by_date || '9999-12-31').localeCompare(String(b.submit_by_date || '9999-12-31')))
  return items
}

function urgentPayments() {
  const today = TODAY()
  const limit = addDays(today, 15)
  return state.payments
    .filter(payment => {
      const status = effectiveStatus(payment)
      if (['paid', 'cancelled'].includes(status)) return false
      return status === 'overdue' || status === 'submit' || (payment.submit_by_date && payment.submit_by_date <= limit)
    })
    .sort((a, b) => String(a.submit_by_date || a.due_date || '').localeCompare(String(b.submit_by_date || b.due_date || '')))
}

function summary() {
  const active = state.payments.filter(item => !['paid', 'cancelled'].includes(effectiveStatus(item)))
  const toSubmit = active.filter(item => ['submit', 'overdue'].includes(effectiveStatus(item)) || (item.submit_by_date && item.submit_by_date <= addDays(TODAY(), 15)))
  const overdue = active.filter(item => effectiveStatus(item) === 'overdue')
  const paid = state.payments.filter(item => effectiveStatus(item) === 'paid')
  const outstanding = active.map(item => ({ ...item, balance: Math.max(0, Number(item.amount || 0) - Number(item.paid_amount || 0)) }))
  return { active, toSubmit, overdue, paid, outstanding }
}

function notificationButton() {
  if (!('Notification' in window)) return ''
  if (Notification.permission === 'granted') return `<button class="payments-notify enabled" data-action="notifications">${svg('bell')} Уведомления включены</button>`
  if (Notification.permission === 'denied') return `<button class="payments-notify denied" type="button" disabled>${svg('bell')} Уведомления запрещены</button>`
  return `<button class="payments-notify" data-action="notifications">${svg('bell')} Включить напоминания</button>`
}

function maybeNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const today = TODAY()
  urgentPayments().slice(0, 5).forEach(payment => {
    const key = `vl-payment-notified:${today}:${payment.id}:${effectiveStatus(payment)}`
    if (localStorage.getItem(key)) return
    const title = effectiveStatus(payment) === 'overdue' ? 'Платёж просрочен' : 'Пора подать платёж'
    const body = `${payment.request_number || 'Заказ'} · ${formatMoney(payment.amount, payment.currency)} · срок ${formatDate(payment.submit_by_date || payment.due_date)}`
    try {
      new Notification(title, { body, tag: `vl-payment-${payment.id}` })
      localStorage.setItem(key, '1')
    } catch {
      // Browser notifications are optional; in-app alerts remain available.
    }
  })
}

function renderSummaryCard(icon, label, value, note, tone) {
  return `<article class="payment-kpi ${tone}"><span class="payment-kpi-icon">${svg(icon, 20)}</span><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></div></article>`
}

function renderUrgent(payment) {
  const status = effectiveStatus(payment)
  const deadline = payment.submit_by_date || payment.due_date
  const days = daysBetween(TODAY(), deadline)
  const deadlineText = status === 'overdue'
    ? `Просрочено на ${Math.abs(days || 0)} дн.`
    : days === 0 ? 'Подать сегодня' : days === 1 ? 'Подать завтра' : `Осталось ${days} дн.`
  return `<button class="payment-alert-row" data-action="open" data-id="${payment.id}">
    <span class="payment-alert-icon ${status}">${svg(status === 'overdue' ? 'alert' : 'clock')}</span>
    <span class="payment-alert-copy"><b>${escapeHtml(payment.request_number || 'Без номера')}</b><small>${escapeHtml(typeLabel(payment.payment_type))} · ${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</small></span>
    <span class="payment-alert-amount"><b>${escapeHtml(formatMoney(payment.amount, payment.currency))}</b><small>${escapeHtml(deadlineText)}</small></span>
    ${svg('arrow', 16)}
  </button>`
}

function renderRow(payment) {
  const progress = paymentProgress(payment)
  const balance = Math.max(0, Number(payment.amount || 0) - Number(payment.paid_amount || 0))
  return `<article class="payment-row" data-action="open" data-id="${payment.id}" tabindex="0">
    <div class="payment-row-order"><span>${svg('order')}</span><div><b>${escapeHtml(payment.request_number || 'Без номера')}</b><small>${escapeHtml(typeLabel(payment.payment_type))}</small></div></div>
    <div class="payment-row-supplier"><b>${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</b><small>${escapeHtml(payment.document_number ? `Документ ${payment.document_number}` : 'Документ не указан')}</small></div>
    <div class="payment-row-date"><small>Подать до</small><b>${escapeHtml(formatDate(payment.submit_by_date))}</b><span>${escapeHtml(formatDate(payment.due_date))} — оплатить</span></div>
    <div class="payment-row-money"><b>${escapeHtml(formatMoney(payment.amount, payment.currency))}</b><small>Остаток ${escapeHtml(formatMoney(balance, payment.currency))}</small><i><u style="width:${progress.toFixed(1)}%"></u></i></div>
    <div class="payment-row-status">${statusPill(payment)}</div>
    <button class="payment-row-arrow" data-action="open" data-id="${payment.id}" aria-label="Открыть платёж">${svg('arrow')}</button>
  </article>`
}

function renderMigrationNotice() {
  return `<section class="payments-migration">
    <span>${svg('bank', 28)}</span>
    <div><small>ТРЕБУЕТСЯ ОДНО ОБНОВЛЕНИЕ БАЗЫ</small><h2>Подключите таблицу платежей</h2><p>${escapeHtml(state.error)}</p><code>supabase/payments-upgrade.sql</code></div>
  </section>`
}

function renderPageContent() {
  const totals = summary()
  const urgent = urgentPayments()
  const items = filteredPayments()
  const notify = notificationButton()
  return `
    <header class="payments-header">
      <div class="payments-title"><span class="payments-code">Violet Ledger · finance</span><h1>Платежи</h1><p>Плановые и фактические оплаты по заказам — со сроками, отсрочкой и напоминаниями.</p></div>
      <div class="payments-header-actions">${notify}${canEdit() ? `<button class="payments-primary" data-action="new">${svg('plus')} Новый платёж</button>` : ''}</div>
    </header>

    ${state.error && state.error.includes('payments-upgrade.sql') ? renderMigrationNotice() : ''}
    ${state.error && !state.error.includes('payments-upgrade.sql') ? `<div class="payments-error">${svg('alert')}<span>${escapeHtml(state.error)}</span><button data-action="reload">Повторить</button></div>` : ''}

    <section class="payment-kpi-grid">
      ${renderSummaryCard('calendar', 'К подаче', String(totals.toSubmit.length), 'В ближайшие 15 дней', 'violet')}
      ${renderSummaryCard('alert', 'Просрочено', String(totals.overdue.length), totals.overdue.length ? 'Требует внимания' : 'Сроки соблюдаются', 'rose')}
      ${renderSummaryCard('check', 'Оплачено', String(totals.paid.length), 'Полностью закрытых платежей', 'mint')}
      ${renderSummaryCard('coins', 'Остаток', groupedMoney(totals.outstanding, item => item.balance), 'По активным платежам', 'gold')}
    </section>

    <section class="payments-calendar-panel">
      <div class="payments-panel-head"><div><span>PAYMENT CALENDAR</span><h2>Ближайшие платежи</h2><p>Дата подачи рассчитывается раньше официального срока, чтобы учесть международный перевод.</p></div><span class="payments-calendar-count">${urgent.length}</span></div>
      <div class="payment-alert-list">${urgent.length ? urgent.slice(0, 6).map(renderUrgent).join('') : `<div class="payments-empty compact">${svg('check', 30)}<b>Срочных платежей нет</b><span>Новые напоминания появятся автоматически.</span></div>`}</div>
    </section>

    <section class="payments-register-panel">
      <div class="payments-panel-head register"><div><span>PAYMENT REGISTER</span><h2>Реестр платежей</h2><p>${state.payments.length} записей связано с заказами.</p></div></div>
      <div class="payments-toolbar">
        <label class="payments-search">${svg('search')}<input data-filter="query" value="${escapeHtml(state.query)}" placeholder="Заказ, поставщик, документ…"></label>
        <select data-filter="status"><option value="all">Все статусы</option>${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}" ${state.status === key ? 'selected' : ''}>${escapeHtml(meta[0])}</option>`).join('')}</select>
        <select data-filter="currency"><option value="all">Все валюты</option>${CURRENCIES.map(currency => `<option value="${currency}" ${state.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select>
        <select data-filter="sort"><option value="submit" ${state.sort === 'submit' ? 'selected' : ''}>По сроку подачи</option><option value="amount" ${state.sort === 'amount' ? 'selected' : ''}>По сумме</option><option value="created" ${state.sort === 'created' ? 'selected' : ''}>Сначала новые</option></select>
      </div>
      <div class="payment-row-list">${state.loading ? `<div class="payments-loading"><i></i><span>Загружаем платежи…</span></div>` : items.length ? items.map(renderRow).join('') : `<div class="payments-empty">${svg('wallet', 36)}<b>Платежи не найдены</b><span>${state.payments.length ? 'Измените фильтры поиска.' : 'Создайте первый платёж и свяжите его с заказом.'}</span>${canEdit() && !state.payments.length ? `<button class="payments-primary" data-action="new">${svg('plus')} Создать платёж</button>` : ''}</div>`}</div>
    </section>
  `
}

function render() {
  const root = document.getElementById(ROOT_ID)
  if (!root || !state.active) return
  root.innerHTML = renderPageContent()
  if (state.modal) root.insertAdjacentHTML('beforeend', renderModal(state.modal))
  if (state.selected) root.insertAdjacentHTML('beforeend', renderDrawer(state.selected))
}

function renderModal(payment) {
  const item = { ...defaultPayment(), ...payment }
  const dates = calculateDates(item)
  const requestOptions = state.requests.map(request => `<option value="${request.id}" ${item.request_id === request.id ? 'selected' : ''}>${escapeHtml(request.request_number)} — ${escapeHtml(request.product_name)}</option>`).join('')
  return `<div class="payment-modal-backdrop" data-action="close-modal"><form class="payment-modal" id="payment-form" data-payment-id="${escapeHtml(item.id || '')}" onsubmit="return false">
    <div class="payment-modal-head"><div><small>${item.id ? 'EDIT PAYMENT' : 'NEW PAYMENT'}</small><h2>${item.id ? 'Редактировать платёж' : 'Новый платёж'}</h2></div><button type="button" data-action="close-modal" aria-label="Закрыть">${svg('close')}</button></div>
    <div class="payment-modal-scroll">
      <section class="payment-form-section"><div class="payment-form-title"><span>01</span><div><b>Связь с заказом</b><small>Платёж всегда относится к конкретному заказу.</small></div></div>
        <div class="payment-form-grid">
          <label class="full">Заказ *<select name="request_id" required><option value="">Выберите заказ</option>${requestOptions}</select></label>
          <label>Поставщик<input name="supplier_name" value="${escapeHtml(item.supplier_name)}" placeholder="Заполнится из заказа"></label>
          <label>Тип платежа<select name="payment_type">${Object.entries(PAYMENT_TYPES).map(([key, label]) => `<option value="${key}" ${item.payment_type === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="payment-form-section"><div class="payment-form-title"><span>02</span><div><b>Сумма</b><small>Плановая сумма и фактическая оплата.</small></div></div>
        <div class="payment-form-grid three">
          <label>Сумма *<input name="amount" type="number" min="0" step="0.01" required value="${escapeHtml(item.amount)}"></label>
          <label>Валюта<select name="currency">${CURRENCIES.map(currency => `<option value="${currency}" ${item.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select></label>
          <label>% от заказа<input name="percent_of_order" type="number" min="0" max="100" step="0.01" value="${escapeHtml(item.percent_of_order)}"></label>
          <label>Оплачено<input name="paid_amount" type="number" min="0" step="0.01" value="${escapeHtml(item.paid_amount)}"></label>
          <label>Дата оплаты<input name="paid_at" type="date" value="${escapeHtml(item.paid_at)}"></label>
          <label>Номер платежа<input name="payment_reference" value="${escapeHtml(item.payment_reference)}" placeholder="Платёжное поручение / SWIFT"></label>
        </div>
      </section>

      <section class="payment-form-section"><div class="payment-form-title"><span>03</span><div><b>Документ и сроки</b><small>Система сама рассчитает дату подачи платежа.</small></div></div>
        <div class="payment-form-grid three">
          <label>Номер документа<input name="document_number" value="${escapeHtml(item.document_number)}" placeholder="PI / invoice / set of docs"></label>
          <label>Дата документа<input name="document_date" type="date" value="${escapeHtml(item.document_date)}"></label>
          <label>Отсрочка, дней<input name="deferral_days" type="number" min="0" max="3650" value="${dates.deferral}"></label>
          <label>Подать заранее, дней<input name="submission_lead_days" type="number" min="0" max="365" value="${dates.lead}"></label>
          <label class="calculated">Подать до<input name="submit_by_date" type="date" value="${escapeHtml(dates.submit)}" readonly></label>
          <label class="calculated">Оплатить до<input name="due_date" type="date" value="${escapeHtml(dates.due)}" readonly></label>
        </div>
        <div class="payment-form-hint">${svg('clock')} Для предоплаты срок ставится сразу. Для отсрочки: дата документа + количество дней, затем минус резерв на международный перевод.</div>
      </section>

      <section class="payment-form-section"><div class="payment-form-title"><span>04</span><div><b>Статус и подтверждение</b><small>Фактические данные фиксируются вручную.</small></div></div>
        <div class="payment-form-grid">
          <label>Статус<select name="status">${Object.entries(STATUS_META).filter(([key]) => key !== 'overdue' && key !== 'submit').map(([key, meta]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${escapeHtml(meta[0])}</option>`).join('')}</select></label>
          <label>Ссылка на подтверждение<input name="attachment_url" type="url" value="${escapeHtml(item.attachment_url)}" placeholder="Ссылка на файл или документ"></label>
          <label>Комиссия<input name="fee_amount" type="number" min="0" step="0.01" value="${escapeHtml(item.fee_amount)}"></label>
          <label>Курс<input name="exchange_rate" type="number" min="0" step="0.000001" value="${escapeHtml(item.exchange_rate)}"></label>
          <label class="full">Комментарий<textarea name="notes" rows="3" placeholder="Условия, согласование, следующий шаг…">${escapeHtml(item.notes)}</textarea></label>
        </div>
      </section>
      <div class="payment-form-error" hidden></div>
    </div>
    <div class="payment-modal-actions"><button type="button" class="payments-secondary" data-action="close-modal">Отмена</button><button type="submit" class="payments-primary" data-action="save">${svg('check')} Сохранить платёж</button></div>
  </form></div>`
}

function renderDrawer(payment) {
  const balance = Math.max(0, Number(payment.amount || 0) - Number(payment.paid_amount || 0))
  const progress = paymentProgress(payment)
  const audit = state.audit.length ? state.audit.map(item => `<div class="payment-history-row"><span>${item.action === 'INSERT' ? svg('plus') : svg('edit')}</span><div><b>${escapeHtml(item.actor_email || 'Система')}</b><small>${item.action === 'INSERT' ? 'создал(а) платёж' : 'изменил(а) платёж'} · ${escapeHtml(formatDateTime(item.created_at))}</small></div></div>`).join('') : `<div class="payment-history-empty">История появится после изменений.</div>`
  return `<div class="payment-drawer-backdrop" data-action="close-drawer"><aside class="payment-drawer">
    <div class="payment-drawer-top"><span>КАРТОЧКА ПЛАТЕЖА</span><button data-action="close-drawer">${svg('close')}</button></div>
    <div class="payment-drawer-hero"><div class="payment-drawer-icon">${svg('wallet', 28)}</div><div><small>${escapeHtml(payment.request_number || 'Без номера')}</small><h2>${escapeHtml(typeLabel(payment.payment_type))}</h2><p>${escapeHtml(payment.supplier_name || 'Поставщик не указан')}</p></div>${statusPill(payment)}</div>
    <div class="payment-drawer-amount"><small>Сумма платежа</small><strong>${escapeHtml(formatMoney(payment.amount, payment.currency))}</strong><div><i><u style="width:${progress.toFixed(1)}%"></u></i><span>Оплачено ${escapeHtml(formatMoney(payment.paid_amount, payment.currency))}</span></div></div>
    <div class="payment-drawer-grid">
      <span><small>Подать до</small><b>${escapeHtml(formatDate(payment.submit_by_date))}</b></span>
      <span><small>Оплатить до</small><b>${escapeHtml(formatDate(payment.due_date))}</b></span>
      <span><small>Остаток</small><b>${escapeHtml(formatMoney(balance, payment.currency))}</b></span>
      <span><small>Дата оплаты</small><b>${escapeHtml(formatDate(payment.paid_at))}</b></span>
      <span><small>Документ</small><b>${escapeHtml(payment.document_number || '—')}</b></span>
      <span><small>Отсрочка</small><b>${Number(payment.deferral_days || 0)} дней</b></span>
    </div>
    ${payment.notes ? `<div class="payment-drawer-note"><small>КОММЕНТАРИЙ</small><p>${escapeHtml(payment.notes)}</p></div>` : ''}
    ${payment.attachment_url ? `<a class="payment-document-link" href="${escapeHtml(payment.attachment_url)}" target="_blank" rel="noopener noreferrer">${svg('external')} Открыть подтверждающий документ</a>` : ''}
    <section class="payment-history"><div class="payment-history-head">${svg('history')}<b>История изменений</b></div>${audit}</section>
    <div class="payment-drawer-actions">
      ${canEdit() && !['paid', 'cancelled'].includes(effectiveStatus(payment)) ? `<button class="payments-secondary" data-action="submitted" data-id="${payment.id}">Подан на оплату</button><button class="payments-secondary" data-action="paid" data-id="${payment.id}">${svg('check')} Оплачен</button>` : ''}
      ${canEdit() ? `<button class="payments-primary" data-action="edit" data-id="${payment.id}">${svg('edit')} Редактировать</button>` : ''}
    </div>
  </aside></div>`
}

function formToPayload(form) {
  const data = new FormData(form)
  const value = Object.fromEntries(data.entries())
  const request = requestById(value.request_id)
  const dates = calculateDates(value)
  const amount = Number(value.amount || 0)
  const paidAmount = Number(value.paid_amount || 0)
  let status = value.status || 'planned'
  if (amount > 0 && paidAmount >= amount) status = 'paid'
  else if (paidAmount > 0) status = 'partial'
  return {
    request_id: value.request_id || null,
    request_number: request?.request_number || value.request_number || '',
    supplier_name: String(value.supplier_name || request?.agent_name || '').trim(),
    payment_type: value.payment_type || 'other',
    amount,
    currency: value.currency || 'USD',
    percent_of_order: value.percent_of_order ? Number(value.percent_of_order) : null,
    document_number: String(value.document_number || '').trim(),
    document_date: value.document_date || null,
    deferral_days: dates.deferral,
    submission_lead_days: dates.lead,
    due_date: dates.due || null,
    submit_by_date: dates.submit || null,
    status,
    paid_amount: paidAmount,
    paid_at: value.paid_at || (status === 'paid' ? TODAY() : null),
    payment_reference: String(value.payment_reference || '').trim(),
    fee_amount: value.fee_amount ? Number(value.fee_amount) : 0,
    exchange_rate: value.exchange_rate ? Number(value.exchange_rate) : null,
    attachment_url: String(value.attachment_url || '').trim(),
    notes: String(value.notes || '').trim(),
    updated_by: state.session.user.id,
  }
}

async function savePayment(form) {
  if (!canEdit()) throw new Error('Изменения может вносить только администратор.')
  const payload = formToPayload(form)
  if (!payload.request_id) throw new Error('Выберите заказ.')
  if (!(payload.amount > 0)) throw new Error('Укажите сумму платежа.')
  const id = form.dataset.paymentId
  const query = id
    ? supabase.from('payments').update(payload).eq('id', id)
    : supabase.from('payments').insert({ ...payload, created_by: state.session.user.id })
  const { error } = await query
  if (error) throw error
  state.modal = null
  await loadData()
}

async function quickUpdate(id, patch) {
  if (!canEdit()) return
  const { error } = await supabase.from('payments').update({ ...patch, updated_by: state.session.user.id }).eq('id', id)
  if (error) {
    state.error = friendlyError(error)
    render()
    return
  }
  await loadData()
  if (state.selected?.id === id) await openDrawer(id)
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
  const type = form.elements.payment_type.value
  if (type === 'prepayment') {
    form.elements.deferral_days.value = 0
    form.elements.submission_lead_days.value = 0
  } else if (type === 'deferred' && Number(form.elements.submission_lead_days.value) === 0) {
    form.elements.submission_lead_days.value = 15
  }
  const dates = calculateDates(Object.fromEntries(new FormData(form).entries()))
  form.elements.due_date.value = dates.due
  form.elements.submit_by_date.value = dates.submit
  const request = requestById(form.elements.request_id.value)
  if (request && !form.elements.supplier_name.value.trim()) form.elements.supplier_name.value = request.agent_name || ''
}

async function handleNotifications() {
  if (!('Notification' in window)) return
  const permission = await Notification.requestPermission()
  if (permission === 'granted') maybeNotify()
  render()
}

function closeOverlays() {
  state.modal = null
  state.selected = null
  state.audit = []
  document.body.classList.remove('payment-overlay-open')
  render()
}

async function onClick(event) {
  const actionNode = event.target.closest('[data-action]')
  if (!actionNode) return
  const action = actionNode.dataset.action
  if (action === 'close-modal' && event.target !== actionNode && actionNode.classList.contains('payment-modal-backdrop')) return
  if (action === 'close-drawer' && event.target !== actionNode && actionNode.classList.contains('payment-drawer-backdrop')) return
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
  } else if (action === 'notifications') {
    await handleNotifications()
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
  } else if (action === 'submitted') {
    await quickUpdate(actionNode.dataset.id, { status: 'submitted' })
  } else if (action === 'paid') {
    const payment = state.payments.find(item => item.id === actionNode.dataset.id)
    if (payment) await quickUpdate(payment.id, { status: 'paid', paid_amount: payment.amount, paid_at: TODAY() })
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
  if (form && ['request_id', 'payment_type', 'document_date', 'deferral_days', 'submission_lead_days'].includes(event.target.name)) updateCalculatedFields(form)
}

let searchTimer = 0
function onInput(event) {
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
    root.className = 'payments-page-root'
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
  if (state.active) {
    nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button))
  }
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
  if (event.key === 'Escape' && state.active && (state.modal || state.selected)) closeOverlays()
})

scheduleEnsure()
const appRoot = document.getElementById('root') || document.body
new MutationObserver(scheduleEnsure).observe(appRoot, { childList: true, subtree: true })
