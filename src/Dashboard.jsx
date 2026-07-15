import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Clock3,
  Factory, FileCheck2, MapPin, Package, Plus, RefreshCw, Route, ShieldCheck,
  Truck, WalletCards, Warehouse
} from 'lucide-react'
import { formatDate, formatDateTime, loadRows, today } from './data'
import { ErrorBanner } from './components'
import './dashboard-workflow-premium.css'
import './dashboard-premium-original.css'
import './cinematic-ribbons.css'
import './hero-depth.css'
import './hero-ribbons.js'
import './hero-depth.js'

const processStages = [
  { key: 'requests', number: '01', title: 'Запрос', icon: ClipboardList, color: '#7398f1', text: 'Фиксируем товар, артикул, поставщика и коммерческие условия. Полученное предложение остаётся в понятном трёхэтапном цикле.' },
  { key: 'pi', number: '02', title: 'PI', icon: FileCheck2, color: '#9f8ae8', text: 'Сверяем характеристики, подписываем PI и отдельно контролируем два письма в ВЭД.' },
  { key: 'logistics', number: '03', title: 'Логистика', icon: Truck, color: '#ee93aa', text: 'Видим готовность, дату выезда, прибытие, перевозчика и стоимость логистики на единицу.' },
  { key: 'payments', number: '04', title: 'Платёж', icon: WalletCards, color: '#e9b868', text: 'Плановые и фактические оплаты связаны с PI, но не меняют статус исходного запроса.' }
]

