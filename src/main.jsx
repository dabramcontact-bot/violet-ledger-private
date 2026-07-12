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
  offer_received: false, offer_received_at: '', included_calculation: false,
  pi_sent: false, pi_sent_at: '', pi_revision: false, pi_revision_at: '',
  pi_signed: false, pi_signed_at: '', notes: '',
  shipment_status: 'not_shipped', logistics_company: '', transit_started_at: '',
  expected_warehouse_at: '', warehouse_arrived_at: ''
}

const DATE_FIELDS = [
  'request_sent_at', 'offer_received_at', 'pi_sent_at', 'pi_revision_at', 'pi_signed_at',
  'transit_started_at', 'expected_warehouse_at', 'warehouse_arrived_at'
]
const roleLabel = { admin: 'Администратор', editor: 'Просмотр', viewer: 'Просмотр' }
const statusMeta = {
  request: ['Запрос отправлен', '01'],
  offer: ['Предложение получено', '02'],
  calculation: ['В расчёте', '03'],
  pi_sent: ['PI отправлена', '04'],
  revision: ['PI на доработке', '05'],
  signed: ['PI подписана', '06']
}

const shipmentMeta = {
  not_shipped: ['Ожидает отправки', 'waiting'],
  in_transit: ['В пути', 'transit'],
  arrived: ['На складе', 'arrived']
}

function calcStatus(row) {
  if (row.pi_signed) return 'signed'
  if (row.pi_revision) return 'revision'
  if (row.pi_sent) return 'pi_sent'
  if (row.included_calculation) return 'calculation'
  if (row.offer_received) return 'offer'
  return 'request'
}

