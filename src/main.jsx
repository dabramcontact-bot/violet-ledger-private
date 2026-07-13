import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import {
  Activity, Archive, ArrowRight, BarChart3, Boxes, Check, ChevronRight,
  CircleAlert, ClipboardList, Clock3, Container, Factory, FileCheck2,
  FilePenLine, Filter, Globe2, LayoutDashboard, LogOut, Mail, MapPinned,
  Menu, Package, PackageOpen, Pencil, Plus, Route, Search, Ship,
  ShieldCheck, ShoppingCart, Trash2, Truck, UserPlus, Users, Warehouse, X
} from 'lucide-react'
import './styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const EMPTY = {
  request_number: '', category: '', product_name: '', agent_name: '', request_sent_at: '',
  article_numbers: '', offer_received: false, offer_received_at: '', included_calculation: false,
  proposed_to_nikolai: false, proposed_to_nikolai_at: '',
  price_not_viable: false, not_approved: false,
  pi_sent: false, pi_sent_at: '', pi_revision: false, pi_revision_at: '',
  pi_signed: false, pi_signed_at: '', notes: '',
  workflow_steps: {},
  shipment_status: 'not_shipped', logistics_company: '', transit_started_at: '',
  expected_warehouse_at: '', warehouse_arrived_at: ''
}

const AGENT_OPTIONS = [
  'NINGBO RSG IMP&EXP CO.,LTD',
  'ZHONGSHAN LINKTEX IMPORT & EXPORT CO., LTD',
  'Ningbo White Stork Trade Co., Ltd.',
  'Market Union Co., Ltd.',
  'Union Source Co., Ltd.',
  'TOP SHINE CO.,LTD',
  'Union Service CO., LTD.',
  'OFFICEMART STATIONERY CO.,LTD.',
  'TAIZHOU XUSHENG OUTDOOR PRODUCTS CO.,LTD',
  'NINGBO IHOME INTERNATIONAL TRADING CO., LTD'
]

const WORKFLOW_GROUPS = [
  {
    id: 'preparation',
    title: 'Этапы подготовки',
    subtitle: 'От обработки запроса до шиппинг-плана',
    steps: [
      ['process_spec', 'Обработать'],
      ['approve_spec', 'Согласовать'],
      ['request_pi', 'Запросить PI'],
      ['verify_characteristics', 'Сверить характеристики и отправить на согласование'],
      ['sign_documents', 'Подписать'],
      ['handover_to_ved', 'Отдать заказ в ВЭД', 'ВЭД'],
      ['create_bitrix_task', 'Создать задачу в Битрикс'],
      ['add_to_google_docs', 'Внести в Google Docs'],
      ['receive_instructions', 'Получить инструкции'],
      ['translate_instructions', 'Перевести'],
      ['proofread_instructions', 'Вычитать'],
      ['approve_instructions', 'Согласовать инструкции'],
      ['request_site_photos', 'Запросить фото для сайта'],
      ['check_inspection_report', 'Проверить инспекционный отчёт'],
      ['receive_shipping_plan', 'Получить шиппинг-план']
    ]
  },
  {
    id: 'shipping',
    title: 'Этапы отгрузки',
    subtitle: 'Перевозка, склад и контент',
    steps: [
      ['run_freight_tender', 'Провести тендер на перевозку'],
      ['warehouse_arrival', 'Приход на склад'],
      ['create_product_card', 'Создание карточки'],
      ['upload_content', 'Прогрузка контента'],
      ['payment_by_deferral', 'Оплата по сроку отсрочки с даты документов']
    ]
  }
]

const DATE_FIELDS = [
  'request_sent_at', 'offer_received_at', 'proposed_to_nikolai_at', 'pi_sent_at', 'pi_revision_at', 'pi_signed_at',
  'transit_started_at', 'expected_warehouse_at', 'warehouse_arrived_at'
]
const roleLabel = { admin: 'Администратор', editor: 'Просмотр', viewer: 'Просмотр' }
const statusMeta = {
  request: ['Запрос отправлен', '01'],
  offer: ['Предложение получено', '02'],
  calculation: ['В расчёте', '03'],
  proposed: ['Предложено Николаю', '04'],
  pi_sent: ['PI отправлена', '05'],
  revision: ['PI на доработке', '06'],
  signed: ['PI подписана', '07'],
  unsuccessful: ['Сделка не успешна', '×']
}

const shipmentMeta = {
  not_shipped: ['Ожидает отправки', 'waiting'],
  in_transit: ['В пути', 'transit'],
  arrived: ['На складе', 'arrived']
}

const requestStageDefs = [
  ['request', 'Запрос', 'request_sent_at'],
  ['offer', 'Предложение', 'offer_received_at'],
  ['calculation', 'Расчёт', null],
  ['proposed', 'Николаю', 'proposed_to_nikolai_at'],
  ['pi_sent', 'PI', 'pi_sent_at'],
  ['revision', 'Доработка', 'pi_revision_at'],
  ['signed', 'Подписана', 'pi_signed_at']
]

function requestStages(row = {}) {
  return requestStageDefs.map(([key, label, dateKey], index) => ({
    key,
    label,
    dateKey,
    date: dateKey ? row[dateKey] : null,
    done: index === 0
      ? Boolean(row.request_number || row.request_sent_at)
      : key === 'offer'
        ? Boolean(row.offer_received)
        : key === 'calculation'
          ? Boolean(row.included_calculation)
          : key === 'proposed'
            ? Boolean(row.proposed_to_nikolai)
            : key === 'pi_sent'
              ? Boolean(row.pi_sent)
              : key === 'revision'
                ? Boolean(row.pi_revision)
                : Boolean(row.pi_signed)
  }))
}

function calcStatus(row) {
  if (row.price_not_viable || row.not_approved) return 'unsuccessful'
  if (row.pi_signed) return 'signed'
  if (row.pi_revision) return 'revision'
  if (row.pi_sent) return 'pi_sent'
  if (row.proposed_to_nikolai) return 'proposed'
  if (row.included_calculation) return 'calculation'
  if (row.offer_received) return 'offer'
  return 'request'
}

function workflowStepState(row, key) {
  const raw = row?.workflow_steps?.[key]
  if (raw === true) return { done: true, completed_at: '' }
  if (!raw || typeof raw !== 'object') return { done: false, completed_at: '' }
  return { done: Boolean(raw.done), completed_at: raw.completed_at || '' }
}

function workflowProgress(row, group) {
  const done = group.steps.reduce((total, [key]) => total + (workflowStepState(row, key).done ? 1 : 0), 0)
  return { done, total: group.steps.length, percent: Math.round(done / group.steps.length * 100) }
}

function localDateValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function piRequestAgeDays(row) {
  const requestPi = workflowStepState(row, 'request_pi')
  if (!requestPi.done || !requestPi.completed_at) return 0
  const requestedAt = new Date(`${requestPi.completed_at}T00:00:00`)
  const todayValue = localDateValue()
  const today = new Date(`${todayValue}T00:00:00`)
  return Math.max(0, Math.floor((today - requestedAt) / 86400000))
}

function piRequestIsOverdue(row) {
  const nextStepDone = workflowStepState(row, 'verify_characteristics').done
  return piRequestAgeDays(row) >= 2
    && !nextStepDone
    && !row.pi_sent
    && !row.pi_signed
    && !row.price_not_viable
    && !row.not_approved
}

function cleanRequest(form, userId) {
  const payload = { ...form, updated_by: userId }
  ;['request_number', 'category', 'product_name', 'agent_name', 'article_numbers', 'notes', 'logistics_company'].forEach(key => {
    payload[key] = String(payload[key] || '').trim()
  })
  DATE_FIELDS.forEach(key => { payload[key] = payload[key] || null })
  payload.workflow_steps = payload.workflow_steps && typeof payload.workflow_steps === 'object' ? payload.workflow_steps : {}
  if (!payload.offer_received) payload.offer_received_at = null
  if (!payload.proposed_to_nikolai) payload.proposed_to_nikolai_at = null
  if (!payload.pi_sent) payload.pi_sent_at = null
  if (!payload.pi_revision) payload.pi_revision_at = null
  if (!payload.pi_signed) payload.pi_signed_at = null
  if (payload.warehouse_arrived_at) payload.shipment_status = 'arrived'
  if (payload.shipment_status === 'not_shipped') {
    payload.transit_started_at = null
    payload.expected_warehouse_at = null
    payload.warehouse_arrived_at = null
  }
  if (payload.shipment_status === 'in_transit') payload.warehouse_arrived_at = null
  payload.status = calcStatus(payload)
  delete payload.id
  delete payload.created_at
  delete payload.updated_at
  delete payload.created_by
  return payload
}

function friendlyError(error) {
  if (!error) return 'Неизвестная ошибка'
  if (error.code === '23505') return 'Такой номер запроса уже существует.'
  if (error.code === '42501') return 'Недостаточно прав. Изменения может вносить только администратор.'
  if (/JWT issued at future/i.test(error.message || '')) return 'Сессия рассинхронизирована. Обновите страницу или войдите в систему снова.'
  if (/invalid input syntax for type date/i.test(error.message || '')) return 'Проверьте заполнение дат.'
  return error.message || 'Не удалось сохранить изменения.'
}

let authRefreshPromise = null

function isFutureJwtError(error) {
  return /JWT issued at future/i.test(error?.message || '')
}

async function refreshAuthSession() {
  if (!authRefreshPromise) {
    authRefreshPromise = (async () => {
      try {
        return await supabase.auth.refreshSession()
      } finally {
        authRefreshPromise = null
      }
    })()
  }
  return authRefreshPromise
}