export default function Dashboard({ onNavigate, onCreate }) {
  const [data, setData] = useState({ requests: [], pis: [], logistics: [], payments: [], activity: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const [requests, pis, logistics, payments, activity] = await Promise.all([
          loadRows('requests'), loadRows('pi_records'), loadRows('manual_logistics'), loadRows('payments'), loadRows('activity_log', 'created_at')
        ])
        setData({ requests, pis, logistics, payments, activity: activity.slice(0, 10) })
      } catch (reason) { setError(reason) } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setActiveStage(value => (value + 1) % processStages.length), 4200)
    return () => window.clearInterval(timer)
  }, [])

  const counts = useMemo(() => ({
    requestsTotal: data.requests.length,
    requestsActive: data.requests.filter(row => row.status !== 'calculation').length,
    offers: data.requests.filter(row => row.status === 'offer').length,
    calculated: data.requests.filter(row => row.status === 'calculation').length,
    piTotal: data.pis.length,
    piReview: data.pis.filter(row => ['requested', 'verification'].includes(row.status)).length,
    piSigned: data.pis.filter(row => row.status === 'signed').length,
    piVed: data.pis.filter(row => row.status === 'ved').length,
    transit: data.logistics.filter(row => row.status === 'transit').length,
    arrived: data.logistics.filter(row => row.status === 'arrived').length,
    paymentDue: data.payments.filter(row => row.status === 'planned').length,
    paymentOverdue: data.payments.filter(row => row.status === 'overdue' || (row.due_date && row.due_date < today() && row.status !== 'paid')).length
  }), [data])
  const piProgress = counts.piTotal ? Math.round((counts.piSigned + counts.piVed) / counts.piTotal * 100) : 0
  const supplierCount = new Set([...data.requests.map(row => row.agent_name), ...data.pis.map(row => row.supplier)].filter(Boolean)).size

  const overview = [
    ['requests', 'request', 'Запросы без ответа', data.requests.filter(row => row.status === 'request').length, 'Ждут предложения'],
    ['requests', 'offer', 'Предложения получены', counts.offers, 'Готовы к расчёту'],
    ['requests', 'calculation', 'Внесено в расчёт', counts.calculated, 'Этап завершён'],
    ['pi', 'verification', 'PI на сверке', counts.piReview, 'Характеристики'],
    ['pi', 'confirmed', 'PI к подписанию', data.pis.filter(row => row.status === 'confirmed').length, 'Готовы к подписи'],
    ['pi', 'ved', 'Передано в ВЭД', counts.piVed, 'Контроль двух писем'],
    ['logistics', 'transit', 'Грузы в пути', counts.transit, 'Активные перевозки'],
    ['logistics', 'waiting', 'Ждут отправки', data.logistics.filter(row => ['waiting', 'ready'].includes(row.status)).length, 'Нужна дата выезда'],
    ['payments', 'planned', 'Платежи к оплате', counts.paymentDue, 'Плановые оплаты'],
    ['payments', 'overdue', 'Просрочено', counts.paymentOverdue, 'Требует внимания']
  ]

  const attention = useMemo(() => {
    const items = []
    data.requests.filter(row => row.status === 'request' && row.request_sent_at && (Date.now() - new Date(`${row.request_sent_at}T00:00:00`)) / 86400000 > 3).forEach(row => items.push({ type:'requests', id:row.id, title:`${row.request_number} без ответа`, text:row.product_name, tone:'warning' }))
    data.pis.filter(row => ['requested','verification'].includes(row.status) && !row.confirmed_at).forEach(row => items.push({ type:'pi', id:row.id, title:`PI ${row.pi_number}: нет подтверждения`, text:row.product_name, tone:'warning' }))
    data.pis.filter(row => row.status === 'ved' && (!row.tnved_email_sent || !row.nomenclature_email_sent)).forEach(row => items.push({ type:'pi', id:row.id, title:`PI ${row.pi_number}: не все письма ВЭД`, text:'Проверьте обе контрольные отметки', tone:'danger' }))
    data.logistics.filter(row => ['waiting','ready'].includes(row.status) && !row.departure_date).forEach(row => items.push({ type:'logistics', id:row.id, title:`PI ${row.pi_number}: нет даты выезда`, text:row.logistics_company || 'Перевозчик не указан', tone:'warning' }))
    data.logistics.filter(row => row.warehouse_date && row.warehouse_date < today() && row.status !== 'arrived').forEach(row => items.push({ type:'logistics', id:row.id, title:`PI ${row.pi_number}: прибытие просрочено`, text:`План: ${formatDate(row.warehouse_date)}`, tone:'danger' }))
    data.payments.filter(row => row.status === 'overdue' || (row.due_date && row.due_date < today() && row.status !== 'paid')).forEach(row => items.push({ type:'payments', id:row.id, title:`${row.payment_number || row.pi_number}: платёж просрочен`, text:`Срок: ${formatDate(row.due_date)}`, tone:'danger' }))
    return items.slice(0, 8)
  }, [data])

  const activityLabel = { requests:'Запрос', pi_records:'PI', manual_logistics:'Логистика', payments:'Платёж' }
  const actionLabel = { INSERT:'Создано', UPDATE:'Обновлено', DELETE:'Удалено' }
  const currentStage = processStages[activeStage]
  const CurrentIcon = currentStage.icon

  return <div className="premium-home dashboard-page phantom-story">
    <ErrorBanner error={error}/>

    <section className="vl-home-hero animated-hero brand-hero" data-scene="hero">
      <div className="hero-ambient ambient-one" aria-hidden="true"/><div className="hero-ambient ambient-two" aria-hidden="true"/>
      <div className="vl-hero-copy hero-copy">
        <div className="vl-hero-badge hero-eyebrow"><Route/> CHINA → PI → WAREHOUSE</div>
        <h1><span className="hero-title-line">От запроса до склада.</span><span className="hero-title-line hero-title-line-two">Всё под контролем.</span></h1>
        <p>Каждый этап сделки понятен команде: предложение поставщика, PI, перевозка и оплата собраны в одной спокойной системе.</p>
        <div className="vl-hero-actions hero-actions"><button className="primary" onClick={() => onCreate('requests')}><Plus/> Создать запрос</button></div>
        <div className="vl-scroll-cue hero-scroll-cue"><span>Прокрутите, чтобы увидеть маршрут</span><i/></div>
      </div>
      <div className="hero-showcase" aria-hidden="true">
        <div className="showcase-layer layer-three"/><div className="showcase-layer layer-two"/>
        <article className="showcase-card"/>
      </div>
    </section>

    <section className="vl-manifesto">
      <small>VIOLET LEDGER · ONE CLEAR SYSTEM</small>
      <h2>Управление закупками<br/>для <span><Route/></span> всей команды</h2>
      <button onClick={() => onNavigate('requests')}>Открыть рабочие разделы <ArrowRight/></button>
    </section>

    <section className="vl-journey-section">
      <div className="vl-journey-copy">
        <div className="vl-section-label"><Route/> ЖИВОЙ МАРШРУТ</div>
        <h2>Одна система.<br/>Весь путь закупки.</h2>
        <p>Контекст не теряется между разделами. Запрос связывается с PI, PI — с перевозками и платежами, а главная показывает, где требуется действие.</p>
        <div className="vl-stage-list">{processStages.map((stage,index) => { const Icon = stage.icon; return <button key={stage.key} className={activeStage === index ? 'active' : ''} style={{'--stage-color':stage.color}} onClick={() => setActiveStage(index)}><span><Icon/></span><b>{stage.number} · {stage.title}</b><small>{stage.text}</small></button> })}</div>
      </div>
      <div className="vl-journey-visual" style={{'--stage-color':currentStage.color}}>
        <div className="vl-journey-layer layer-a"/><div className="vl-journey-layer layer-b"/>
        <article className="vl-stage-card">
          <header><div><small>ТЕКУЩИЙ ЭТАП</small><b>{currentStage.number} / 04</b></div><span><CurrentIcon/></span></header>
          <div className="vl-stage-card-main"><div className="vl-stage-mark"><CurrentIcon/></div><small>VIOLET LEDGER WORKFLOW</small><h3>{currentStage.title}</h3><p>{currentStage.text}</p></div>
          <div className="vl-stage-progress"><i><u style={{width:`${(activeStage + 1) * 25}%`}}/></i><span>{(activeStage + 1) * 25}% маршрута</span></div>
          <footer>{processStages.map((stage,index) => <span key={stage.key} className={index <= activeStage ? 'done' : ''}>{index < activeStage ? <CheckCircle2/> : stage.number}</span>)}</footer>
        </article>
        <div className="vl-floating-metric metric-top"><small>ПОЗИЦИЙ ПОД КОНТРОЛЕМ</small><b>{counts.requestsTotal}</b></div>
        <div className="vl-floating-metric metric-bottom"><small>ПОСТАВЩИКОВ</small><b>{supplierCount}</b></div>
      </div>
    </section>

    <section className="story-section story-products workflow-premium-source">
      <div className="premium-workflow-showcase-inner">
        <div className="premium-workflow-heading"><div className="premium-workflow-badge"><Route/><span>Три ключевых процесса</span></div><h2>Запрос. PI. Доставка.</h2><p>Те самые цветные карточки: наглядный путь каждой закупки — от первого запроса до поступления товара на склад.</p></div>
        <div className="premium-workflow-grid">
          <article className="premium-flow-card premium-flow-requests">
            <button className="premium-card-action" onClick={() => onNavigate('requests')} aria-label="Открыть реестр запросов"><ArrowRight/></button><h3>Все запросы<br/>в одном месте.</h3><p>Централизованный контроль каждой позиции: активная работа, полученные предложения и общий объём закупок.</p>
            <div className="premium-request-document" aria-hidden="true"><i/><i/><i/><i/><span><Package/></span></div>
            <div className="premium-request-summary"><div className="premium-summary-main"><span className="premium-summary-icon"><ClipboardList/></span><span className="premium-summary-copy"><small>ОБЩАЯ МАТРИЦА</small><b>Активные запросы</b></span><strong>{counts.requestsActive}</strong></div><div className="premium-summary-stats"><span><small>Всего</small><b>{counts.requestsTotal}</b></span><span><small>Предложения</small><b>{counts.offers}</b></span><span><small>В расчёте</small><b>{counts.calculated}</b></span></div></div>
          </article>
          <article className="premium-flow-card premium-flow-pi">
            <button className="premium-card-action" onClick={() => onNavigate('pi')} aria-label="Открыть PI"><ArrowRight/></button><h3>PI движется быстро.<br/>Каждый шаг виден.</h3><p>Сразу понятно, что находится на сверке, что подписано и какие документы уже переданы в ВЭД.</p>
            <div className="premium-pi-stage"><div className="premium-pi-chip"><i><CheckCircle2/></i><small>Подписано</small><b>{counts.piSigned}</b></div><div className="premium-pi-ring" style={{'--pi-progress':`${piProgress * 3.6}deg`}}><div className="premium-pi-ring-copy"><strong>{piProgress}%</strong><span>готовность PI</span></div></div><div className="premium-pi-chip"><i><RefreshCw/></i><small>На сверке</small><b>{counts.piReview}</b></div></div>
            <div className="premium-pi-footer"><span>Передано в ВЭД</span><b>{counts.piVed} из {counts.piTotal}</b></div>
          </article>
          <article className="premium-flow-card premium-flow-route">
            <button className="premium-card-action" onClick={() => onNavigate('logistics')} aria-label="Открыть логистику"><ArrowRight/></button><h3>Путь от фабрики<br/>до склада виден целиком.</h3><p>Каждая поставка на своём этапе, а стоимость логистики и даты всегда перед глазами.</p>
            <div className="premium-route-stage"><div className="premium-route-track"><span className="premium-route-line"/><div className="premium-route-node"><i><Factory/></i><b>Фабрика</b></div><div className="premium-route-node"><i><Truck/></i><b>В пути</b></div><div className="premium-route-node"><i><Warehouse/></i><b>Склад</b></div></div><div className="premium-route-metrics"><div className="premium-route-metric"><i><MapPin/></i><strong>{counts.transit}</strong><span>сейчас в пути</span></div><div className="premium-route-metric"><i><Warehouse/></i><strong>{counts.arrived}</strong><span>принято на складе</span></div></div></div>
          </article>
        </div>
      </div>
    </section>

    <section className="vl-overview-section"><div className="vl-section-heading"><div><small>LIVE OVERVIEW</small><h2>Состояние процессов</h2></div><span>{loading ? 'Обновление…' : 'Данные Supabase · сейчас'}</span></div><div className="overview-grid">{overview.map(([page,status,label,value,caption]) => <button key={`${page}-${status}`} onClick={() => onNavigate(page,{status})} className={status === 'overdue' ? 'danger-metric' : ''}><span>{String(value).padStart(2,'0')}</span><div><b>{label}</b><small>{caption}</small></div><ArrowRight/></button>)}</div></section>

    <section className="dashboard-columns vl-dashboard-columns">
      <article className="dashboard-panel attention-panel"><header><div><small>ACTION REQUIRED</small><h2>Требует внимания</h2></div><span>{attention.length}</span></header>{!attention.length ? <div className="panel-empty"><FileCheck2/><b>Критичных задач нет</b><small>Новые задачи появятся автоматически.</small></div> : <div className="attention-list">{attention.map((item,index) => <button key={`${item.type}-${item.id}-${index}`} onClick={() => onNavigate(item.type,{id:item.id})}><i className={item.tone}><AlertTriangle/></i><span><b>{item.title}</b><small>{item.text}</small></span><ArrowRight/></button>)}</div>}</article>
      <article className="dashboard-panel activity-panel"><header><div><small>ACTIVITY STREAM</small><h2>Последние действия</h2></div><Clock3/></header>{!data.activity.length ? <div className="panel-empty"><Clock3/><b>История пока пуста</b><small>Действия появятся после работы с записями.</small></div> : <div className="activity-list">{data.activity.map(item => <div key={item.id}><i/><span><b>{actionLabel[item.action] || item.action} · {activityLabel[item.entity_type] || item.entity_type}</b><small>{item.object_label || 'Запись'} · {item.actor_email || 'Пользователь'}</small></span><time>{formatDateTime(item.created_at)}</time></div>)}</div>}</article>
    </section>

    <section className="vl-finance-story">
      <div className="vl-finance-orbits"><i/><i/><i/></div><div><small>ФИНАЛЬНЫЙ КОНТУР</small><h2>Управляете вы.<br/>Система <span><ShieldCheck/></span> держит ритм.</h2><p>Платежи не смешиваются с запросами, но остаются рядом с PI. Просрочки, даты и процент оплаты видны сразу.</p><button onClick={() => onNavigate('payments')}>Открыть платежи <ArrowRight/></button></div>
      <article><WalletCards/><small>ПЛАТЕЖИ К ОПЛАТЕ</small><b>{counts.paymentDue}</b><span className={counts.paymentOverdue ? 'danger' : ''}>{counts.paymentOverdue ? `${counts.paymentOverdue} просрочено` : 'Просрочек нет'}</span></article>
    </section>

    <section className="vl-final-cta"><small>Больше, чем реестр.</small><h2>Начните.<br/>Добавьте <span><Package/></span> запрос.</h2><button onClick={() => onCreate('requests')}>Создать новый запрос <ArrowRight/></button><p>{supplierCount} поставщиков · {counts.requestsTotal} запросов · {counts.transit} поставок в пути</p></section>
  </div>
}
