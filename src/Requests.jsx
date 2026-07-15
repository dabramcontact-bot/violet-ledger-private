import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react'
import { canEdit, deleteRow, exportExcel, formatDate, formatMoney, loadRows, number, requestStatuses, saveRow, text, today, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FileList, FormSection, PageHeader, SearchBox, StatusPill } from './components'

const blank = () => ({
  request_number: uid('REQ'), request_sent_at: today(), product_name: '', category: '', article_numbers: '', agent_name: '',
  supplier_contact: '', product_url: '', requested_quantity: '', unit: 'шт', supplier_price: '', currency: 'CNY',
  minimum_order: '', production_days: '', notes: '', status: 'request', responsible: '', attachments: [],
  offer_received: false, offer_received_at: null, included_calculation: false
})

function normalize(item) {
  const status = item.status === 'offer' || item.offer_received ? (item.included_calculation ? 'calculation' : 'offer') : item.included_calculation ? 'calculation' : 'request'
  return { ...blank(), ...item, status: ['request', 'offer', 'calculation'].includes(item.status) ? item.status : status, attachments: Array.isArray(item.attachments) ? item.attachments : [] }
}

export default function Requests({ profile, session, signal, initialFilter, onCreatePI }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [responsible, setResponsible] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const editable = canEdit(profile)

  async function load() {
    setLoading(true); setError('')
    try { setRows((await loadRows('requests')).map(normalize)) } catch (reason) { setError(reason) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (signal?.type === 'requests') setEditor(blank()) }, [signal])
  useEffect(() => { if (signal?.type === 'open-requests' && rows.length) { const row = rows.find(item => item.id === signal.id); if (row) setEditor(normalize(row)) } }, [signal, rows])
  useEffect(() => { if (initialFilter?.status) setStatus(initialFilter.status) }, [initialFilter])

  const filtered = useMemo(() => rows.filter(row => {
    const haystack = [row.request_number, row.product_name, row.article_numbers, row.agent_name, row.supplier_contact].join(' ').toLowerCase()
    return (!query || haystack.includes(query.toLowerCase()))
      && (status === 'all' || row.status === status)
      && (responsible === 'all' || row.responsible === responsible)
      && (!dateFrom || row.request_sent_at >= dateFrom)
      && (!dateTo || row.request_sent_at <= dateTo)
  }), [rows, query, status, responsible, dateFrom, dateTo])

  const people = [...new Set(rows.map(row => row.responsible).filter(Boolean))].sort()
  const summary = Object.keys(requestStatuses).map(key => [key, rows.filter(row => row.status === key).length])

  function changeStatus(next) {
    setEditor(current => ({
      ...current, status: next,
      offer_received: next !== 'request',
      offer_received_at: next !== 'request' ? current.offer_received_at || today() : null,
      included_calculation: next === 'calculation'
    }))
  }

  async function save() {
    if (!text(editor.product_name) || !text(editor.agent_name) || !text(editor.request_number)) { setError('Заполните номер, товар и поставщика.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...editor, request_number: text(editor.request_number), product_name: text(editor.product_name), category: text(editor.category) || 'Без категории',
        article_numbers: text(editor.article_numbers), agent_name: text(editor.agent_name), supplier_contact: text(editor.supplier_contact),
        product_url: text(editor.product_url), requested_quantity: number(editor.requested_quantity), unit: text(editor.unit) || 'шт',
        supplier_price: number(editor.supplier_price), currency: editor.currency, minimum_order: number(editor.minimum_order),
        production_days: number(editor.production_days), notes: text(editor.notes), responsible: text(editor.responsible)
      }
      const saved = normalize(await saveRow('requests', payload, session.user.id))
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)])
      setEditor(null)
    } catch (reason) { setError(reason) } finally { setSaving(false) }
  }

  async function remove(row) {
    if (!window.confirm(`Удалить запрос ${row.request_number}? Связанные PI останутся в системе.`)) return
    try { await deleteRow('requests', row.id); setRows(current => current.filter(item => item.id !== row.id)); setEditor(null) } catch (reason) { setError(reason) }
  }

  function exportRows() {
    exportExcel('Requests', filtered, [
      ['request_number', 'Номер запроса'], ['request_sent_at', 'Дата', value => formatDate(value)], ['product_name', 'Товар'],
      ['article_numbers', 'Артикул'], ['agent_name', 'Поставщик'], ['supplier_contact', 'Контакт'], ['product_url', 'Ссылка'],
      ['requested_quantity', 'Количество'], ['unit', 'Ед. измерения'], ['supplier_price', 'Цена'], ['currency', 'Валюта'],
      ['minimum_order', 'Минимальный заказ'], ['production_days', 'Срок производства, дней'], ['status', 'Статус', value => requestStatuses[value]],
      ['responsible', 'Ответственный'], ['notes', 'Комментарий']
    ])
  }

  return <div className="page">
    <PageHeader eyebrow="REQUEST REGISTER" title="Запросы" description="Запрос отправлен → предложение получено → внесено в просчёт." action={editable ? () => setEditor(blank()) : null} actionLabel="Создать запрос" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>
    <section className="metric-strip">{summary.map(([key, value]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}><small>{requestStatuses[key]}</small><b>{value}</b></button>)}</section>
    <section className="register-panel">
      <div className="register-head"><div><small>РАБОЧИЙ РЕЕСТР</small><h2>Товарные запросы</h2><p>{filtered.length} из {rows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
      <div className="filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Номер, товар, артикул или поставщик"/>
        <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(requestStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select value={responsible} onChange={event => setResponsible(event.target.value)}><option value="all">Все ответственные</option>{people.map(item => <option key={item}>{item}</option>)}</select>
        <label className="compact-date"><span>с</span><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)}/></label>
        <label className="compact-date"><span>по</span><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)}/></label>
      </div>
      {loading ? <div className="loading-state">Загрузка запросов…</div> : !filtered.length ? <EmptyState icon={ClipboardList} title="Запросы не найдены" text={rows.length ? 'Измените условия поиска.' : 'Создайте первую запись.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Создать запрос"/> : <>
        <div className="data-table"><table><thead><tr><th>Запрос / товар</th><th>Поставщик</th><th>Количество</th><th>Цена</th><th>Статус</th><th>Ответственный</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}>
          <td><button className="table-link" onClick={() => setEditor(normalize(row))}>{row.request_number}</button><b>{row.product_name}</b><small>{row.article_numbers || 'Без артикула'} · {formatDate(row.request_sent_at)}</small></td>
          <td><b>{row.agent_name}</b><small>{row.supplier_contact || 'Контакт не указан'}</small></td>
          <td>{row.requested_quantity || '—'} {row.unit}</td><td>{formatMoney(row.supplier_price, row.currency)}</td><td><StatusPill value={row.status} labels={requestStatuses}/></td><td>{row.responsible || '—'}</td>
          <td><div className="row-actions"><button title="Открыть" onClick={() => setEditor(normalize(row))}><Pencil/></button>{editable && <button title="Создать PI" onClick={() => onCreatePI(row)}><FilePlus2/></button>}{editable && <button className="danger" title="Удалить" onClick={() => remove(row)}><Trash2/></button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => setEditor(normalize(row))}><div><button>{row.request_number}</button><StatusPill value={row.status} labels={requestStatuses}/></div><h3>{row.product_name}</h3><p>{row.agent_name}</p><dl><div><dt>Артикул</dt><dd>{row.article_numbers || '—'}</dd></div><div><dt>Количество</dt><dd>{row.requested_quantity || '—'} {row.unit}</dd></div><div><dt>Дата</dt><dd>{formatDate(row.request_sent_at)}</dd></div></dl></article>)}</div>
      </>}
    </section>

    {editor && <Drawer wide title={editor.id ? editor.request_number : 'Новый запрос'} subtitle={editor.id ? 'REQUEST CARD' : 'CREATE REQUEST'} onClose={() => setEditor(null)} footer={<><span className="footer-note">Изменения сохраняются в Supabase</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Товар и поставщик">
        <Field label="Внутренний номер *"><input value={editor.request_number} onChange={event => setEditor({ ...editor, request_number: event.target.value })}/></Field>
        <Field label="Дата создания"><input type="date" value={editor.request_sent_at || ''} onChange={event => setEditor({ ...editor, request_sent_at: event.target.value })}/></Field>
        <Field label="Наименование товара *" wide><input value={editor.product_name} onChange={event => setEditor({ ...editor, product_name: event.target.value })}/></Field>
        <Field label="Артикул"><input value={editor.article_numbers} onChange={event => setEditor({ ...editor, article_numbers: event.target.value })}/></Field>
        <Field label="Категория"><input value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })}/></Field>
        <Field label="Поставщик *"><input value={editor.agent_name} onChange={event => setEditor({ ...editor, agent_name: event.target.value })}/></Field>
        <Field label="Контакт поставщика"><input value={editor.supplier_contact} onChange={event => setEditor({ ...editor, supplier_contact: event.target.value })}/></Field>
        <Field label="Ссылка на товар" wide><input type="url" value={editor.product_url} onChange={event => setEditor({ ...editor, product_url: event.target.value })} placeholder="https://"/></Field>
      </FormSection>
      <FormSection index="02" title="Коммерческие условия">
        <Field label="Количество"><input type="number" min="0" step="0.01" value={editor.requested_quantity ?? ''} onChange={event => setEditor({ ...editor, requested_quantity: event.target.value })}/></Field>
        <Field label="Единица измерения"><input value={editor.unit} onChange={event => setEditor({ ...editor, unit: event.target.value })}/></Field>
        <Field label="Цена поставщика"><input type="number" min="0" step="0.01" value={editor.supplier_price ?? ''} onChange={event => setEditor({ ...editor, supplier_price: event.target.value })}/></Field>
        <Field label="Валюта"><select value={editor.currency} onChange={event => setEditor({ ...editor, currency: event.target.value })}>{['USD','EUR','CNY','BYN','RUB'].map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Минимальный заказ"><input type="number" min="0" step="0.01" value={editor.minimum_order ?? ''} onChange={event => setEditor({ ...editor, minimum_order: event.target.value })}/></Field>
        <Field label="Срок производства, дней"><input type="number" min="0" value={editor.production_days ?? ''} onChange={event => setEditor({ ...editor, production_days: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="03" title="Статус и ответственность">
        <Field label="Текущий статус"><select value={editor.status} onChange={event => changeStatus(event.target.value)}>{Object.entries(requestStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Ответственный"><input value={editor.responsible} onChange={event => setEditor({ ...editor, responsible: event.target.value })}/></Field>
        <Field label="Комментарий" wide><textarea rows="4" value={editor.notes} onChange={event => setEditor({ ...editor, notes: event.target.value })}/></Field>
        <Field label="Документы" wide><FileList files={editor.attachments} onChange={attachments => setEditor({ ...editor, attachments })} folder="requests" userId={session.user.id} disabled={!editable}/></Field>
      </FormSection>
      {editor.id && <div className="linked-actions"><span>Связанные разделы</span><button type="button" onClick={() => onCreatePI(editor)}><FilePlus2/> Создать PI на основании запроса</button></div>}
    </Drawer>}
  </div>
}