async function queryWithSessionRecovery(queryFactory) {
  let result = await queryFactory()
  if (!isFutureJwtError(result.error)) return result

  const refreshResult = await refreshAuthSession()
  if (refreshResult.error || !refreshResult.data.session) {
    return { data: null, error: refreshResult.error || result.error }
  }

  await new Promise(resolve => setTimeout(resolve, 350))
  result = await queryFactory()
  return result
}

const formatDate = value => value
  ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`))
  : '—'

const formatDateTime = value => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'

function buildAnalytics(rows) {
  const supplierMap = new Map()
  const categoryMap = new Map()

  rows.forEach(row => {
    const supplier = row.agent_name || 'Без агента'
    const category = row.category || 'Без категории'
    if (!supplierMap.has(supplier)) supplierMap.set(supplier, { name: supplier, total: 0, signed: 0, revision: 0, categories: new Set() })
    const supplierItem = supplierMap.get(supplier)
    supplierItem.total += 1
    supplierItem.categories.add(category)
    if (row.pi_signed) supplierItem.signed += 1
    if (row.pi_revision) supplierItem.revision += 1

    if (!categoryMap.has(category)) categoryMap.set(category, { name: category, total: 0, suppliers: new Set() })
    const categoryItem = categoryMap.get(category)
    categoryItem.total += 1
    categoryItem.suppliers.add(supplier)
  })

  const suppliers = [...supplierMap.values()]
    .map(item => ({ ...item, categoriesCount: item.categories.size, categoriesText: [...item.categories].join(', ') }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const categories = [...categoryMap.values()]
    .map(item => ({ ...item, suppliersCount: item.suppliers.size }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return { suppliers, categories }
}

function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }
        })
    if (result.error) {
      setMessage(result.error.message === 'Invalid login credentials' ? 'Неверный email или пароль' : result.error.message)
    } else if (mode === 'signup' && !result.data.session) {
      setMessage('Проверьте почту и подтвердите регистрацию.')
    }
    setBusy(false)
  }

  return <div className="login-page">
    <div className="login-brand"><div className="logo">VL</div><div><b>VIOLET LEDGER</b><small>CHINA PROCUREMENT OS</small></div></div>
    <section className="login-visual" aria-label="Маршрут закупки">
      <div className="login-ribbons" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="login-visual-copy">
        <small>PRIVATE PROCUREMENT NETWORK</small>
        <h1>Весь путь товара.<br/>В одном ритме.</h1>
        <p>Запрос, агент, PI, логистика и склад — в защищённом пространстве вашей команды.</p>
      </div>
      <div className="login-route"><Factory/><span>Китай</span><i/><FileCheck2/><span>PI</span><i/><Warehouse/><span>Склад</span></div>
    </section>
    <main className="login-card">
      <div className="login-card-top"><div className="eyebrow"><ShieldCheck size={15}/> ДОСТУП ПО ПРИГЛАШЕНИЮ</div><span>VL / 02</span></div>
      <h2>{mode === 'login' ? 'С возвращением.' : 'Создайте аккаунт.'}</h2>
      <p>{mode === 'login' ? 'Войдите, чтобы продолжить работу с закупками.' : 'Регистрация доступна только для приглашённых пользователей.'}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email"/></label>
        <label>Пароль<input type="password" required minLength="8" value={password} onChange={event => setPassword(event.target.value)} placeholder="Не менее 8 символов" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
        {message && <div className="auth-message"><CircleAlert size={16}/>{message}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти в Violet Ledger' : 'Создать аккаунт'}<ArrowRight size={16}/></button>
      </form>
      <button className="link-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
        {mode === 'login' ? 'Получили приглашение? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
      </button>
      <div className="login-security"><ShieldCheck size={14}/> Данные защищены ролями и политиками RLS</div>
    </main>
  </div>
}

function Sidebar({ page, setPage, profile, open, setOpen }) {
  const items = [
    ['dashboard', LayoutDashboard, 'Обзор'],
    ['analytics', BarChart3, 'Аналитика'],
    ['logistics', Truck, 'Логистика'],
    ['requests', ClipboardList, 'Запросы'],
    ['audit', Activity, 'Журнал']
  ]
  if (profile?.role === 'admin') items.push(['users', Users, 'Доступ'])

  return <>
    <div className={`mobile-overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)}/>
    <aside className={open ? 'open' : ''}>
      <div className="brand"><div className="logo">VL</div><div><b>VIOLET LEDGER</b><small>CHINA PROCUREMENT OS</small></div><button className="close-mobile" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div>
      <div className="side-route"><span>CN</span><i/><span>BY</span></div>
      <nav>{items.map(([id, Icon, label], index) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setOpen(false) }}><span className="nav-index">0{index + 1}</span><Icon size={17}/><span>{label}</span>{page === id && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="side-footer"><div className="avatar">{profile?.email?.[0]?.toUpperCase()}</div><div><b>{profile?.email}</b><small>{roleLabel[profile?.role]}</small></div><button title="Выйти" onClick={() => supabase.auth.signOut()}><LogOut size={17}/></button></div>
    </aside>
  </>
}

function Header({ title, subtitle, onAdd, canEdit, setOpen, code = 'PROC' }) {
  return <header className="workspace-header"><button className="menu" aria-label="Открыть меню" onClick={() => setOpen(true)}><Menu/></button><div className="workspace-heading"><div className="page-code">Violet Ledger · {code.toLowerCase()}</div><h1>{title}</h1><p>{subtitle}</p></div>{onAdd && canEdit && <button className="primary header-action" onClick={onAdd}><Plus size={17}/> Новый запрос <ArrowRight size={15}/></button>}</header>
}

function Stat({ icon: Icon, label, value, note, index }) {
  return <div className="stat"><div className="stat-top"><span>METRIC_{index}</span><Icon size={18}/></div><strong>{String(value).padStart(2, '0')}</strong><b>{label}</b><small>{note}</small><div className="log-bars">{[3,7,4,9,5,8,6,10,4,7,9,5].map((height, i) => <i key={i} style={{ height: `${height * 2}px` }}/>)}</div></div>
}

function StatusPill({ status }) {
  const [label, index] = statusMeta[status] || statusMeta.request
  return <span className={`status ${status}`}><i>{index}</i>{label}</span>
}

function ShipmentPill({ status }) {
  const [label, tone] = shipmentMeta[status] || shipmentMeta.not_shipped
  return <span className={`shipment-pill ${tone}`}><i/>{label}</span>
}

function WorkflowChecklist({ row, editable = false, onToggle, onDateChange, actions = null }) {
  const total = WORKFLOW_GROUPS.reduce((sum, group) => sum + group.steps.length, 0)
  const done = WORKFLOW_GROUPS.reduce((sum, group) => sum + workflowProgress(row, group).done, 0)

  return <section className={`workflow-checklist ${editable ? 'editable' : 'readonly'}`}>
    <div className="workflow-checklist-head"><div><small>ОПЕРАЦИОННЫЙ МАРШРУТ</small><h3>Подготовка и отгрузка</h3></div><div className="workflow-checklist-head-side"><strong>{done}<span> / {total}</span></strong>{actions}</div></div>
    {WORKFLOW_GROUPS.map((group, groupIndex) => {
      const progress = workflowProgress(row, group)
      return <details className="workflow-group" key={group.id} defaultOpen={editable || groupIndex === 0}>
        <summary><div><b>{group.title}</b><small>{group.subtitle}</small></div><div className="workflow-group-progress"><span>{progress.done} / {progress.total}</span><i><em style={{ width: `${progress.percent}%` }}/></i></div></summary>
        <div className="workflow-step-list">
          {group.steps.map(([key, label, owner], index) => {
            const state = workflowStepState(row, key)
            return <div className={`workflow-step ${state.done ? 'done' : ''}`} key={key}>
              <button type="button" className="check" disabled={!editable} aria-label={`${state.done ? 'Снять отметку' : 'Отметить'}: ${label}`} onClick={() => onToggle?.(key, !state.done)}>{state.done && <Check size={14}/>}</button>
              <span className="workflow-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div><b>{label}</b>{owner && <small>{owner}</small>}</div>
              {editable ? <input type="date" aria-label={`Дата выполнения: ${label}`} value={state.completed_at} onChange={event => onDateChange?.(key, event.target.value)}/> : <time>{state.done ? formatDate(state.completed_at) : '—'}</time>}
            </div>
          })}
        </div>
      </details>
    })}
  </section>
}

function WorkflowProgressPill({ row }) {
  const total = WORKFLOW_GROUPS.reduce((sum, group) => sum + group.steps.length, 0)
  const done = WORKFLOW_GROUPS.reduce((sum, group) => sum + workflowProgress(row, group).done, 0)
  return <span className={`workflow-progress-pill ${done === total ? 'complete' : ''}`}><i style={{ '--workflow-progress': `${done / total * 100}%` }}/><b>{done}/{total}</b></span>
}

function PiDeadlineAlerts({ rows, onOpenRequests }) {
  const overdue = useMemo(() => rows.filter(piRequestIsOverdue), [rows])
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  useEffect(() => {
    if (!overdue.length || permission !== 'granted' || typeof Notification === 'undefined') return
    const today = localDateValue()
    let notified = {}
    try { notified = JSON.parse(localStorage.getItem('violet-pi-notifications') || '{}') }
    catch { notified = {} }
    const fresh = overdue.filter(row => notified[row.id] !== today)
    if (!fresh.length) return
    const names = fresh.slice(0, 3).map(row => row.request_number).join(', ')
    try {
      new Notification('Violet Ledger: PI ожидается больше 2 дней', {
        body: `${names}${fresh.length > 3 ? ` и ещё ${fresh.length - 3}` : ''}`,
        tag: `violet-pi-${today}`
      })
    } catch { return }
    fresh.forEach(row => { notified[row.id] = today })
    localStorage.setItem('violet-pi-notifications', JSON.stringify(notified))
  }, [overdue, permission])

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
    } catch { setPermission('unsupported') }
  }

  if (!overdue.length) return null
  return <section className="pi-deadline-alert" role="status">
    <div className="pi-deadline-icon"><CircleAlert/></div>
    <div><small>КОНТРОЛЬ PI · 2 ДНЯ</small><b>{overdue.length === 1 ? 'PI ожидается больше двух дней' : `${overdue.length} PI ожидаются больше двух дней`}</b><p>{overdue.slice(0, 4).map(row => `${row.request_number} · ${piRequestAgeDays(row)} дн.`).join('  /  ')}</p></div>
    <div className="pi-deadline-actions">{permission === 'default' && <button type="button" className="secondary" onClick={enableNotifications}>Включить уведомления</button>}<button type="button" className="primary" onClick={onOpenRequests}>Открыть запросы</button></div>
  </section>
}

