import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardList, Clock3, FileCheck2, Plus, Truck, WalletCards } from 'lucide-react'
import { formatDate, formatDateTime, loadRows, paymentStatuses, piStatuses, requestStatuses, today } from './data'
import { ErrorBanner } from './components'

export default function Dashboard({ onNavigate, onCreate }) {
  const [data, setData] = useState({ requests: [], pis: [], logistics: [], payments: [], activity: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const heroRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const [requests, pis, logistics, payments, activity] = await Promise.all([
          loadRows('requests'), loadRows('pi_records'), loadRows('manual_logistics'), loadRows('payments'), loadRows('activity_log', 'created_at', { select: '*' })
        ])
        setData({ requests, pis, logistics, payments, activity: activity.slice(0, 12) })
      } catch (reason) { setError(reason) } finally { setLoading(false) }
    }
    load()
  }, [])

  function move(event) {
    if (!heroRef.current) return
    const box = heroRef.current.getBoundingClientRect()
    heroRef.current.style.setProperty('--mx', `${(event.clientX - box.left) / box.width - .5}`)
    heroRef.current.style.setProperty('--my', `${(event.clientY - box.top) / box.height - .5}`)
  }

  const metrics = useMemo(() => [
    ['requests','request','Активные запросы', data.requests.filter(row => row.status === 'request').length, 'Ждут ответа'],
    ['requests','offer','Предложения получены', data.requests.filter(row => row.status === 'offer').length, 'Готовы к расчёту'],
    ['requests','calculation','Внесено в просчёт', data.requests.filter(row => row.status === 'calculation').length, 'Завершённый этап'],
    ['pi','verification','PI на сверке', data.pis.filter(row => row.status === 'verification').length, 'Характеристики'],
    ['pi','confirmed','PI ожидают подписания', data.pis.filter(row => row.status === 'confirmed').length, 'Можно подписывать'],
    ['pi','ved','PI отправлены в ВЭД', data.pis.filter(row => row.status === 'ved').length, 'Контроль писем'],
    ['logistics','transit','Грузы в пути', data.logistics.filter(row => row.status === 'transit').length, 'Активные перевозки'],
    ['logistics','waiting','Ожидается отправка', data.logistics.filter(row => ['waiting','ready'].includes(row.status)).length, 'Нужна дата выезда'],
    ['payments','planned','Платежи к оплате', data.payments.filter(row => row.status === 'planned').length, 'Плановые платежи'],
    ['payments','overdue','Просроченные платежи', data.payments.filter(row => row.status === 'overdue' || (row.due_date && row.due_date < today() && row.status !== 'paid')).length, 'Требуют внимания']
  ], [data])

  const attention = useMemo(() => {
    const items = []
    data.requests.filter(row => row.status === 'request' && row.request_sent_at && (Date.now() - new Date(`${row.request_sent_at}T00:00:00`)) / 86400000 > 3).forEach(row => items.push({ type:'requests', id:row.id, title:`${row.request_number} без ответа`, text:row.product_name, tone:'warning' }))
    data.pis.filter(row => ['requested','verification'].includes(row.status) && !row.confirmed_at).forEach(row => items.push({ type:'pi', id:row.id, title:`PI ${row.pi_number}: нет подтверждения`, text:row.product_name, tone:'warning' }))
    data.pis.filter(row => row.status === 'signed' && !(row.attachments || []).length).forEach(row => items.push({ type:'pi', id:row.id, title:`PI ${row.pi_number}: нет файла`, text:'Добавьте подписанный документ', tone:'danger' }))
    data.pis.filter(row => row.status === 'ved' && (!row.tnved_email_sent || !row.nomenclature_email_sent)).forEach(row => items.push({ type:'pi', id:row.id, title:`PI ${row.pi_number}: не все письма ВЭД`, text:'Проверьте две контрольные отметки', tone:'danger' }))
    data.logistics.filter(row => ['waiting','ready'].includes(row.status) && !row.departure_date).forEach(row => items.push({ type:'logistics', id:row.id, title:`PI ${row.pi_number}: нет даты выезда`, text:row.logistics_company || 'Перевозчик не указан', tone:'warning' }))
    data.logistics.filter(row => row.warehouse_date && row.warehouse_date < today() && row.status !== 'arrived').forEach(row => items.push({ type:'logistics', id:row.id, title:`PI ${row.pi_number}: прибытие просрочено`, text:`План: ${formatDate(row.warehouse_date)}`, tone:'danger' }))
    data.payments.filter(row => row.status === 'overdue' || (row.due_date && row.due_date < today() && row.status !== 'paid')).forEach(row => items.push({ type:'payments', id:row.id, title:`${row.payment_number || row.pi_number}: платёж просрочен`, text:`Срок: ${formatDate(row.due_date)}`, tone:'danger' }))
    return items.slice(0, 10)
  }, [data])

  const activityLabel = { requests:'Запрос', pi_records:'PI', manual_logistics:'Логистика', payments:'Платёж' }
  const actionLabel = { INSERT:'Создано', UPDATE:'Обновлено', DELETE:'Удалено' }

  return <div className="page dashboard-page">
    <ErrorBanner error={error}/>
    <section className="dashboard-hero" ref={heroRef} onPointerMove={move}>
      <div className="hero-orbit hero-orbit-a"/><div className="hero-orbit hero-orbit-b"/><div className="hero-glow"/>
      <div className="hero-copy"><small>VIOLET LEDGER · PROCUREMENT CONTROL</small><h1>Весь путь сделки.<br/><em>В одном ритме.</em></h1><p>Запросы, PI, логистика и платежи связаны в единой рабочей системе.</p><div className="hero-actions"><button className="primary" onClick={() => onCreate('requests')}><Plus/> Создать запрос</button><button className="glass-button" onClick={() => onCreate('pi')}><FileCheck2/> Добавить PI</button></div></div>
      <div className="deal-network" aria-hidden="true">
        <div className="network-line"/>
        {[['01','Запрос',ClipboardList],['02','PI',FileCheck2],['03','Логистика',Truck],['04','Платёж',WalletCards]].map(([index,label,Icon],itemIndex) => <div className={`network-node n${itemIndex+1}`} key={label}><span>{index}</span><i><Icon/></i><b>{label}</b></div>)}
        <div className="moving-pulse p1"/><div className="moving-pulse p2"/>
      </div>
    </section>

    <section className="quick-actions"><button onClick={() => onCreate('requests')}><ClipboardList/><span><b>Создать запрос</b><small>Новая товарная позиция</small></span><ArrowRight/></button><button onClick={() => onCreate('pi')}><FileCheck2/><span><b>Добавить PI</b><small>Документ поставщика</small></span><ArrowRight/></button><button onClick={() => onCreate('logistics')}><Truck/><span><b>Добавить логистику</b><small>Перевозка и стоимость</small></span><ArrowRight/></button><button onClick={() => onCreate('payments')}><WalletCards/><span><b>Добавить платёж</b><small>План или факт оплаты</small></span><ArrowRight/></button></section>

    <section className="dashboard-section"><div className="section-heading"><div><small>LIVE OVERVIEW</small><h2>Состояние процессов</h2></div><span>{loading ? 'Обновление…' : 'Данные Supabase'}</span></div><div className="overview-grid">{metrics.map(([page,status,label,value,caption]) => <button key={`${page}-${status}`} onClick={() => onNavigate(page,{status})} className={status === 'overdue' ? 'danger-metric' : ''}><span>{String(value).padStart(2,'0')}</span><div><b>{label}</b><small>{caption}</small></div><ArrowRight/></button>)}</div></section>

    <section className="dashboard-columns">
      <article className="dashboard-panel attention-panel"><header><div><small>ACTION REQUIRED</small><h2>Требует внимания</h2></div><span>{attention.length}</span></header>{!attention.length ? <div className="panel-empty"><FileCheck2/><b>Критичных задач нет</b><small>Новые задачи появятся автоматически.</small></div> : <div className="attention-list">{attention.map((item,index) => <button key={`${item.type}-${item.id}-${index}`} onClick={() => onNavigate(item.type,{id:item.id})}><i className={item.tone}><AlertTriangle/></i><span><b>{item.title}</b><small>{item.text}</small></span><ArrowRight/></button>)}</div>}</article>
      <article className="dashboard-panel activity-panel"><header><div><small>ACTIVITY STREAM</small><h2>Последние действия</h2></div><Clock3/></header>{!data.activity.length ? <div className="panel-empty"><Clock3/><b>История пока пуста</b><small>Действия появятся после обновления базы.</small></div> : <div className="activity-list">{data.activity.map(item => <div key={item.id}><i/><span><b>{actionLabel[item.action] || item.action} · {activityLabel[item.entity_type] || item.entity_type}</b><small>{item.object_label || 'Запись'} · {item.actor_email || 'Пользователь'}</small></span><time>{formatDateTime(item.created_at)}</time></div>)}</div>}</article>
    </section>
  </div>
}
