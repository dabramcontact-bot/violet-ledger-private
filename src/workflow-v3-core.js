import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './vl-supabase-config.js'

if (!window.VL3) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const ROOTS = { requests: 'vl-requests-v3-root', logistics: 'vl-logistics-v3-root' }
  const BODY_CLASSES = { requests: 'vl-requests-v3-active', logistics: 'vl-logistics-v3-active' }
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
  const TRANSPORT_TYPES = ['Автомобильный', 'Железнодорожный', 'Морской', 'Авиационный', 'Мультимодальный']
  const REQUEST_STAGE_META = {
    request: ['Запрос отправлен', 'request'],
    offer: ['Предложение получено', 'offer'],
    calculation: ['Внесено в расчёт', 'calculation'],
  }
  const state = {
    active: null,
    session: null,
    profile: null,
    requests: [],
    logistics: [],
    loading: false,
    error: '',
    requestQuery: '',
    requestStage: 'all',
    logisticsQuery: '',
    transportType: 'all',
    modal: null,
    saving: false,
    requestChannel: null,
    logisticsChannel: null,
    mountFrame: 0,
    started: false,
  }
  const icons = {
    clipboard: '<path d="M9 5h6M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v12H4V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z"/><path d="M8 11h8M8 15h6"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    package: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/>',
    factory: '<path d="M3 21V9l6 3V8l6 4V5h6v16H3Z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M10.3 2.8 1.8 17.5A2 2 0 0 0 3.5 20h17a2 2 0 0 0 1.7-2.5L13.7 2.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h-1"/>',
    cube: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"/>',
    wallet: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 13h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  }

  function svg(name, size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.package}</svg>`
  }
  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
  }
  function localDateValue() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }
  function formatDate(value) {
    if (!value) return '—'
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU').format(date)
  }
  function formatNumber(value, maximumFractionDigits = 2) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(Number(value || 0))
  }
  function requestStage(row = {}) {
    if (row.included_calculation) return 'calculation'
    if (row.offer_received) return 'offer'
    return 'request'
  }
  function stagePill(row) {
    const [label, tone] = REQUEST_STAGE_META[requestStage(row)]
    return `<span class="vl3-stage ${tone}"><i></i>${escapeHtml(label)}</span>`
  }
  function canEdit() { return state.profile?.role === 'admin' }
  function isNetworkError(error) {
    const message = String(error?.message || error || '').toLowerCase()
    return error instanceof TypeError || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')
  }
  function friendlyError(error) {
    if (!error) return 'Неизвестная ошибка.'
    const message = String(error.message || '')
    if (/relation .*logistics_requests.* does not exist|Could not find the table.*logistics_requests/i.test(message)) return 'Самостоятельный раздел логистики ещё не подключён. Выполните supabase/logistics-standalone-upgrade.sql в Supabase SQL Editor.'
    if (isNetworkError(error)) return 'Нет связи с Supabase. Проверьте интернет и повторите действие — данные формы сохранены на экране.'
    if (error.code === '42501') return 'Недостаточно прав. Изменения может вносить только администратор.'
    if (error.code === '23505') return 'Запись с таким уникальным номером уже существует.'
    if (error.code === '23514' || error.code === '22P02') return 'Проверьте стоимость и объём: нужны корректные числовые значения.'
    return message || 'Не удалось выполнить операцию.'
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
  async function loadContext() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    state.session = sessionData.session
    if (!state.session) throw new Error('Сессия не найдена. Войдите в систему снова.')
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', state.session.user.id).single()
    if (error) throw error
    state.profile = profile
  }
  function renderError() {
    return state.error ? `<div class="vl3-error">${svg('alert', 18)}<div><b>Не удалось загрузить данные</b><span>${escapeHtml(state.error)}</span></div></div>` : ''
  }
  function renderLoading() { return `<div class="vl3-loading"><i></i><span>Загрузка рабочего реестра…</span></div>` }
  function pageHeader(kind, count) {
    const isRequests = kind === 'requests'
    return `<header class="vl3-header"><div><div class="vl3-code">VIOLET LEDGER · ${isRequests ? 'RFQ' : 'LOGISTICS'}</div><h1>${isRequests ? 'Запросы поставщикам' : 'Логистические заявки'}</h1><p>${isRequests ? 'Самостоятельный реестр запросов. Цикл заканчивается после внесения предложения в расчёт.' : 'Отдельный рабочий контур перевозок. Здесь только те позиции, которые действительно куплены.'}</p></div>${canEdit() ? `<button class="vl3-primary" data-action="new">${svg('plus', 17)} ${isRequests ? 'Новый запрос' : 'Новая заявка'}</button>` : ''}<span class="vl3-header-count">${count}</span></header>`
  }
  function supplierOptions(selected) {
    const saved = selected && !SUPPLIERS.includes(selected) ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} · сохранённый</option>` : ''
    return `<option value="" disabled${selected ? '' : ' selected'}>Выберите поставщика</option>${saved}${SUPPLIERS.map(item => `<option value="${escapeHtml(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}`
  }

  const V = window.VL3 = {
    supabase, ROOTS, BODY_CLASSES, SUPPLIERS, TRANSPORT_TYPES, REQUEST_STAGE_META, state,
    svg, escapeHtml, localDateValue, formatDate, formatNumber, requestStage, stagePill, canEdit,
    friendlyError, withNetworkRetry, renderError, renderLoading, pageHeader, supplierOptions,
  }

  V.render = function render() {
    if (!state.active) return
    const root = V.ensureRoot()
    if (!root) return
    const renderer = state.active === 'requests' ? V.renderRequestsPage : V.renderLogisticsPage
    root.innerHTML = renderer ? renderer() : renderLoading()
  }
  V.loadActiveData = async function loadActiveData() {
    state.loading = true
    state.error = ''
    V.render()
    try {
      if (!state.session || !state.profile) await loadContext()
      if (state.active === 'requests') {
        const result = await withNetworkRetry(() => supabase.from('requests').select('id,request_number,category,product_name,agent_name,article_numbers,request_sent_at,offer_received,offer_received_at,included_calculation,notes,created_at,updated_at').order('updated_at', { ascending: false }))
        state.requests = result.data || []
      } else if (state.active === 'logistics') {
        const result = await withNetworkRetry(() => supabase.from('logistics_requests').select('*').order('updated_at', { ascending: false }))
        state.logistics = result.data || []
      }
    } catch (error) {
      state.error = friendlyError(error)
    } finally {
      state.loading = false
      V.render()
    }
  }
  V.closeModal = function closeModal() {
    state.modal = null
    state.saving = false
    document.body.classList.remove('vl3-overlay-open')
    V.render()
  }
  V.ensureRoot = function ensureRoot() {
    if (!state.active) return null
    const content = document.querySelector('main.content')
    if (!content) return null
    let root = document.getElementById(ROOTS[state.active])
    if (!root) {
      root = document.createElement('div')
      root.id = ROOTS[state.active]
      root.className = 'vl-module-root vl3-page-root'
      root.addEventListener('click', V.onClick)
      root.addEventListener('submit', V.onSubmit)
      root.addEventListener('change', V.onChange)
      root.addEventListener('input', V.onInput)
      content.append(root)
    }
    return root
  }
  V.unsubscribeRealtime = function unsubscribeRealtime() {
    if (state.requestChannel) supabase.removeChannel(state.requestChannel)
    if (state.logisticsChannel) supabase.removeChannel(state.logisticsChannel)
    state.requestChannel = null
    state.logisticsChannel = null
  }
  V.subscribeRealtime = function subscribeRealtime() {
    V.unsubscribeRealtime()
    if (state.active === 'requests') state.requestChannel = supabase.channel('requests-v3-live').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, V.loadActiveData).subscribe()
    if (state.active === 'logistics') state.logisticsChannel = supabase.channel('logistics-v3-live').on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_requests' }, V.loadActiveData).subscribe()
  }
  V.activate = function activate(kind) {
    if (!ROOTS[kind]) return
    if (state.active && state.active !== kind) document.getElementById(ROOTS[state.active])?.remove()
    state.active = kind
    state.modal = null
    state.error = ''
    Object.values(BODY_CLASSES).forEach(className => document.body.classList.remove(className))
    document.body.classList.add(BODY_CLASSES[kind])
    V.ensureRoot()
    V.render()
    V.subscribeRealtime()
    V.loadActiveData()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  V.deactivate = function deactivate() {
    if (!state.active) return
    const active = state.active
    state.active = null
    state.modal = null
    state.error = ''
    document.body.classList.remove(BODY_CLASSES.requests, BODY_CLASSES.logistics, 'vl3-overlay-open')
    document.getElementById(ROOTS[active])?.remove()
    V.unsubscribeRealtime()
  }
  V.onClick = async function onClick(event) {
    const actionNode = event.target.closest('[data-action]')
    if (!actionNode) return
    const action = actionNode.dataset.action
    if (action === 'close-modal' && actionNode.classList.contains('vl3-modal-backdrop') && event.target !== actionNode) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'new') {
      state.modal = state.active === 'requests' ? V.defaultRequest() : V.defaultLogistics()
      document.body.classList.add('vl3-overlay-open')
      V.render()
    } else if (action === 'close-modal') V.closeModal()
    else if (action === 'edit-request') {
      const row = state.requests.find(item => item.id === actionNode.dataset.id)
      if (row) { state.modal = { ...row, kind: 'request' }; document.body.classList.add('vl3-overlay-open'); V.render() }
    } else if (action === 'edit-logistics') {
      const row = state.logistics.find(item => item.id === actionNode.dataset.id)
      if (row) { state.modal = { ...row, kind: 'logistics' }; document.body.classList.add('vl3-overlay-open'); V.render() }
    } else if (action === 'delete-request') await V.removeRow('request', actionNode.dataset.id)
    else if (action === 'delete-logistics') await V.removeRow('logistics', actionNode.dataset.id)
  }
  V.onSubmit = async function onSubmit(event) {
    const form = event.target
    if (!form.matches('#vl3-request-form, #vl3-logistics-form')) return
    event.preventDefault()
    if (!form.reportValidity()) return
    const errorBox = form.querySelector('.vl3-form-error')
    const button = form.querySelector('[type="submit"]')
    state.saving = true
    button.disabled = true
    errorBox.hidden = true
    try {
      if (form.id === 'vl3-request-form') await V.saveRequest(form)
      else await V.saveLogistics(form)
      document.body.classList.remove('vl3-overlay-open')
    } catch (error) {
      errorBox.textContent = friendlyError(error)
      errorBox.hidden = false
    } finally {
      state.saving = false
      button.disabled = false
    }
  }
  V.onChange = function onChange(event) {
    const filter = event.target.dataset.filter
    if (filter) { state[filter] = event.target.value; V.render(); return }
    if (event.target.name === 'offer_received') {
      const dateInput = event.target.closest('form')?.elements.offer_received_at
      if (dateInput && event.target.checked && !dateInput.value) dateInput.value = localDateValue()
    }
    if (event.target.name === 'included_calculation' && event.target.checked) {
      const currentForm = event.target.closest('form')
      if (currentForm?.elements.offer_received) currentForm.elements.offer_received.checked = true
      if (currentForm?.elements.offer_received_at && !currentForm.elements.offer_received_at.value) currentForm.elements.offer_received_at.value = localDateValue()
    }
  }
  let inputTimer = 0
  V.onInput = function onInput(event) {
    const filter = event.target.dataset.filter
    if (!filter) return
    window.clearTimeout(inputTimer)
    const value = event.target.value
    inputTimer = window.setTimeout(() => {
      state[filter] = value
      V.render()
      document.querySelector(`[data-filter="${filter}"]`)?.focus()
    }, 150)
  }
  V.removeRow = async function removeRow(kind, id) {
    if (!canEdit()) return
    const row = kind === 'request' ? state.requests.find(item => item.id === id) : state.logistics.find(item => item.id === id)
    if (!row) return
    const label = kind === 'request' ? `запрос ${row.request_number}` : `логистическую заявку по PI ${row.pi_number}`
    if (!window.confirm(`Удалить ${label}?`)) return
    try {
      const table = kind === 'request' ? 'requests' : 'logistics_requests'
      await withNetworkRetry(() => supabase.from(table).delete().eq('id', id))
      await V.loadActiveData()
    } catch (error) {
      state.error = friendlyError(error)
      V.render()
    }
  }
  V.start = function start() {
    if (state.started) return
    state.started = true
    document.addEventListener('click', event => {
      const navButton = event.target.closest('aside nav button, .mobile-bottom-nav button')
      if (!navButton) return
      const text = navButton.textContent?.replace(/\s+/g, ' ').trim() || ''
      const kind = text.includes('Запросы') ? 'requests' : text.includes('Логистика') ? 'logistics' : null
      if (kind) requestAnimationFrame(() => V.activate(kind))
      else V.deactivate()
    })
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.modal) V.closeModal() })
    const appRoot = document.getElementById('root') || document.body
    new MutationObserver(() => {
      if (state.mountFrame) return
      state.mountFrame = requestAnimationFrame(() => {
        state.mountFrame = 0
        if (state.active) {
          V.ensureRoot()
          Object.values(BODY_CLASSES).forEach(className => document.body.classList.remove(className))
          document.body.classList.add(BODY_CLASSES[state.active])
        }
      })
    }).observe(appRoot, { childList: true, subtree: true })
  }
}