function RequestJourney({ row, compact = false }) {
  const stages = requestStages(row)
  const lastDone = Math.max(0, stages.reduce((latest, stage, index) => stage.done ? index : latest, 0))
  return <div className={`request-journey ${compact ? 'compact' : ''}`} style={{ '--journey-complete': `${lastDone / (stages.length - 1) * 100}%` }}>
    <div className="request-journey-line"><i/></div>
    {stages.map((stage, index) => <div className={`request-journey-step ${stage.done ? 'done' : ''} ${index === lastDone ? 'current' : ''}`} key={stage.key}>
      <span>{stage.done ? <Check size={12}/> : index + 1}</span>
      {!compact && <><b>{stage.label}</b><small>{stage.date ? formatDate(stage.date) : stage.done && stage.key === 'calculation' ? 'Внесено' : '—'}</small></>}
    </div>)}
  </div>
}

const editableCycleStages = [
  { key: 'request', label: 'Запрос', dateKey: 'request_sent_at', fixed: true },
  { key: 'offer', label: 'Предложение', field: 'offer_received', dateKey: 'offer_received_at' },
  { key: 'calculation', label: 'Расчёт', field: 'included_calculation' },
  { key: 'proposed', label: 'Николаю', field: 'proposed_to_nikolai', dateKey: 'proposed_to_nikolai_at' },
  { key: 'pi_sent', label: 'PI', field: 'pi_sent', dateKey: 'pi_sent_at' },
  { key: 'revision', label: 'Доработка', field: 'pi_revision', dateKey: 'pi_revision_at' },
  { key: 'signed', label: 'Подписана', field: 'pi_signed', dateKey: 'pi_signed_at' }
]

function RequestCycleEditor({ row, onToggle, onDateChange }) {
  return <div className="request-cycle-editor">
    {editableCycleStages.map((stage, index) => {
      const done = stage.fixed ? Boolean(row.request_sent_at) : Boolean(row[stage.field])
      return <div className={`cycle-edit-stage ${done ? 'done' : ''}`} key={stage.key}>
        <button type="button" className="check" disabled={stage.fixed} aria-label={`${done ? 'Снять отметку' : 'Отметить'}: ${stage.label}`} onClick={() => onToggle(stage, !done)}>{done ? <Check size={14}/> : index + 1}</button>
        <b>{stage.label}</b>
        {stage.dateKey
          ? <input type="date" aria-label={`Дата этапа: ${stage.label}`} value={row[stage.dateKey] || ''} onChange={event => onDateChange(stage, event.target.value)}/>
          : <span>{done ? 'Внесено' : 'Не внесено'}</span>}
      </div>
    })}
  </div>
}

function ProcurementRoute({ rows }) {
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length
  const arrived = rows.filter(row => row.shipment_status === 'arrived').length
  return <section className="panel route-panel">
    <div className="panel-head"><div><span className="panel-tag">LOGISTICS / LIVE ROUTE</span><h2>Китай → агент → логистика → склад</h2><p>Операционный маршрут закупки и документов PI</p></div><Route size={20}/></div>
    <div className="route-track">
      <div className="route-node"><div className="route-icon"><Factory/></div><span>01 / 中国</span><b>Фабрика</b><small>{rows.length} товаров</small></div>
      <div className="route-connector"><i/><span>RFQ</span></div>
      <div className="route-node"><div className="route-icon"><ShoppingCart/></div><span>02 / AGENT</span><b>Китайский агент</b><small>{new Set(rows.map(row => row.agent_name)).size} поставщиков</small></div>
      <div className="route-connector"><i/><span>PI</span></div>
      <div className="route-node"><div className="route-icon"><Ship/></div><span>03 / TRANSIT</span><b>Логистика</b><small>{inTransit} в пути</small></div>
      <div className="route-connector"><i/><span>FREIGHT</span></div>
      <div className="route-node"><div className="route-icon"><Warehouse/></div><span>04 / STOCK</span><b>Склад</b><small>{arrived} принято</small></div>
    </div>
  </section>
}

function MiniSuppliers({ rows }) {
  const { suppliers } = useMemo(() => buildAnalytics(rows), [rows])
  const max = Math.max(...suppliers.map(item => item.total), 1)
  return <section className="panel dashboard-suppliers"><div className="panel-head"><div><span className="panel-tag">SUPPLIER LOAD</span><h2>Нагрузка по агентам</h2></div><Factory size={20}/></div><div className="bar-list">{suppliers.slice(0, 6).map((item, index) => <div className="bar-row" key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><b>{item.name}</b><div><i style={{ width: `${item.total / max * 100}%` }}/></div><strong>{item.total}</strong></div>)}{!suppliers.length && <div className="empty compact"><PackageOpen/><b>Нет данных</b></div>}</div></section>
}

function MiniCategories({ rows }) {
  const { categories } = useMemo(() => buildAnalytics(rows), [rows])
  return <section className="panel category-summary"><div className="panel-head"><div><span className="panel-tag">PRODUCT CATEGORIES</span><h2>Категории товаров</h2></div><Boxes size={20}/></div><div className="category-grid">{categories.slice(0, 6).map(item => <div className="category-cell" key={item.name}><Package size={17}/><span>{item.name}</span><strong>{item.total}</strong><small>{item.suppliersCount} агентов</small></div>)}{!categories.length && <div className="empty compact"><PackageOpen/><b>Нет данных</b></div>}</div></section>
}

function AnimatedHero({ rows, onAdd, onOpenLogistics, canEdit }) {
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length
  return <section className="animated-hero cinematic-hero" data-scene="hero">
    <div className="cinematic-panel">
      <svg className="cinematic-ribbons" viewBox="0 0 1200 680" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g className="ribbon-field">
          <path className="ribbon ribbon-lilac" d="M-180 80 C120 0 300 350 560 270 S940 -40 1380 110"/>
          <path className="ribbon ribbon-rust" d="M-170 610 C120 410 270 640 520 520 S870 210 1390 330"/>
          <path className="ribbon ribbon-green" d="M-170 470 C120 560 320 270 600 390 S970 610 1390 420"/>
          <path className="ribbon ribbon-sand" d="M-180 360 C100 210 350 520 610 430 S940 110 1390 220"/>
          <path className="ribbon ribbon-blue" d="M-160 270 C120 420 330 130 610 260 S980 520 1390 300"/>
          <path className="ribbon ribbon-violet" d="M-170 700 C160 490 360 760 650 590 S1030 280 1390 500"/>
        </g>
      </svg>
      <div className="cinematic-shade"/>
      <div className="cinematic-meta"><span><Package size={13}/> VIOLET LEDGER / ROUTE 01</span><span><i/> SYSTEM ONLINE</span></div>
      <div className="cinematic-copy">
        <small>Система закупок, которая ведёт товар</small>
        <h1>Весь путь товара:<br/>запрос, PI, логистика<br/>и склад</h1>
        {canEdit ? <button className="cinematic-cta" onClick={onAdd}><Package size={15}/> Создать запрос</button> : <button className="cinematic-cta" onClick={onOpenLogistics}><Route size={15}/> Смотреть маршрут</button>}
      </div>
      <div className="cinematic-status"><i/><span>CHINA PROCUREMENT / LIVE</span><b>{rows.length}</b></div>
      <div className="cinematic-route-dock" aria-label="Этапы закупки"><span>RFQ</span><i/><span>PI</span><i/><span>В пути {inTransit}</span><i/><span>Склад</span></div>
      <div className="cinematic-scroll-cue"><span>Прокрутите</span><i/></div>
    </div>
  </section>
}