function cleanRequest(form, userId) {
  const payload = { ...form, updated_by: userId }
  ;['request_number', 'category', 'product_name', 'agent_name', 'notes', 'logistics_company'].forEach(key => {
    payload[key] = String(payload[key] || '').trim()
  })
  DATE_FIELDS.forEach(key => { payload[key] = payload[key] || null })
  if (!payload.offer_received) payload.offer_received_at = null
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
    <div className="arrow-field" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i}>{'>' .repeat(10 + i)}</span>)}</div>
    <div className="login-brand"><div className="logo">VL</div><div><b>VIOLET LEDGER</b><small>CHINA PROCUREMENT OS</small></div></div>
    <main className="login-card terminal-card">
      <div className="terminal-line">~/procurement/auth <span>_</span></div>
      <div className="eyebrow"><ShieldCheck size={15}/> ЗАЩИЩЁННОЕ ПРОСТРАНСТВО</div>
      <h1>{mode === 'login' ? 'Вход в систему' : 'Новый аккаунт'}</h1>
      <p>{mode === 'login' ? 'Контроль товаров, агентов, логистики и PI.' : 'Регистрация доступна только для приглашённых пользователей.'}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com"/></label>
        <label>Пароль<input type="password" required minLength="8" value={password} onChange={event => setPassword(event.target.value)} placeholder="Не менее 8 символов"/></label>
        {message && <div className="auth-message"><CircleAlert size={16}/>{message}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'ПОДОЖДИТЕ…' : mode === 'login' ? 'ВОЙТИ →' : 'СОЗДАТЬ АККАУНТ →'}</button>
      </form>
      <button className="link-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
        {mode === 'login' ? 'Получили приглашение? Создать аккаунт →' : 'Уже есть аккаунт? Войти →'}
      </button>
    </main>
    <div className="login-route"><Factory/><span>中国</span><i/><Ship/><i/><Warehouse/><span>СКЛАД</span></div>
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
  return <header><button className="menu" onClick={() => setOpen(true)}><Menu/></button><div><div className="page-code">~/{code.toLowerCase()}</div><h1>{title}</h1><p>{subtitle}</p></div>{onAdd && canEdit && <button className="primary" onClick={onAdd}><Plus size={17}/> НОВЫЙ ЗАПРОС →</button>}</header>
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
  const signed = rows.filter(row => row.pi_signed).length
  const categories = new Set(rows.map(row => row.category).filter(Boolean)).size

  return <section className="animated-hero" data-scene="hero">
    <div className="hero-copy">
      <div className="hero-eyebrow"><Route/> Китай → агент → склад</div>
      <h1 aria-label="Весь путь товара. В одной системе.">
        <span className="hero-title-line">Весь путь товара.</span>
        <span className="hero-title-line hero-title-line-two">В одной <i className="hero-inline-mark"><Package/></i> системе.</span>
      </h1>
      <p>Запросы, предложения, PI и логистика собраны в одном спокойном рабочем пространстве.</p>
      <div className="hero-actions">{canEdit ? <button className="primary" onClick={onAdd}>Новый запрос <ArrowRight size={16}/></button> : <button className="primary" onClick={onOpenLogistics}>Смотреть логистику <ArrowRight size={16}/></button>}</div>
      <div className="hero-scroll-cue"><i/> Листайте, чтобы увидеть путь</div>
    </div>
    <div className="hero-showcase" aria-hidden="true">
      <div className="showcase-layer layer-three"/>
      <div className="showcase-layer layer-two"/>
      <div className="showcase-card">
        <div className="showcase-topline"><span>VIOLET FLOW</span><b>01</b></div>
        <span>Закупка движется.<br/>Вы видите каждый этап.</span>
        <div className="showcase-orbit"><Factory/><i/><Ship/><i/><Warehouse/></div>
        <div className="showcase-balance"><Package/><div><small>В системе</small><strong>{rows.length} запросов</strong></div></div>
        <div className="showcase-foot"><b>{categories}</b><span>категорий</span><b>{signed}</b><span>PI подписано</span></div>
        <div className="showcase-pulse pulse-one"/><div className="showcase-pulse pulse-two"/>
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

    if (reducedMotion) {
      story.classList.add('story-ready', 'reduce-motion')
      revealItems.forEach(item => item.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -9% 0px' })

    revealItems.forEach(item => observer.observe(item))
    requestAnimationFrame(() => story.classList.add('story-ready'))

    const revealFallback = window.setTimeout(() => {
      revealItems.forEach(item => {
        if (item.getBoundingClientRect().top < window.innerHeight * 1.15) item.classList.add('is-visible')
      })
    }, 1400)

    let frame = 0
    const updateParallax = () => {
      frame = 0
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      const distance = Math.max(hero.offsetHeight - window.innerHeight * 0.32, 1)
      const progress = Math.min(1, Math.max(0, -rect.top / distance))
      story.style.setProperty('--hero-shift', `${Math.round(progress * -82)}px`)
      story.style.setProperty('--layer-two-shift', `${Math.round(progress * -30)}px`)
      story.style.setProperty('--layer-three-shift', `${Math.round(progress * -16)}px`)
      story.style.setProperty('--hero-copy-shift', `${Math.round(progress * -26)}px`)
      story.style.setProperty('--hero-copy-opacity', String(1 - Math.min(progress * .48, .42)))

      story.querySelectorAll('[data-scene]').forEach(scene => {
        const sceneRect = scene.getBoundingClientRect()
        const sceneProgress = Math.min(1, Math.max(0, (window.innerHeight - sceneRect.top) / (window.innerHeight + sceneRect.height)))
        scene.style.setProperty('--scene-progress', sceneProgress.toFixed(3))
      })
    }
    const requestParallax = () => {
      if (frame) return
      frame = requestAnimationFrame(updateParallax)
    }

    updateParallax()
    window.addEventListener('scroll', requestParallax, { passive: true })
    window.addEventListener('resize', requestParallax)

    return () => {
      observer.disconnect()
      window.clearTimeout(revealFallback)
      window.removeEventListener('scroll', requestParallax)
      window.removeEventListener('resize', requestParallax)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return storyRef
}

function Dashboard({ rows, onAdd, onOpenLogistics, canEdit }) {
  const counts = useMemo(() => rows.reduce((acc, row) => { acc[calcStatus(row)] += 1; return acc }, { request: 0, offer: 0, calculation: 0, pi_sent: 0, revision: 0, signed: 0 }), [rows])
  const inTransit = rows.filter(row => row.shipment_status === 'in_transit').length
  const arrived = rows.filter(row => row.shipment_status === 'arrived').length
  const supplierCount = new Set(rows.map(row => row.agent_name).filter(Boolean)).size
  const storyRef = usePhantomMotion()

  return <div className="phantom-story" ref={storyRef}>
    <AnimatedHero rows={rows} onAdd={onAdd} onOpenLogistics={onOpenLogistics} canEdit={canEdit}/>
    {!canEdit && <div className="read-only-banner"><ShieldCheck size={16}/><span>РЕЖИМ ПРОСМОТРА</span> Изменения доступны только администратору.</div>}

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
          <div className="story-floating-pill"><ClipboardList/><small>Активные запросы</small><strong>{rows.length - counts.signed}</strong></div>
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

function RequestTable({ rows, onEdit, onDelete, canEdit, compact = false }) {
  if (!rows.length) return <div className="empty"><PackageOpen size={34}/><b>Запросов пока нет</b><span>Администратор может добавить первую товарную позицию.</span></div>
  return <div className="table-wrap"><table><thead><tr><th>ID запроса</th><th>Товар / категория</th><th>Китайский агент</th><th>Отправлен</th><th>Логистика</th><th>Текущий этап</th>{!compact && <th>Действия</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>
    <td><b className="request-no">{row.request_number}</b></td>
    <td><b>{row.product_name}</b><small>{row.category}</small></td>
    <td><span className="supplier-cell"><Factory size={14}/>{row.agent_name}</span></td>
    <td>{formatDate(row.request_sent_at)}</td>
    <td><ShipmentPill status={row.shipment_status}/>{row.logistics_company && <small>{row.logistics_company}</small>}</td>
    <td><StatusPill status={calcStatus(row)}/></td>
    {!compact && <td><div className="row-actions">{canEdit ? <><button title="Редактировать" onClick={() => onEdit(row)}><Pencil size={15}/></button><button title="Удалить" className="danger" onClick={() => onDelete(row)}><Trash2 size={15}/></button></> : <span className="locked-action"><ShieldCheck size={14}/> read_only</span>}</div></td>}
  </tr>)}</tbody></table></div>
}

function Requests({ rows, onAdd, onEdit, onDelete, canEdit, setOpen }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = rows.filter(row => (status === 'all' || calcStatus(row) === status) && [row.request_number, row.product_name, row.category, row.agent_name].join(' ').toLowerCase().includes(query.toLowerCase()))
  return <>
    <Header title="Реестр товарных запросов" subtitle={`${rows.length} позиций в защищённой общей базе`} onAdd={onAdd} canEdit={canEdit} setOpen={setOpen} code="requests"/>
    {!canEdit && <div className="read-only-banner"><ShieldCheck size={16}/><span>READ_ONLY</span> Добавление, редактирование и удаление доступны только администратору.</div>}
    <section className="panel registry"><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Поиск по номеру, товару, категории или агенту" value={query} onChange={event => setQuery(event.target.value)}/></div><div className="filter"><Filter size={16}/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все этапы</option>{Object.entries(statusMeta).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></div></div><RequestTable rows={filtered} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit}/></section>
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
  const [form, setForm] = useState(value || EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, nextValue) => setForm(current => ({ ...current, [key]: nextValue }))
  const checks = [
    ['offer_received', 'Предложение получено', 'offer_received_at'],
    ['included_calculation', 'Внесено в расчёт', null],
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

  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><div className="terminal-line">~/requests/edit <span>_</span></div><div className="eyebrow">КАРТОЧКА ЗАПРОСА</div><h2>{value?.id ? 'Редактировать запрос' : 'Новый запрос'}</h2></div><button onClick={onClose}><X/></button></div><form onSubmit={submit}>
    <div className="form-grid"><label>Номер запроса *<input required value={form.request_number} onChange={event => set('request_number', event.target.value)} placeholder="REQ-2026-001"/></label><label>Дата отправки *<input type="date" required value={form.request_sent_at || ''} onChange={event => set('request_sent_at', event.target.value)}/></label><label>Категория товара *<input required value={form.category} onChange={event => set('category', event.target.value)} placeholder="Например, Освещение"/></label><label>Китайский агент *<input required value={form.agent_name} onChange={event => set('agent_name', event.target.value)} placeholder="Имя или компания"/></label><label className="full">Название товара *<input required value={form.product_name} onChange={event => set('product_name', event.target.value)} placeholder="Введите название товара"/></label></div>
    <div className="stage-title"><span>ЭТАПЫ ОБРАБОТКИ</span><small>REQUEST → OFFER → CALC → PI → SIGN</small></div><div className="stage-list">{checks.map(([key, label, dateKey], index) => <div className={`stage-row ${form[key] ? 'done' : ''}`} key={key}><button type="button" className="check" onClick={() => set(key, !form[key])}>{form[key] && <Check size={15}/>}</button><span className="stage-number">0{index + 1}</span><b>{label}</b>{dateKey && form[key] && <input type="date" value={form[dateKey] || ''} onChange={event => set(dateKey, event.target.value)}/>}</div>)}</div>
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
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} profile={profile} open={sideOpen} setOpen={setSideOpen}/><main className="content">{dataError && <div className="form-error global-error"><CircleAlert size={17}/><div><b>Ошибка загрузки данных</b><span>{dataError}</span></div></div>}{page === 'dashboard' && <Dashboard rows={rows} onAdd={() => setModal({ ...EMPTY })} onOpenLogistics={() => setPage('logistics')} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'analytics' && <Analytics rows={rows} setOpen={setSideOpen}/>} {page === 'logistics' && <Logistics rows={rows} onEdit={setLogisticsModal} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'requests' && <Requests rows={rows} onAdd={() => setModal({ ...EMPTY })} onEdit={setModal} onDelete={remove} canEdit={canEdit} setOpen={setSideOpen}/>} {page === 'users' && canEdit && <UsersPage profile={profile} setOpen={setSideOpen}/>} {page === 'audit' && <AuditPage setOpen={setSideOpen}/>}</main>{modal && canEdit && <RequestModal value={modal} onClose={() => setModal(null)} onSave={save}/>} {logisticsModal && canEdit && <LogisticsModal value={logisticsModal} onClose={() => setLogisticsModal(null)} onSave={save}/>}</div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
