import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Download, FilePlus2, Layers3, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { canEdit, deleteRow, exportExcel, formatDate, loadRows, requestStatuses, saveRow, supabase, text, today, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FormSection, PageHeader, SearchBox, StatusPill } from './components'
import SupplierSearchRegistry from './SupplierSearchRegistry'
import './procurement-register-premium.css'

const REQUEST_AGENTS = [
  'NINGBO RSG IMP&EXP CO.,LTD',
  'ZHONGSHAN LINKTEX IMPORT & EXPORT CO., LTD',
  'Ningbo White Stork Trade Co., Ltd.',
  'Market Union Co., Ltd.',
  'Union Source Co., Ltd.',
  'TOP SHINE CO.,LTD',
  'Union Service Co.,Ltd',
  'OFFICEMART STATIONERY CO.,LTD.',
  'NINGBO UNION GRAND IMP.&EXP. CO.,LTD.',
  'NINGBO IHOME INTERNATIONAL TRADING CO., LTD'
]

const displayStatuses = { draft: 'Не отправлено', ...requestStatuses }
const statusNotes = {
  draft: 'Ждёт назначения',
  request: 'Ожидает ответа',
  offer: 'Готово к расчёту',
  calculation: 'Цикл завершён'
}

const agentKey = value => text(value).toLocaleUpperCase('en-US').replace(/[^A-Z0-9]+/g, '')
const normalizeAgent = value => REQUEST_AGENTS.find(agent => agentKey(agent) === agentKey(value)) || text(value)

const blank = () => ({
  request_number: uid('REQ'),
  request_sent_at: today(),
  agent_name: '',
  category: '',
  product_name: '',
  status: 'request',
  offer_received: false,
  offer_received_at: null,
  included_calculation: false
})

function normalize(item) {
  const legacyStatus = item.included_calculation ? 'calculation' : item.offer_received ? 'offer' : 'request'
  return { ...blank(), ...item, source_type: 'request', status: ['request', 'offer', 'calculation'].includes(item.status) ? item.status : legacyStatus }
}

function batchAsRequest(batch) {
  const status = batch.status === 'response_received' ? 'offer' : batch.status === 'sent' ? 'request' : 'draft'
  return {
    id: `batch:${batch.id}`,
    batch_id: batch.id,
    source_type: 'supplier_search',
    request_number: batch.batch_name,
    request_sent_at: batch.sent_at || String(batch.created_at || '').slice(0, 10),
    agent_name: batch.supplier_name || 'Не назначен',
    category: batch.category_level_3,
    product_name: `${batch.category_level_3} · файл ${String(batch.batch_number).padStart(2, '0')}`,
    status,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    links_count: Array.isArray(batch.links) ? batch.links.length : 0
  }
}