function ProcurementJourneyStory({ rows, onOpenLogistics }) {
  const featured = rows[0] || {
    request_number: 'REQ-2026-001', product_name: 'Новый товар', category: 'Категория',
    agent_name: 'Китайский агент', request_sent_at: '', shipment_status: 'not_shipped'
  }
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length
  const signed = rows.filter(row => row.pi_signed).length
  const journeySteps = [
    [ClipboardList, 'Запрос', 'Фиксируем товар, категорию и агента'],
    [FileCheck2, 'PI', 'Предложение, расчёт и согласование'],
    [Ship, 'В пути', `${inTransit} активных перевозок`],
    [Warehouse, 'Склад', `${rows.filter(row => row.shipment_status === 'arrived').length} товаров принято`]
  ]

  return <section className="story-section story-journey" data-scene="journey" data-active="0">
    <div className="journey-sticky">
      <div className="journey-copy" data-reveal="intro">
        <div className="story-label story-label-light"><Route size={15}/> Живой маршрут</div>
        <h2>Одна карточка.<br/>Весь путь закупки.</h2>
        <p>Статусы меняются, а контекст остаётся перед глазами — от первого запроса до приёмки на складе.</p>
        <div className="journey-step-list">
          {journeySteps.map(([Icon, title, note], index) => <button type="button" data-journey-step={index} className={index === 0 ? 'is-active' : ''} key={title}>
            <span><Icon/></span><b>0{index + 1} · {title}</b><small>{note}</small>
          </button>)}
        </div>
        <button className="journey-link" onClick={onOpenLogistics}>Открыть логистику <ArrowRight size={15}/></button>
      </div>
      <div className="journey-visual" data-reveal="card" style={{ '--reveal-delay': '120ms' }}>
        <div className="journey-card-layer journey-layer-three"/>
        <div className="journey-card-layer journey-layer-two"/>
        <article className="journey-request-card">
          <div className="journey-card-head"><div><small>ТЕКУЩАЯ ЗАКУПКА</small><b>{featured.request_number}</b></div><StatusPill status={calcStatus(featured)}/></div>
          <div className="journey-card-product"><div className="journey-product-mark"><Package/></div><div><small>{featured.category}</small><h3>{featured.product_name}</h3><p><Factory size={13}/>{featured.agent_name}</p></div></div>
          <RequestJourney row={featured}/>
          <div className="journey-card-stats"><span><small>Запрос отправлен</small><b>{formatDate(featured.request_sent_at)}</b></span><span><small>PI подписано</small><b>{signed}</b></span><span><small>В пути</small><b>{inTransit}</b></span></div>
          <div className="journey-motion-orbit" aria-hidden="true"><i/><i/><span><Route/></span></div>
        </article>
        {journeySteps.map(([Icon, title], index) => <div className={`journey-floating-node node-${index + 1} ${index === 0 ? 'is-active' : ''}`} data-journey-art={index} key={title}><Icon/><span>{title}</span></div>)}
      </div>
    </div>
  </section>
}

function usePhantomMotion() {
  const storyRef = useRef(null)

  useEffect(() => {
    const story = storyRef.current
    if (!story) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealItems = [...story.querySelectorAll('[data-reveal]')]
    const hero = story.querySelector('.animated-hero')
    const ribbonField = story.querySelector('.ribbon-field')
    const ribbons = [...story.querySelectorAll('.ribbon')]
    story.classList.add('js-ribbon-motion')

    let observer = null
    let revealFallback = 0
    if (reducedMotion) {
      story.classList.add('story-ready', 'reduce-motion')
      revealItems.forEach(item => item.classList.add('is-visible'))
    } else {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      }, { threshold: 0.08, rootMargin: '0px 0px -9% 0px' })

      revealItems.forEach(item => observer.observe(item))
      requestAnimationFrame(() => story.classList.add('story-ready'))

      revealFallback = window.setTimeout(() => {
        revealItems.forEach(item => {
          if (item.getBoundingClientRect().top < window.innerHeight * 1.15) item.classList.add('is-visible')
        })
      }, 1400)
    }

    let frame = 0
    const updateParallax = () => {
      frame = 0
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      const distance = Math.max(hero.offsetHeight - window.innerHeight * 0.32, 1)
      const progress = Math.min(1, Math.max(0, -rect.top / distance))
      if (!reducedMotion) {
        story.style.setProperty('--hero-shift', `${Math.round(progress * -82)}px`)
        story.style.setProperty('--layer-two-shift', `${Math.round(progress * -30)}px`)
        story.style.setProperty('--layer-three-shift', `${Math.round(progress * -16)}px`)
        story.style.setProperty('--hero-copy-shift', `${Math.round(progress * -26)}px`)
        story.style.setProperty('--hero-copy-opacity', String(1 - Math.min(progress * .48, .42)))
      }

      story.querySelectorAll('[data-scene]').forEach(scene => {
        const sceneRect = scene.getBoundingClientRect()
        const sceneProgress = Math.min(1, Math.max(0, (window.innerHeight - sceneRect.top) / (window.innerHeight + sceneRect.height)))
        scene.style.setProperty('--scene-progress', sceneProgress.toFixed(3))
        scene.style.setProperty('--scene-lift', `${Math.round((.5 - sceneProgress) * 32)}px`)

        if (scene.classList.contains('story-journey')) {
          const journeyDistance = Math.max(sceneRect.height - window.innerHeight * .72, 1)
          const journeyProgress = Math.min(1, Math.max(0, -sceneRect.top / journeyDistance))
          const activeStage = Math.min(3, Math.floor(journeyProgress * 4))
          scene.dataset.active = String(activeStage)
          scene.style.setProperty('--journey-progress', journeyProgress.toFixed(3))
          scene.querySelectorAll('[data-journey-step]').forEach((item, index) => item.classList.toggle('is-active', index === activeStage))
          scene.querySelectorAll('[data-journey-art]').forEach((item, index) => item.classList.toggle('is-active', index === activeStage))
        }
      })
    }
    const requestParallax = () => {
      if (frame) return
      frame = requestAnimationFrame(updateParallax)
    }

    updateParallax()
    window.addEventListener('scroll', requestParallax, { passive: true })
    window.addEventListener('resize', requestParallax)

    let ribbonFrame = 0
    let ribbonsActive = true
    let motionEpoch = performance.now()
    let pointerX = 0
    let pointerY = 0
    const motionScale = reducedMotion ? 0.24 : 1
    const motionSpeed = reducedMotion ? 0.35 : 1

    const updatePointer = event => {
      if (!hero || event.pointerType === 'touch') return
      const rect = hero.getBoundingClientRect()
      pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 2
      pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * 2
    }
    const resetPointer = () => { pointerX = 0; pointerY = 0 }
    hero?.addEventListener('pointermove', updatePointer, { passive: true })
    hero?.addEventListener('pointerleave', resetPointer)

    const animateRibbons = now => {
      ribbonFrame = 0
      if (!ribbonsActive || document.hidden || !ribbonField || !ribbons.length) return
      const time = ((now - motionEpoch) / 1000) * motionSpeed
      const fieldX = (Math.sin(time * .52) * 22 + pointerX * 11) * motionScale
      const fieldY = (Math.cos(time * .41) * 14 + pointerY * 8) * motionScale
      const fieldScale = 1 + Math.sin(time * .31) * .035 * motionScale
      const fieldAngle = Math.sin(time * .27) * 1.6 * motionScale
      ribbonField.setAttribute('transform', `translate(${fieldX.toFixed(2)} ${fieldY.toFixed(2)}) scale(${fieldScale.toFixed(4)}) rotate(${fieldAngle.toFixed(2)} 600 340)`)

      ribbons.forEach((ribbon, index) => {
        const phase = index * 1.17
        const x = Math.sin(time * (.68 + index * .035) + phase) * (34 + index * 3) * motionScale
        const y = Math.cos(time * (.57 + index * .028) + phase) * (23 + index * 2) * motionScale
        const angle = Math.sin(time * (.49 + index * .02) + phase) * 2.7 * motionScale
        ribbon.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)} 600 340)`)
      })
      ribbonFrame = requestAnimationFrame(animateRibbons)
    }

    const startRibbonMotion = () => {
      if (!ribbonFrame && ribbonsActive && !document.hidden) ribbonFrame = requestAnimationFrame(animateRibbons)
    }
    const stopRibbonMotion = () => {
      if (ribbonFrame) cancelAnimationFrame(ribbonFrame)
      ribbonFrame = 0
    }
    const ribbonObserver = new IntersectionObserver(([entry]) => {
      ribbonsActive = entry.isIntersecting
      if (ribbonsActive) startRibbonMotion()
      else stopRibbonMotion()
    }, { threshold: 0.01 })
    if (hero) ribbonObserver.observe(hero)

    const resumeRibbonMotion = () => {
      if (document.hidden) stopRibbonMotion()
      else {
        motionEpoch = performance.now()
        startRibbonMotion()
      }
    }
    document.addEventListener('visibilitychange', resumeRibbonMotion)
    window.addEventListener('pageshow', resumeRibbonMotion)
    startRibbonMotion()

    return () => {
      observer?.disconnect()
      ribbonObserver.disconnect()
      if (revealFallback) window.clearTimeout(revealFallback)
      window.removeEventListener('scroll', requestParallax)
      window.removeEventListener('resize', requestParallax)
      document.removeEventListener('visibilitychange', resumeRibbonMotion)
      window.removeEventListener('pageshow', resumeRibbonMotion)
      hero?.removeEventListener('pointermove', updatePointer)
      hero?.removeEventListener('pointerleave', resetPointer)
      stopRibbonMotion()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return storyRef
}

function Dashboard({ rows, onAdd, onOpenLogistics, canEdit }) {
  const counts = useMemo(() => rows.reduce((acc, row) => { acc[calcStatus(row)] += 1; return acc }, { request: 0, offer: 0, calculation: 0, proposed: 0, pi_sent: 0, revision: 0, signed: 0, unsuccessful: 0 }), [rows])
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length
  const arrived = rows.filter(row => row.shipment_status === 'arrived').length
  const supplierCount = new Set(rows.map(row => row.agent_name).filter(Boolean)).size
  const storyRef = usePhantomMotion()

  return <div className="phantom-story" ref={storyRef}>
    <AnimatedHero rows={rows} onAdd={onAdd} onOpenLogistics={onOpenLogistics} canEdit={canEdit}/>
    {!canEdit && <div className="read-only-banner"><ShieldCheck size={16}/><span>РЕЖИМ ПРОСМОТРА</span> Изменения доступны только администратору.</div>}

    <section className="story-section story-manifesto" data-scene="manifesto">
      <h2 data-reveal="statement">Управление закупками<br/>для <span className="manifesto-mark"><Route/></span> всей команды</h2>
      <button className="manifesto-cta" data-reveal="statement" style={{ '--reveal-delay': '130ms' }} onClick={onOpenLogistics}>Смотреть этапы <ArrowRight size={15}/></button>
    </section>

    <ProcurementJourneyStory rows={rows} onOpenLogistics={onOpenLogistics}/>

    <section className="story-section story-products" data-scene="products">
      <div className="section-intro" data-reveal="intro">
        <div className="story-label story-label-light"><Boxes size={15}/> Три рабочих этапа</div>
        <h2>Запрос. PI. Доставка.</h2>
        <p>Не таблица на главной, а наглядный путь каждой закупки.</p>
      </div>
      <div className="story-grid">
        <article className="story-card story-blue" data-reveal="card" style={{ '--reveal-delay': '0ms' }}>
          <h3>Все запросы<br/>в одном месте.</h3>
          <div className="story-cloud"><Package/><span>{rows.length}</span></div>
          <div className="story-floating-pill"><ClipboardList/><small>Активные запросы</small><strong>{rows.length - counts.signed - counts.unsuccessful}</strong></div>
        </article>
        <article className="story-card story-violet" data-reveal="card" style={{ '--reveal-delay': '110ms' }}>
          <h3>PI движется быстро.<br/>Даже после правок.</h3>
          <div className="story-message message-one">Получено <b>{counts.offer}</b></div>
          <div className="story-message message-two">На доработке <b>{counts.revision}</b></div>
          <div className="story-coin"><FileCheck2/><span>{counts.signed}</span></div>
        </article>
        <article className="story-card story-peach" data-reveal="card" style={{ '--reveal-delay': '220ms' }}>
          <h3>Путь от фабрики<br/>до склада виден целиком.</h3>
          <div className="story-route-card"><Factory/><i/><Truck/><i/><Warehouse/></div>
          <div className="story-route-metrics"><span><b>{inTransit}</b> в пути</span><span><b>{arrived}</b> на складе</span></div>
        </article>
      </div>
    </section>

    <section className="story-section story-dark story-statement" data-scene="statement">
      <div className="statement-orbit" aria-hidden="true"><i/><i/><i/></div>
      <h2 data-reveal="statement">Управляете вы.<br/>Система <span className="statement-mark"><ShieldCheck/></span> держит ритм.</h2>
      <button className="primary" data-reveal="statement" style={{ '--reveal-delay': '140ms' }} onClick={onOpenLogistics}>Смотреть путь товара <ArrowRight size={16}/></button>
    </section>

    <section className="story-section story-dark story-cards" data-scene="security">
      <div className="section-intro section-intro-dark" data-reveal="intro">
        <div className="story-label"><ShieldCheck size={15}/> Ваша система контроля</div>
        <h2>Защита без лишнего шума.</h2>
        <p>Роли, журнал и правила доступа работают в фоне.</p>
      </div>
      <div className="control-grid">
        <article className="control-card control-white" data-reveal="card" style={{ '--reveal-delay': '0ms' }}><h3>Данные защищены.<br/>Доступ — только по ролям.</h3><div className="control-pattern"><ShieldCheck/><span>RLS</span></div></article>
        <article className="control-card control-yellow" data-reveal="card" style={{ '--reveal-delay': '110ms' }}><h3>Команда видит только<br/>разрешённую информацию.</h3><div className="chat-stack"><span>Нужен доступ?</span><span>Только просмотр.</span></div></article>
        <article className="control-card control-pink" data-reveal="card" style={{ '--reveal-delay': '220ms' }}><h3>Каждое изменение<br/>фиксируется автоматически.</h3><div className="audit-device"><Activity/><b>Журнал действий</b><span>{rows.length} товаров под контролем</span></div></article>
      </div>
    </section>

    <section className="story-section story-final" data-scene="final">
      <small data-reveal="final">Больше, чем реестр.</small>
      <h2 data-reveal="final" style={{ '--reveal-delay': '90ms' }}>Начните.<br/>Добавьте <span className="final-mark"><Package/></span> запрос.</h2>
      {canEdit && <button className="secondary" data-reveal="final" style={{ '--reveal-delay': '180ms' }} onClick={onAdd}>Создать новый запрос <ArrowRight size={16}/></button>}
      <p>{supplierCount} китайских агентов · {rows.length} товаров · {inTransit} поставок в пути</p>
    </section>
  </div>
}

function RequestDetail({ row, onClose, onEdit, onSaveInline, canEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...row, workflow_steps: row.workflow_steps || {} })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    setDraft({ ...row, workflow_steps: row.workflow_steps || {} })
    setEditing(false)
    setError('')
  }, [row])

  const toggleWorkflowStep = (key, done) => setDraft(current => {
    const workflowSteps = { ...(current.workflow_steps || {}) }
    if (done) workflowSteps[key] = { done: true, completed_at: localDateValue() }
    else delete workflowSteps[key]
    return { ...current, workflow_steps: workflowSteps }
  })

  const setWorkflowDate = (key, completedAt) => setDraft(current => ({
    ...current,
    workflow_steps: {
      ...(current.workflow_steps || {}),
      [key]: { done: completedAt ? true : workflowStepState(current, key).done, completed_at: completedAt }
    }
  }))

  const toggleCycleStage = (stage, done) => setDraft(current => ({
    ...current,
    [stage.field]: done,
    ...(stage.dateKey ? { [stage.dateKey]: done ? (current[stage.dateKey] || localDateValue()) : '' } : {})
  }))

  const setCycleDate = (stage, value) => setDraft(current => ({
    ...current,
    [stage.dateKey]: value,
    ...(stage.field ? { [stage.field]: Boolean(value) || current[stage.field] } : {})
  }))

  function cancelInlineEditing() {
    setDraft({ ...row, workflow_steps: row.workflow_steps || {} })
    setEditing(false)
    setError('')
  }

  async function saveInline() {
    setBusy(true)
    setError('')
    try {
      await onSaveInline(draft)
      setEditing(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  const view = editing ? draft : row

  return <div className="request-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="request-detail-drawer" role="dialog" aria-modal="true" aria-label={`Запрос ${row.request_number}`}>
      <div className="request-detail-topbar"><span>КАРТОЧКА ЗАКУПКИ</span><button aria-label="Закрыть карточку" onClick={onClose}><X/></button></div>
      <div className="request-detail-hero">
        <div className="request-detail-mark"><Package/></div>
        <div><small>{view.request_number}</small><h2>{view.product_name}</h2><p>{view.category}</p></div>
        <StatusPill status={calcStatus(view)}/>
      </div>
      <section className="request-detail-section">
        <div className="request-detail-title"><span>Цикл запроса и PI</span><small>{editing ? 'Меняйте этапы и даты прямо здесь' : 'Обновляется из общей базы'}</small></div>
        {editing ? <RequestCycleEditor row={draft} onToggle={toggleCycleStage} onDateChange={setCycleDate}/> : <RequestJourney row={view}/>}
      </section>
      <WorkflowChecklist row={draft} editable={editing} onToggle={toggleWorkflowStep} onDateChange={setWorkflowDate}/>
      {error && <div className="form-error workflow-inline-error"><CircleAlert size={16}/><div><b>Изменения не сохранены</b><span>{error}</span></div></div>}
      <section className="request-detail-grid">
        <div><Factory/><small>Китайский агент</small><b>{view.agent_name || '—'}</b></div>
        <div><Boxes/><small>Артикулы</small><b>{view.article_numbers || 'Не указаны'}</b></div>
        <div><Clock3/><small>Запрос отправлен</small><b>{formatDate(view.request_sent_at)}</b></div>
        <div><Users/><small>Предложено Николаю</small><b>{view.proposed_to_nikolai ? formatDate(view.proposed_to_nikolai_at) : 'Нет'}</b></div>
        <div><Truck/><small>Логистика</small><b>{view.logistics_company || 'Не назначена'}</b></div>
        <div><Warehouse/><small>Состояние поставки</small><b>{shipmentMeta[view.shipment_status]?.[0] || shipmentMeta.not_shipped[0]}</b></div>
      </section>
      {(view.price_not_viable || view.not_approved) && <section className="request-detail-failure"><CircleAlert/><div><small>СДЕЛКА НЕ УСПЕШНА</small><p>{[view.price_not_viable && 'Цена не проходит по нашим методам', view.not_approved && 'Предложение не согласовано'].filter(Boolean).join(' · ')}</p></div></section>}
      <section className="request-detail-section request-detail-route">
        <div className="request-detail-title"><span>Маршрут поставки</span><ShipmentPill status={view.shipment_status}/></div>
        <div className="detail-route-track"><span className="done"><Factory/><b>Фабрика</b></span><i/><span className={view.shipment_status !== 'not_shipped' ? 'done' : ''}><Ship/><b>В пути</b></span><i/><span className={view.shipment_status === 'arrived' ? 'done' : ''}><Warehouse/><b>Склад</b></span></div>
      </section>
      {view.notes && <section className="request-detail-note"><small>КОММЕНТАРИЙ</small><p>{view.notes}</p></section>}
      <div className="request-detail-actions">{editing ? <><button type="button" className="secondary" disabled={busy} onClick={cancelInlineEditing}>Отмена</button><button type="button" className="primary" disabled={busy} onClick={saveInline}>{busy ? 'Сохранение…' : 'Сохранить изменения'}</button></> : <><button className="secondary" onClick={onClose}>Закрыть</button>{canEdit && <button className="secondary detail-all-fields" onClick={() => { onClose(); onEdit(row) }}>Все поля</button>}{canEdit && <button className="primary" onClick={() => setEditing(true)}><Pencil size={15}/> Редактировать здесь</button>}</>}</div>
    </div>
  </div>
}

function RequestTable({ rows, onEdit, onDelete, onInspect, canEdit, compact = false }) {
  if (!rows.length) return <div className="empty"><PackageOpen size={34}/><b>Запросов пока нет</b><span>Администратор может добавить первую товарную позицию.</span></div>
  return <>
    <div className="table-wrap request-table-view"><table><thead><tr><th>ID запроса</th><th>Товар / категория</th><th>Китайский агент</th><th>Отправлен</th><th>Логистика</th><th>Чек-лист</th><th>Текущий этап</th>{!compact && <th>Действия</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id} onDoubleClick={() => onInspect?.(row)}>
      <td><button className="request-number-link" onClick={() => onInspect?.(row)}>{row.request_number}<ChevronRight size={13}/></button></td>
      <td><b>{row.product_name}</b><small>{row.category}{row.article_numbers ? ` · ${row.article_numbers}` : ''}</small></td>
      <td><span className="supplier-cell"><Factory size={14}/>{row.agent_name}</span></td>
      <td>{formatDate(row.request_sent_at)}</td>
      <td><ShipmentPill status={row.shipment_status}/>{row.logistics_company && <small>{row.logistics_company}</small>}</td>
      <td><WorkflowProgressPill row={row}/></td>
      <td><StatusPill status={calcStatus(row)}/></td>
      {!compact && <td><div className="row-actions"><button title="Открыть карточку" onClick={() => onInspect?.(row)}><ChevronRight size={16}/></button>{canEdit ? <><button title="Редактировать" onClick={() => onEdit(row)}><Pencil size={15}/></button><button title="Удалить" className="danger" onClick={() => onDelete(row)}><Trash2 size={15}/></button></> : <span className="locked-action"><ShieldCheck size={14}/> Просмотр</span>}</div></td>}
    </tr>)}</tbody></table></div>
    <div className="request-card-list">{rows.map(row => <article className="mobile-request-card" key={row.id}>
      <div className="mobile-request-head"><button onClick={() => onInspect?.(row)}>{row.request_number}<ChevronRight size={14}/></button><StatusPill status={calcStatus(row)}/></div>
      <h3>{row.product_name}</h3><p>{row.category}</p>
      <RequestJourney row={row} compact/>
      <div className="mobile-request-meta"><span><Factory size={14}/><small>Агент</small><b>{row.agent_name || '—'}</b></span><span><Clock3 size={14}/><small>Отправлен</small><b>{formatDate(row.request_sent_at)}</b></span></div>
      <div className="mobile-request-footer"><ShipmentPill status={row.shipment_status}/><WorkflowProgressPill row={row}/><button className="inline-edit" onClick={() => onInspect?.(row)}>Открыть карточку <ArrowRight size={14}/></button></div>
    </article>)}</div>
  </>
}

function Requests({ rows, onAdd, onEdit, onDelete, onSaveInline, canEdit, setOpen }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [agent, setAgent] = useState('all')
  const [category, setCategory] = useState('all')
  const [checklist, setChecklist] = useState('all')
  const [deadline, setDeadline] = useState('all')
  const [selected, setSelected] = useState(null)
  const agents = useMemo(() => [...new Set(rows.map(row => row.agent_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows])
  const categories = useMemo(() => [...new Set(rows.map(row => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows])
  const totalWorkflowSteps = WORKFLOW_GROUPS.reduce((sum, group) => sum + group.steps.length, 0)
  const filtered = useMemo(() => rows.filter(row => {
    const workflowDone = WORKFLOW_GROUPS.reduce((sum, group) => sum + workflowProgress(row, group).done, 0)
    const matchesChecklist = checklist === 'all'
      || (checklist === 'not_started' && workflowDone === 0)
      || (checklist === 'in_progress' && workflowDone > 0 && workflowDone < totalWorkflowSteps)
      || (checklist === 'complete' && workflowDone === totalWorkflowSteps)
    const matchesDeadline = deadline === 'all'
      || (deadline === 'overdue' && piRequestIsOverdue(row))
      || (deadline === 'on_time' && !piRequestIsOverdue(row))
    return (status === 'all' || calcStatus(row) === status)
      && (agent === 'all' || row.agent_name === agent)
      && (category === 'all' || row.category === category)
      && matchesChecklist
      && matchesDeadline
      && [row.request_number, row.product_name, row.category, row.agent_name, row.article_numbers].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  }), [rows, query, status, agent, category, checklist, deadline, totalWorkflowSteps])
  const hasFilters = query || status !== 'all' || agent !== 'all' || category !== 'all' || checklist !== 'all' || deadline !== 'all'

  useEffect(() => {
    setSelected(current => current ? (rows.find(row => row.id === current.id) || null) : null)
  }, [rows])

  function resetFilters() {
    setQuery('')
    setStatus('all')
    setAgent('all')
    setCategory('all')
    setChecklist('all')
    setDeadline('all')
  }
  const revision = rows.filter(row => row.pi_revision && !row.pi_signed).length
  const signed = rows.filter(row => row.pi_signed).length
  const unsuccessful = rows.filter(row => row.price_not_viable || row.not_approved).length
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length

  return <>
    <Header title="Реестр запросов" subtitle={`${rows.length} товарных позиций · единый цикл от запроса до склада`} onAdd={onAdd} canEdit={canEdit} setOpen={setOpen} code="requests"/>
    {!canEdit && <div className="read-only-banner"><ShieldCheck size={16}/><span>Режим просмотра</span> Добавление, редактирование и удаление доступны только администратору.</div>}
    <section className="registry-overview">
      <article><span><ClipboardList/>Всего запросов</span><strong>{rows.length}</strong><small>В общей базе</small></article>
      <article><span><FilePenLine/>На доработке</span><strong>{revision}</strong><small>Требуют внимания</small></article>
      <article><span><FileCheck2/>PI подписано</span><strong>{signed}</strong><small>Готовы к следующему шагу</small></article>
      <article><span><CircleAlert/>Сделка не успешна</span><strong>{unsuccessful}</strong><small>Цена не прошла или не согласовано</small></article>
      <article><span><Ship/>Сейчас в пути</span><strong>{inTransit}</strong><small>Активные перевозки</small></article>
    </section>
    <section className="panel registry"><div className="registry-toolbar-head"><div><small>ТОВАРНЫЕ ПОЗИЦИИ</small><h2>Рабочий реестр</h2></div><span>{filtered.length} из {rows.length}</span></div><div className="toolbar registry-filter-toolbar"><div className="search"><Search size={17}/><input placeholder="Номер, товар, артикул, категория или агент" value={query} onChange={event => setQuery(event.target.value)}/></div><div className="registry-filter-grid"><div className="filter"><Filter size={16}/><select aria-label="Фильтр по этапу" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все этапы</option>{Object.entries(statusMeta).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="filter"><Factory size={16}/><select aria-label="Фильтр по агенту" value={agent} onChange={event => setAgent(event.target.value)}><option value="all">Все агенты</option>{agents.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="filter"><Boxes size={16}/><select aria-label="Фильтр по категории" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Все категории</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="filter"><ClipboardList size={16}/><select aria-label="Фильтр по чек-листу" value={checklist} onChange={event => setChecklist(event.target.value)}><option value="all">Любой чек-лист</option><option value="not_started">Не начат</option><option value="in_progress">В работе</option><option value="complete">Завершён</option></select></div><div className="filter"><Clock3 size={16}/><select aria-label="Фильтр по сроку PI" value={deadline} onChange={event => setDeadline(event.target.value)}><option value="all">Любой срок PI</option><option value="overdue">PI просрочена</option><option value="on_time">Без просрочки PI</option></select></div>{hasFilters && <button type="button" className="filter-reset" onClick={resetFilters}><X size={15}/> Сбросить</button>}</div></div><RequestTable rows={filtered} onEdit={onEdit} onDelete={onDelete} onInspect={setSelected} canEdit={canEdit}/></section>
    {selected && <RequestDetail row={selected} onClose={() => setSelected(null)} onEdit={onEdit} onSaveInline={onSaveInline} canEdit={canEdit}/>}
  </>
}

function Analytics({ rows, setOpen }) {
  const { suppliers, categories } = useMemo(() => buildAnalytics(rows), [rows])
  const maxCategory = Math.max(...categories.map(item => item.total), 1)
  const topSupplier = suppliers[0]
  const topCategory = categories[0]
  const average = suppliers.length ? (rows.length / suppliers.length).toFixed(1) : '0.0'

  return <>
    <Header title="Агенты и товарная матрица" subtitle="Статистика по китайским поставщикам, категориям и количеству товаров." setOpen={setOpen} code="supplier-analytics"/>
    <section className="stats-grid analytics-stats">
      <Stat icon={Factory} label="Всего агентов" value={suppliers.length} note="Активные поставщики" index="01"/>
      <Stat icon={Package} label="Всего товаров" value={rows.length} note="По всем агентам" index="02"/>
      <Stat icon={Boxes} label="Категорий" value={categories.length} note={topCategory ? `Лидер: ${topCategory.name}` : 'Нет данных'} index="03"/>
      <Stat icon={BarChart3} label="Среднее" value={average} note="Товаров на агента" index="04"/>
    </section>
    <section className="panel supplier-table-panel"><div className="panel-head"><div><span className="panel-tag">SUPPLIER MATRIX</span><h2>Статистика по агентам</h2><p>{topSupplier ? `Наибольшая нагрузка: ${topSupplier.name} — ${topSupplier.total} товаров` : 'Добавьте запросы для формирования статистики'}</p></div><Globe2 size={20}/></div>
      {suppliers.length ? <div className="table-wrap"><table><thead><tr><th>Китайский агент</th><th>Товаров</th><th>Категорий</th><th>Какие категории</th><th>PI подписано</th><th>На доработке</th></tr></thead><tbody>{suppliers.map((item, index) => <tr key={item.name}><td><span className="supplier-cell"><span className="matrix-index">{String(index + 1).padStart(2, '0')}</span><Factory size={14}/><b>{item.name}</b></span></td><td><strong className="metric-number">{item.total}</strong></td><td>{item.categoriesCount}</td><td className="category-text">{item.categoriesText}</td><td>{item.signed}</td><td>{item.revision}</td></tr>)}</tbody></table></div> : <div className="empty"><Factory/><b>Поставщиков пока нет</b></div>}
    </section>
    <section className="panel"><div className="panel-head"><div><span className="panel-tag">CATEGORY DISTRIBUTION</span><h2>Распределение товаров по категориям</h2></div><Boxes size={20}/></div><div className="category-bars">{categories.map((item, index) => <div className="category-bar" key={item.name}><div><span>{String(index + 1).padStart(2, '0')}</span><b>{item.name}</b><small>{item.suppliersCount} агентов</small></div><div className="bar-track"><i style={{ width: `${item.total / maxCategory * 100}%` }}/></div><strong>{item.total}</strong></div>)}{!categories.length && <div className="empty"><Boxes/><b>Категорий пока нет</b></div>}</div></section>
  </>
}

function Logistics({ rows, onEdit, canEdit, setOpen }) {
  const [filter, setFilter] = useState('all')
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit')
  const arrived = rows.filter(row => row.shipment_status === 'arrived')
  const waiting = rows.filter(row => !row.shipment_status || row.shipment_status === 'not_shipped')
  const companies = new Set(rows.map(row => row.logistics_company).filter(Boolean))
  const filtered = filter === 'all' ? rows : rows.filter(row => (row.shipment_status || 'not_shipped') === filter)

  return <>
    <Header title="Управление логистикой" subtitle="Что уже в пути, у какой компании и когда товар поступил на склад." setOpen={setOpen} code="mission-logistics"/>
    {!canEdit && <div className="read-only-banner"><ShieldCheck size={16}/><span>РЕЖИМ ПРОСМОТРА</span> Статус перевозки изменяет только администратор.</div>}
    <section className="stats-grid logistics-stats">
      <Stat icon={Package} label="Ожидает" value={waiting.length} note="Ещё не отправлено" index="01"/>
      <Stat icon={Ship} label="В пути" value={inTransit.length} note="Активные перевозки" index="02"/>
      <Stat icon={Warehouse} label="На складе" value={arrived.length} note="Фактически принято" index="03"/>
      <Stat icon={Truck} label="Компаний" value={companies.size} note="Логистические партнёры" index="04"/>
    </section>
    <section className="panel mission-panel">
      <div className="panel-head"><div><span className="panel-tag">LIVE SHIPMENT CONTROL</span><h2>Маршрут поставок</h2><p>Оперативное состояние каждой товарной позиции</p></div><MapPinned size={20}/></div>
      <div className="mission-orbit"><div><Factory/><span>КИТАЙ / CN</span></div><i/><div className="signal-node"><Ship/><span>{inTransit.length} В ПУТИ</span></div><i/><div><Warehouse/><span>СКЛАД / BY</span></div></div>
    </section>
    <section className="panel logistics-table-panel">
      <div className="toolbar"><div className="filter"><Filter size={16}/><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Все перевозки</option><option value="not_shipped">Ожидает отправки</option><option value="in_transit">В пути</option><option value="arrived">На складе</option></select></div></div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Товар</th><th>Китайский агент</th><th>Статус</th><th>Логистическая компания</th><th>В пути с</th><th>План склада</th><th>Прибыл на склад</th><th>Управление</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><b>{row.product_name}</b><small>{row.request_number} · {row.category}</small></td><td>{row.agent_name}</td><td><ShipmentPill status={row.shipment_status}/></td><td>{row.logistics_company || '—'}</td><td>{formatDate(row.transit_started_at)}</td><td>{formatDate(row.expected_warehouse_at)}</td><td>{formatDate(row.warehouse_arrived_at)}</td><td>{canEdit ? <button className="inline-edit" onClick={() => onEdit(row)}><Pencil size={14}/> Изменить</button> : <span className="locked-action"><ShieldCheck size={14}/> read_only</span>}</td></tr>)}</tbody></table></div> : <div className="empty"><Ship/><b>Нет перевозок с таким статусом</b></div>}
    </section>
  </>
}

function LogisticsModal({ value, onClose, onSave }) {
  const [form, setForm] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, nextValue) => setForm(current => ({ ...current, [key]: nextValue }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message)
      setBusy(false)
    }
  }

  return <div className="modal-backdrop"><div className="modal logistics-modal"><div className="modal-head"><div><div className="terminal-line">mission/logistics/update</div><div className="eyebrow">УПРАВЛЕНИЕ ПЕРЕВОЗКОЙ</div><h2>{form.product_name}</h2><p>{form.request_number} · {form.agent_name}</p></div><button onClick={onClose}><X/></button></div><form onSubmit={submit}>
    <div className="shipment-visual"><Factory/><i/><Ship/><i/><Warehouse/></div>
    <div className="form-grid">
      <label>Статус перевозки *<select required value={form.shipment_status || 'not_shipped'} onChange={event => set('shipment_status', event.target.value)}><option value="not_shipped">Ожидает отправки</option><option value="in_transit">В пути</option><option value="arrived">На складе</option></select></label>
      <label>Логистическая компания {form.shipment_status !== 'not_shipped' && '*'}<input required={form.shipment_status !== 'not_shipped'} value={form.logistics_company || ''} onChange={event => set('logistics_company', event.target.value)} placeholder="Например, China Cargo"/></label>
      {form.shipment_status !== 'not_shipped' && <><label>Дата отправки в путь *<input required type="date" value={form.transit_started_at || ''} onChange={event => set('transit_started_at', event.target.value)}/></label><label>Плановая дата склада<input type="date" value={form.expected_warehouse_at || ''} onChange={event => set('expected_warehouse_at', event.target.value)}/></label></>}
      {form.shipment_status === 'arrived' && <label className="full">Фактическая дата поступления на склад *<input required type="date" value={form.warehouse_arrived_at || ''} onChange={event => set('warehouse_arrived_at', event.target.value)}/></label>}
    </div>
    {error && <div className="form-error"><CircleAlert size={17}/><div><b>Логистика не обновлена</b><span>{error}</span></div></div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Отмена</button><button className="primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить логистику'}</button></div>
  </form></div></div>
}

function RequestModal({ value, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY, ...(value || {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, nextValue) => setForm(current => ({ ...current, [key]: nextValue }))
  const toggleWorkflowStep = (key, done) => setForm(current => {
    const workflowSteps = { ...(current.workflow_steps || {}) }
    if (done) workflowSteps[key] = { done: true, completed_at: localDateValue() }
    else delete workflowSteps[key]
    return { ...current, workflow_steps: workflowSteps }
  })
  const setWorkflowDate = (key, completedAt) => setForm(current => ({
    ...current,
    workflow_steps: { ...(current.workflow_steps || {}), [key]: { done: completedAt ? true : workflowStepState(current, key).done, completed_at: completedAt } }
  }))
  const checks = [
    ['offer_received', 'Предложение получено', 'offer_received_at'],
    ['included_calculation', 'Внесено в расчёт', null],
    ['proposed_to_nikolai', 'Предложено Николаю', 'proposed_to_nikolai_at'],
    ['pi_sent', 'PI отправлена', 'pi_sent_at'],
    ['pi_revision', 'PI отправлена на доработку', 'pi_revision_at'],
    ['pi_signed', 'PI подписана', 'pi_signed_at']
  ]

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message)
      setBusy(false)
    }
  }

  return <div className="modal-backdrop"><div className="modal request-editor"><div className="modal-head"><div><div className="eyebrow"><Package size={14}/> КАРТОЧКА ЗАКУПКИ</div><h2>{value?.id ? 'Редактировать запрос' : 'Новый запрос'}</h2><p>{value?.id ? `${form.request_number} · ${form.product_name}` : 'Добавьте основную информацию и отметьте текущий этап.'}</p></div><button aria-label="Закрыть" onClick={onClose}><X/></button></div><form onSubmit={submit}>
    <div className="request-editor-journey"><div><small>ТЕКУЩИЙ ПРОГРЕСС</small><b>{statusMeta[calcStatus(form)]?.[0]}</b></div><RequestJourney row={form} compact/></div>
    <div className="form-grid"><label>Номер запроса *<input required value={form.request_number} onChange={event => set('request_number', event.target.value)} placeholder="REQ-2026-001"/></label><label>Дата отправки *<input type="date" required value={form.request_sent_at || ''} onChange={event => set('request_sent_at', event.target.value)}/></label><label>Категория товара *<input required value={form.category} onChange={event => set('category', event.target.value)} placeholder="Например, Освещение"/></label><label>Китайский агент *<select required value={form.agent_name} onChange={event => set('agent_name', event.target.value)}><option value="" disabled>Выберите агента</option>{form.agent_name && !AGENT_OPTIONS.includes(form.agent_name) && <option value={form.agent_name}>{form.agent_name} · сохранённый</option>}{AGENT_OPTIONS.map(agent => <option key={agent} value={agent}>{agent}</option>)}</select></label><label className="full">Название товара *<input required value={form.product_name} onChange={event => set('product_name', event.target.value)} placeholder="Введите название товара"/></label><label className="full">Артикулы<input value={form.article_numbers || ''} onChange={event => set('article_numbers', event.target.value)} placeholder="Например, AB-1024, AB-1025"/></label></div>
    <div className="stage-title"><span>ЭТАПЫ ОБРАБОТКИ</span><small>REQUEST → OFFER → CALC → NIKOLAI → PI → SIGN</small></div><div className="stage-list">{checks.map(([key, label, dateKey], index) => <div className={`stage-row ${form[key] ? 'done' : ''}`} key={key}><button type="button" className="check" onClick={() => set(key, !form[key])}>{form[key] && <Check size={15}/>}</button><span className="stage-number">0{index + 1}</span><b>{label}</b>{dateKey && form[key] && <input type="date" value={form[dateKey] || ''} onChange={event => set(dateKey, event.target.value)}/>}</div>)}</div>
    <div className={`deal-outcome ${(form.price_not_viable || form.not_approved) ? 'unsuccessful' : ''}`}><div><small>РЕЗУЛЬТАТ СДЕЛКИ</small><b>{(form.price_not_viable || form.not_approved) ? 'Сделка не успешна' : 'Сделка в работе'}</b></div><label><input type="checkbox" checked={Boolean(form.price_not_viable)} onChange={event => set('price_not_viable', event.target.checked)}/><span>Цена не проходит по нашим методам</span></label><label><input type="checkbox" checked={Boolean(form.not_approved)} onChange={event => set('not_approved', event.target.checked)}/><span>Предложение не согласовано</span></label></div>
    <WorkflowChecklist row={form} editable onToggle={toggleWorkflowStep} onDateChange={setWorkflowDate}/>
    <div className="stage-title"><span>ЛОГИСТИКА</span><small>CHINA → TRANSIT → WAREHOUSE</small></div>
    <div className="form-grid logistics-form-grid">
      <label>Статус перевозки<select value={form.shipment_status || 'not_shipped'} onChange={event => set('shipment_status', event.target.value)}><option value="not_shipped">Ожидает отправки</option><option value="in_transit">В пути</option><option value="arrived">На складе</option></select></label>
      <label>Логистическая компания<input value={form.logistics_company || ''} onChange={event => set('logistics_company', event.target.value)} placeholder="Название перевозчика"/></label>
      {form.shipment_status !== 'not_shipped' && <><label>Дата отправки в путь<input type="date" value={form.transit_started_at || ''} onChange={event => set('transit_started_at', event.target.value)}/></label><label>Плановая дата склада<input type="date" value={form.expected_warehouse_at || ''} onChange={event => set('expected_warehouse_at', event.target.value)}/></label></>}
      {form.shipment_status === 'arrived' && <label className="full">Фактическая дата поступления на склад *<input required type="date" value={form.warehouse_arrived_at || ''} onChange={event => set('warehouse_arrived_at', event.target.value)}/></label>}
    </div>
    <label>Комментарий<textarea rows="3" value={form.notes || ''} onChange={event => set('notes', event.target.value)} placeholder="Условия, замечания, следующий шаг…"/></label>
    {error && <div className="form-error"><CircleAlert size={17}/><div><b>Запрос не сохранён</b><span>{error}</span></div></div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>ОТМЕНА</button><button className="primary" disabled={busy}>{busy ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ →'}</button></div>
  </form></div></div>
}

function UsersPage({ profile, setOpen }) {
  const [usersList, setUsersList] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data, error: loadError } = await supabase.from('allowed_users').select('*').order('created_at')
    if (loadError) setError(friendlyError(loadError))
    else setUsersList(data || [])
  }

  useEffect(() => { load() }, [])

  async function invite(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: inviteError } = await supabase.from('allowed_users').upsert({ email: email.toLowerCase().trim(), role, invited_by: profile.id }, { onConflict: 'email' })
    if (inviteError) setError(friendlyError(inviteError))
    else { setEmail(''); await load() }
    setBusy(false)
  }

  async function changeRole(user, nextRole) {
    setError('')
    const { error: updateError } = await supabase.from('allowed_users').update({ role: nextRole }).eq('id', user.id)
    if (updateError) setError(friendlyError(updateError))
    else await load()
  }

  async function remove(id) {
    if (!confirm('Отозвать доступ для этого email?')) return
    const { error: deleteError } = await supabase.from('allowed_users').delete().eq('id', id)
    if (deleteError) setError(friendlyError(deleteError))
    else await load()
  }

  return <>
    <Header title="Доступ и роли" subtitle="Все права меняются администратором прямо на сайте." setOpen={setOpen} code="access-control"/>
    <div className="users-layout"><section className="panel invite-card"><div className="panel-head"><div><span className="panel-tag">INVITE USER</span><h2>Добавить пользователя</h2><p>Новые пользователи получают только просмотр по умолчанию.</p></div><UserPlus size={20}/></div><form onSubmit={invite}><label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="employee@company.com"/></label><label>Роль<select value={role} onChange={event => setRole(event.target.value)}><option value="viewer">Только просмотр</option><option value="admin">Администратор</option></select></label>{error && <div className="auth-message"><CircleAlert size={16}/>{error}</div>}<button className="primary wide" disabled={busy}><Mail size={17}/> ДОБАВИТЬ ДОСТУП →</button></form></section>
    <section className="panel"><div className="panel-head"><div><span className="panel-tag">ACCESS LIST</span><h2>Разрешённые email</h2><p>{usersList.length} пользователей и приглашений</p></div><ShieldCheck size={20}/></div><div className="user-list">{usersList.map(user => <div className="user-row" key={user.id}><div className="avatar">{user.email[0].toUpperCase()}</div><div><b>{user.email}</b><small>Добавлен {formatDate(user.created_at?.slice(0, 10))}</small></div>{user.email === profile.email ? <span className="role admin">Текущий администратор</span> : <select className="role-select" value={user.role === 'admin' ? 'admin' : 'viewer'} onChange={event => changeRole(user, event.target.value)}><option value="viewer">Только просмотр</option><option value="admin">Администратор</option></select>}{user.email !== profile.email && <button onClick={() => remove(user.id)}><Trash2 size={16}/></button>}</div>)}</div></section></div>
  </>
}

function AuditPage({ setOpen }) {
  const [logs, setLogs] = useState([])
  useEffect(() => { supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setLogs(data || [])) }, [])
  const action = { INSERT: 'создал(а)', UPDATE: 'изменил(а)', DELETE: 'удалил(а)' }
  return <><Header title="Журнал действий" subtitle="Контроль всех изменений в товарных запросах." setOpen={setOpen} code="audit-log"/><section className="panel"><div className="timeline">{logs.length ? logs.map(log => <div className="timeline-row" key={log.id}><div className={`timeline-icon ${log.action.toLowerCase()}`}>{log.action === 'INSERT' ? <Plus/> : log.action === 'DELETE' ? <Trash2/> : <Pencil/>}</div><div><b>{log.actor_email || 'Система'} {action[log.action]} запрос</b><span>{log.request_number || 'Без номера'} · {formatDateTime(log.created_at)}</span></div></div>) : <div className="empty"><Archive/><b>Журнал пока пуст</b></div>}</div></section></>
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [page, setPage] = useState('dashboard')
  const [modal, setModal] = useState(null)
  const [logisticsModal, setLogisticsModal] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setRows([]); return undefined }
    loadProfile()
    loadRows()
    const channel = supabase.channel('requests-live').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, loadRows).subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  async function loadProfile() {
    const { data, error } = await queryWithSessionRecovery(() => supabase.from('profiles').select('*').eq('id', session.user.id).single())
    if (error) setDataError(friendlyError(error))
    else setProfile(data)
  }

  async function loadRows() {
    const { data, error } = await queryWithSessionRecovery(() => supabase.from('requests').select('*').order('updated_at', { ascending: false }))
    if (error) setDataError(friendlyError(error))
    else { setRows(data || []); setDataError('') }
  }

  async function save(form) {
    if (profile.role !== 'admin') throw new Error('Изменения может вносить только администратор.')
    const payload = cleanRequest(form, session.user.id)
    const result = form.id
      ? await supabase.from('requests').update(payload).eq('id', form.id).select('id').single()
      : await supabase.from('requests').insert({ ...payload, created_by: session.user.id }).select('id').single()
    if (result.error) throw new Error(friendlyError(result.error))
    setModal(null)
    setLogisticsModal(null)
    await loadRows()
  }

  async function saveInline(form) {
    if (profile.role !== 'admin') throw new Error('Изменения может вносить только администратор.')
    const payload = cleanRequest(form, session.user.id)
    const { error } = await supabase.from('requests').update(payload).eq('id', form.id)
    if (error) throw new Error(friendlyError(error))
    await loadRows()
  }

  async function remove(row) {
    if (profile.role !== 'admin') return
    if (!confirm(`Удалить запрос ${row.request_number}?`)) return
    const { error } = await supabase.from('requests').delete().eq('id', row.id)
    if (error) alert(friendlyError(error))
    else await loadRows()
  }

  if (loading) return <div className="splash"><div className="logo">VL</div><span>LOADING PROCUREMENT DATA_</span></div>
  if (!session) return <Login/>
  if (!profile) return <div className="access-denied"><ShieldCheck size={40}/><h2>Проверяем доступ</h2><p>{dataError || 'Если экран не меняется, ваш email ещё не добавлен администратором.'}</p><button className="secondary" onClick={() => supabase.auth.signOut()}>ВЫЙТИ</button></div>

  const canEdit = profile.role === 'admin'
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} profile={profile} open={sideOpen} setOpen={setSideOpen}/><main className="content">{dataError && <div className="form-error global-error"><CircleAlert size={17}/><div><b>Ошибка загрузки данных</b><span>{dataError}</span></div></div>}<PiDeadlineAlerts rows={rows} onOpenRequests={() => setPage('requests')}/>{page === 'dashboard' && <Dashboard rows={rows} onAdd={() => setModal({ ...EMPTY })} onOpenLogistics={() => setPage('logistics')} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'analytics' && <Analytics rows={rows} setOpen={setSideOpen}/>} {page === 'logistics' && <Logistics rows={rows} onEdit={setLogisticsModal} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'requests' && <Requests rows={rows} onAdd={() => setModal({ ...EMPTY })} onEdit={setModal} onDelete={remove} onSaveInline={saveInline} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'users' && canEdit && <UsersPage profile={profile} setOpen={setSideOpen}/>} {page === 'audit' && <AuditPage setOpen={setSideOpen}/>}</main>{modal && canEdit && <RequestModal value={modal} onClose={() => setModal(null)} onSave={save}/>} {logisticsModal && canEdit && <LogisticsModal value={logisticsModal} onClose={() => setLogisticsModal(null)} onSave={save}/>}</div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