export default function Requests({ profile, session, signal, initialFilter, onCreatePI }) {
  const [rows, setRows] = useState([])
  const [batchRows, setBatchRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [workspace, setWorkspace] = useState('requests')
  const [focusBatchId, setFocusBatchId] = useState(null)
  const editable = canEdit(profile)

  async function load() {
    setLoading(true); setError('')
    try { setRows((await loadRows('requests')).map(normalize)) }
    catch (reason) { setError(reason) }
    finally { setLoading(false) }
  }

  async function loadBatches() {
    const { data, error: loadError } = await supabase.from('supplier_search_batches').select('*').order('created_at', { ascending: false }).order('batch_number', { ascending: true })
    if (loadError) {
      if (/does not exist|schema cache|relation/i.test(String(loadError.message || ''))) { setBatchRows([]); return }
      console.error(loadError)
      return
    }
    setBatchRows(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    loadBatches()
    const channel = supabase.channel('requests-with-supplier-batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_search_batches' }, loadBatches)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])
  useEffect(() => { if (signal?.type === 'requests') { setWorkspace('requests'); setEditor(blank()) } }, [signal])
  useEffect(() => {
    if (signal?.type !== 'open-requests' || !rows.length) return
    const row = rows.find(item => item.id === signal.id)
    if (row) { setWorkspace('requests'); setEditor(normalize(row)) }
  }, [signal, rows])
  useEffect(() => { if (initialFilter?.status) { setWorkspace('requests'); setStatus(initialFilter.status) } }, [initialFilter])

  const allRows = useMemo(() => [...rows, ...batchRows.map(batchAsRequest)].sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))), [rows, batchRows])
  const filtered = useMemo(() => allRows.filter(row => {
    const haystack = [row.request_number, row.product_name, row.category, row.agent_name].join(' ').toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (status === 'all' || row.status === status)
  }), [allRows, query, status])

  const agents = REQUEST_AGENTS
  const categories = [...new Set(allRows.map(row => row.category).filter(Boolean))].sort()
  const summary = Object.keys(displayStatuses).map(key => [key, allRows.filter(row => row.status === key).length])

  function openRow(row) {
    if (row.source_type === 'supplier_search') {
      setEditor(null)
      setFocusBatchId(row.batch_id)
      setWorkspace('supplier-search')
      return
    }
    setEditor(normalize(row))
  }

  function changeStatus(next) {
    setEditor(current => ({
      ...current,
      status: next,
      offer_received: next !== 'request',
      offer_received_at: next !== 'request' ? current.offer_received_at || today() : null,
      included_calculation: next === 'calculation'
    }))
  }

  async function save() {
    if (!text(editor.request_sent_at) || !text(editor.agent_name) || !text(editor.category) || !text(editor.product_name)) {
      setError('Заполните дату, агента, категорию и наименование товара.'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        ...editor,
        request_number: text(editor.request_number) || uid('REQ'),
        request_sent_at: editor.request_sent_at,
        agent_name: normalizeAgent(editor.agent_name),
        category: text(editor.category),
        product_name: text(editor.product_name)
      }
      delete payload.source_type
      const saved = normalize(await saveRow('requests', payload, session.user.id))
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)])
      setEditor(null)
    } catch (reason) { setError(reason) }
    finally { setSaving(false) }
  }

  async function remove(row) {
    if (!window.confirm(`Удалить запрос по товару «${row.product_name}»? Связанные PI останутся в системе.`)) return
    try {
      await deleteRow('requests', row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setEditor(null)
    } catch (reason) { setError(reason) }
  }

  function exportRows() {
    exportExcel('Requests', filtered, [
      ['request_sent_at', 'Дата', value => formatDate(value)],
      ['agent_name', 'Агент'],
      ['category', 'Категория'],
      ['product_name', 'Наименование товара'],
      ['source_type', 'Источник', value => value === 'supplier_search' ? 'Подборка поставщику' : 'Товарный запрос'],
      ['status', 'Статус', value => displayStatuses[value]]
    ])
  }

  return <div className="page procurement-page requests-modern">
    <PageHeader eyebrow="REQUEST FLOW" title="Запросы" description={workspace === 'requests' ? 'Товарные запросы и загруженные подборки в одном реестре.' : 'Подборки из аналитики и контроль отправки поставщикам.'} action={workspace === 'requests' && editable ? () => setEditor(blank()) : null} actionLabel="Создать запрос" icon={Plus}/>

    <nav className="requests-workspace-tabs" aria-label="Рабочие реестры запросов">
      <button type="button" className={workspace === 'requests' ? 'active' : ''} onClick={() => { setFocusBatchId(null); setWorkspace('requests') }}><ClipboardList/> Товарные запросы</button>
      <button type="button" className={workspace === 'supplier-search' ? 'active' : ''} onClick={() => { setFocusBatchId(null); setEditor(null); setWorkspace('supplier-search') }}><Layers3/> Подборы поставщикам</button>
    </nav>

    {workspace === 'requests' ? <>
      <ErrorBanner error={error} onClose={() => setError('')}/>

      <section className="metric-strip procurement-metrics">{summary.map(([key, value], index) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}>
        <span className="metric-step">0{index + 1}</span><div><small>{displayStatuses[key]}</small><em>{statusNotes[key]}</em></div><b>{value}</b>
      </button>)}</section>

      <section className="register-panel procurement-register">
        <div className="register-head"><div><small>ОБЩИЙ РЕЕСТР</small><h2>Товарные запросы</h2><p>{filtered.length} из {allRows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
        <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Товар, агент, категория или подборка"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(displayStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        {loading ? <div className="loading-state">Загрузка запросов…</div> : !filtered.length ? <EmptyState icon={ClipboardList} title="Запросы не найдены" text={allRows.length ? 'Измените поиск или статус.' : 'Создайте запрос или загрузите аналитику.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Создать запрос"/> : <>
          <div className="data-table"><table><thead><tr><th>Дата</th><th>Агент</th><th>Категория</th><th>Наименование товара</th><th>Статус</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id} className={row.source_type === 'supplier_search' ? 'supplier-request-row' : ''}>
            <td><button className="table-link" onClick={() => openRow(row)}>{formatDate(row.request_sent_at)}</button><small>{row.request_number}</small></td>
            <td><b>{row.agent_name}</b></td>
            <td><span className="category-chip">{row.category}</span></td>
            <td><b className="product-title">{row.product_name}</b>{row.source_type === 'supplier_search' && <small className="request-source-badge"><Layers3/> Подборка · {row.links_count} ссылок</small>}</td>
            <td><StatusPill value={row.status} labels={displayStatuses}/></td>
            <td><div className="row-actions"><button title={row.source_type === 'supplier_search' ? 'Открыть подборку' : 'Открыть'} onClick={() => openRow(row)}><Pencil/></button>{row.source_type === 'request' && editable && <button title="Создать PI" onClick={() => onCreatePI(row)}><FilePlus2/></button>}{row.source_type === 'request' && editable && <button className="danger" title="Удалить" onClick={() => remove(row)}><Trash2/></button>}</div></td>
          </tr>)}</tbody></table></div>
          <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => openRow(row)}><div><button>{formatDate(row.request_sent_at)}</button><StatusPill value={row.status} labels={displayStatuses}/></div><h3>{row.product_name}</h3><p>{row.agent_name}</p>{row.source_type === 'supplier_search' && <span className="request-source-badge"><Layers3/> Подборка · {row.links_count} ссылок</span>}<dl><div><dt>Категория</dt><dd>{row.category}</dd></div><div><dt>Запрос</dt><dd>{row.request_number}</dd></div></dl></article>)}</div>
        </>}
      </section>
    </> : <SupplierSearchRegistry profile={profile} session={session} suppliers={agents} focusBatchId={focusBatchId} onFocusHandled={() => setFocusBatchId(null)}/>} 

    {workspace === 'requests' && editor && <Drawer title={editor.id ? editor.product_name : 'Новый запрос'} subtitle={editor.id ? editor.request_number : 'SHORT REQUEST'} onClose={() => setEditor(null)} footer={<><span className="footer-note">Номер запроса создаётся автоматически</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Основная информация" text="Четыре поля — без лишних коммерческих данных.">
        <Field label="Дата *"><input type="date" value={editor.request_sent_at || ''} onChange={event => setEditor({ ...editor, request_sent_at: event.target.value })}/></Field>
        <Field label="Агент *"><input list="request-agent-options" value={editor.agent_name} onChange={event => setEditor({ ...editor, agent_name: event.target.value })} placeholder="Выберите или введите"/><datalist id="request-agent-options">{agents.map(item => <option key={item} value={item}/>)}</datalist></Field>
        <Field label="Категория *"><input list="request-category-options" value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })} placeholder="Например, Бытовая техника"/><datalist id="request-category-options">{categories.map(item => <option key={item} value={item}/>)}</datalist></Field>
        <Field label="Наименование товара *"><input value={editor.product_name} onChange={event => setEditor({ ...editor, product_name: event.target.value })} placeholder="Введите название товара"/></Field>
      </FormSection>
      <FormSection index="02" title="Статус запроса" text="Выберите текущую точку короткого маршрута.">
        <div className="request-status-flow wide-field">{Object.entries(requestStatuses).map(([key, label], index) => {
          const reached = Object.keys(requestStatuses).indexOf(editor.status) >= index
          return <React.Fragment key={key}><button type="button" className={`${editor.status === key ? 'active' : ''} ${reached ? 'reached' : ''}`} onClick={() => changeStatus(key)}>{reached ? <CheckCircle2/> : <Send/>}<span><small>ЭТАП 0{index + 1}</small><b>{label}</b></span></button>{index < 2 && <i className={reached && editor.status !== key ? 'reached' : ''}/>}</React.Fragment>
        })}</div>
      </FormSection>
      {editor.id && <div className="linked-actions"><span>СЛЕДУЮЩИЙ РАЗДЕЛ</span><button type="button" onClick={() => onCreatePI(editor)}><FilePlus2/> Создать PI из запроса</button></div>}
    </Drawer>}
  </div>
}
