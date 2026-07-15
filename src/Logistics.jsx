import React, { useEffect, useMemo, useState } from 'react'
import { Download, PackagePlus, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { calculateAllocation, canEdit, currencies, deleteRow, exportExcel, formatDate, formatMoney, loadRows, logisticsStatuses, number, saveRow, text, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FormSection, PageHeader, SearchBox, StatusPill } from './components'

const itemBlank = seed => ({ product_name: seed?.product_name || '', article: seed?.article || '', quantity: seed?.quantity || '', product_value: seed?.total_amount || '', manual_cost: '' })
const blank = seed => ({
  internal_number: uid('LOG'), pi_id: seed?.id || null, pi_number: seed?.pi_number || '', article: seed?.article || '', product_name: seed?.product_name || '',
  supplier: seed?.supplier || '', quantity: seed?.quantity || '', ready_date: '', departure_date: '', warehouse_date: '', logistics_company: '',
  delivery_method: '', transport_document: '', status: 'waiting', logistics_cost: '', logistics_currency: seed?.currency || 'CNY', additional_cost: '',
  allocation_method: 'quantity', items: seed ? [itemBlank(seed)] : [itemBlank()], comment: '', responsible: ''
})
function normalize(row) { return { ...blank(), ...row, items: Array.isArray(row.items) && row.items.length ? row.items : [itemBlank(row)] } }

export default function Logistics({ profile, session, signal, initialFilter, onOpenPI }) {
  const [rows, setRows] = useState([])
  const [pis, setPis] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const editable = canEdit(profile)

  async function load() {
    setLoading(true); setError('')
    try { const [logistics, piRows] = await Promise.all([loadRows('manual_logistics'), loadRows('pi_records')]); setRows(logistics.map(normalize)); setPis(piRows) }
    catch (reason) { setError(reason) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (signal?.type === 'logistics') setEditor(blank(signal.seed)) }, [signal])
  useEffect(() => { if (signal?.type === 'open-logistics' && rows.length) { const row = rows.find(item => item.id === signal.id); if (row) setEditor(normalize(row)) } }, [signal, rows])
  useEffect(() => { if (initialFilter?.status) setStatus(initialFilter.status) }, [initialFilter])

  const filtered = useMemo(() => rows.filter(row => {
    const itemText = (row.items || []).map(item => `${item.article} ${item.product_name}`).join(' ')
    return (!query || [row.internal_number, row.article, row.pi_number, row.supplier, row.logistics_company, itemText].join(' ').toLowerCase().includes(query.toLowerCase())) && (status === 'all' || row.status === status)
  }), [rows, query, status])

  const allocated = editor ? calculateAllocation(editor.items, editor.logistics_cost, editor.allocation_method) : []
  const totalQuantity = allocated.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const unitCost = totalQuantity ? Number(editor?.logistics_cost || 0) / totalQuantity : 0

  function selectPI(id) {
    const source = pis.find(item => item.id === id)
    if (!source) { setEditor({ ...editor, pi_id: null }); return }
    setEditor(current => ({ ...current, pi_id: source.id, pi_number: source.pi_number, supplier: source.supplier, article: source.article, product_name: source.product_name, quantity: source.quantity, logistics_currency: source.currency, items: [itemBlank(source)] }))
  }
  function updateItem(index, key, value) { setEditor(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) })) }
  function removeItem(index) { setEditor(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) })) }

  async function save() {
    if (!text(editor.pi_number) || !text(editor.logistics_company)) { setError('Заполните номер PI и логистическую компанию.'); return }
    if (!(Number(editor.logistics_cost) >= 0)) { setError('Укажите стоимость логистики.'); return }
    setSaving(true); setError('')
    try {
      const items = calculateAllocation(editor.items, editor.logistics_cost, editor.allocation_method)
      const first = items[0] || {}
      const payload = {
        ...editor, internal_number: text(editor.internal_number), pi_number: text(editor.pi_number), supplier: text(editor.supplier),
        article: text(first.article || editor.article), product_name: text(first.product_name || editor.product_name), quantity: items.reduce((sum,item) => sum + Number(item.quantity || 0), 0) || number(editor.quantity) || 1,
        logistics_company: text(editor.logistics_company), delivery_method: text(editor.delivery_method), transport_document: text(editor.transport_document),
        logistics_cost: number(editor.logistics_cost) || 0, additional_cost: number(editor.additional_cost) || 0, items,
        comment: text(editor.comment), responsible: text(editor.responsible)
      }
      const saved = normalize(await saveRow('manual_logistics', payload, session.user.id))
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)]); setEditor(null)
    } catch (reason) { setError(reason) } finally { setSaving(false) }
  }
  async function remove(row) {
    if (!window.confirm(`Удалить логистическую запись ${row.internal_number || row.pi_number}? Связанные PI и платежи останутся.`)) return
    try { await deleteRow('manual_logistics', row.id); setRows(current => current.filter(item => item.id !== row.id)); setEditor(null) } catch (reason) { setError(reason) }
  }
  function exportRows() {
    exportExcel('Logistics', filtered, [
      ['internal_number','Внутренний номер'], ['article','Артикул'], ['product_name','Товар'], ['pi_number','Номер PI'], ['supplier','Поставщик'], ['quantity','Количество'],
      ['ready_date','Дата готовности',formatDate], ['departure_date','Дата выезда',formatDate], ['warehouse_date','Дата прихода на склад',formatDate],
      ['logistics_company','Логистическая компания'], ['delivery_method','Способ доставки'], ['transport_document','Транспортный документ'],
      ['status','Статус', value => logisticsStatuses[value]], ['logistics_cost','Стоимость логистики'], ['logistics_currency','Валюта'],
      ['cost_per_unit','Стоимость на единицу', (_, row) => row.quantity ? Number(row.logistics_cost || 0) / Number(row.quantity) : 0], ['additional_cost','Дополнительная стоимость'],
      ['allocation_method','Распределение'], ['responsible','Ответственный'], ['comment','Комментарий']
    ])
  }

  return <div className="page">
    <PageHeader eyebrow="LOGISTICS REGISTER" title="Логистика" description="Самостоятельный реестр перевозок, дат и полной стоимости доставки." action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить логистику" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>
    <section className="metric-strip five">{Object.entries(logisticsStatuses).map(([key,label]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}><small>{label}</small><b>{rows.filter(row => row.status === key).length}</b></button>)}</section>
    <section className="register-panel">
      <div className="register-head"><div><small>SHIPMENT REGISTER</small><h2>Перевозки и прибытия</h2><p>{filtered.length} из {rows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
      <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Артикул, PI, поставщик или перевозчик"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(logisticsStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {loading ? <div className="loading-state">Загрузка логистики…</div> : !filtered.length ? <EmptyState icon={Truck} title="Перевозки не найдены" text={rows.length ? 'Измените фильтры.' : 'Добавьте запись вручную или из PI.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить логистику"/> : <>
        <div className="data-table"><table><thead><tr><th>Перевозка / PI</th><th>Товары</th><th>Даты</th><th>Компания</th><th>Стоимость</th><th>Статус</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}>
          <td><button className="table-link" onClick={() => setEditor(normalize(row))}>{row.internal_number || 'Без номера'}</button><b>PI {row.pi_number}</b><small>{row.supplier || 'Поставщик не указан'}</small></td><td><b>{row.items?.[0]?.product_name || row.product_name || '—'}</b><small>{row.items?.length > 1 ? `Ещё ${row.items.length - 1} товар(а)` : row.article || 'Без артикула'} · {row.quantity || 0} шт.</small></td>
          <td><b>{formatDate(row.departure_date)} → {formatDate(row.warehouse_date)}</b><small>Готовность: {formatDate(row.ready_date)}</small></td><td><b>{row.logistics_company}</b><small>{row.delivery_method || 'Способ не указан'}</small></td>
          <td><b>{formatMoney(row.logistics_cost,row.logistics_currency)}</b><small>{formatMoney(row.quantity ? Number(row.logistics_cost || 0) / Number(row.quantity) : 0,row.logistics_currency)} / ед.</small></td><td><StatusPill value={row.status} labels={logisticsStatuses}/></td>
          <td><div className="row-actions"><button onClick={() => setEditor(normalize(row))}><Pencil/></button>{editable && <button className="danger" onClick={() => remove(row)}><Trash2/></button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => setEditor(normalize(row))}><div><button>{row.internal_number}</button><StatusPill value={row.status} labels={logisticsStatuses}/></div><h3>PI {row.pi_number}</h3><p>{row.logistics_company}</p><dl><div><dt>Товаров</dt><dd>{row.items?.length || 1}</dd></div><div><dt>Стоимость</dt><dd>{formatMoney(row.logistics_cost,row.logistics_currency)}</dd></div><div><dt>Прибытие</dt><dd>{formatDate(row.warehouse_date)}</dd></div></dl></article>)}</div>
      </>}
    </section>

    {editor && <Drawer wide title={editor.id ? editor.internal_number : 'Новая перевозка'} subtitle={editor.id ? 'LOGISTICS CARD' : 'CREATE LOGISTICS'} onClose={() => setEditor(null)} footer={<><span className="footer-note">Стоимость на единицу пересчитывается автоматически</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Перевозка и PI">
        <Field label="Внутренний номер"><input value={editor.internal_number} onChange={event => setEditor({ ...editor, internal_number: event.target.value })}/></Field><Field label="Связать с PI"><select value={editor.pi_id || ''} onChange={event => selectPI(event.target.value)}><option value="">Без связи</option>{pis.map(pi => <option key={pi.id} value={pi.id}>{pi.pi_number} · {pi.product_name}</option>)}</select></Field>
        <Field label="Номер PI *"><input value={editor.pi_number} onChange={event => setEditor({ ...editor, pi_number: event.target.value })}/></Field><Field label="Поставщик"><input value={editor.supplier} onChange={event => setEditor({ ...editor, supplier: event.target.value })}/></Field><Field label="Логистическая компания *"><input value={editor.logistics_company} onChange={event => setEditor({ ...editor, logistics_company: event.target.value })}/></Field><Field label="Ответственный"><input value={editor.responsible} onChange={event => setEditor({ ...editor, responsible: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="02" title="Даты и транспорт">
        <Field label="Дата готовности"><input type="date" value={editor.ready_date || ''} onChange={event => setEditor({ ...editor, ready_date: event.target.value || null })}/></Field><Field label="Дата выезда"><input type="date" value={editor.departure_date || ''} onChange={event => setEditor({ ...editor, departure_date: event.target.value || null, status: event.target.value ? 'transit' : editor.status })}/></Field><Field label="Дата прихода на склад"><input type="date" value={editor.warehouse_date || ''} onChange={event => setEditor({ ...editor, warehouse_date: event.target.value || null, status: event.target.value ? 'arrived' : editor.status })}/></Field><Field label="Текущий статус"><select value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value })}>{Object.entries(logisticsStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Способ доставки"><input value={editor.delivery_method} onChange={event => setEditor({ ...editor, delivery_method: event.target.value })} placeholder="Авто, море, авиа…"/></Field><Field label="Транспортный документ"><input value={editor.transport_document} onChange={event => setEditor({ ...editor, transport_document: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="03" title="Стоимость логистики">
        <Field label="Стоимость логистики *"><input type="number" min="0" step="0.01" value={editor.logistics_cost ?? ''} onChange={event => setEditor({ ...editor, logistics_cost: event.target.value })}/></Field><Field label="Валюта"><select value={editor.logistics_currency} onChange={event => setEditor({ ...editor, logistics_currency: event.target.value })}>{currencies.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Дополнительная стоимость"><input type="number" min="0" step="0.01" value={editor.additional_cost ?? ''} onChange={event => setEditor({ ...editor, additional_cost: event.target.value })}/></Field><Field label="Распределение"><select value={editor.allocation_method} onChange={event => setEditor({ ...editor, allocation_method: event.target.value })}><option value="equal">Поровну</option><option value="quantity">По количеству</option><option value="value">По стоимости товаров</option><option value="manual">Вручную</option></select></Field>
        <div className="calculated-card"><small>Общее количество</small><b>{totalQuantity || 0}</b></div><div className="calculated-card violet"><small>Стоимость на единицу</small><b>{formatMoney(unitCost,editor.logistics_currency)}</b></div>
      </FormSection>
      <FormSection index="04" title="Товары в перевозке" text="Стоимость распределяется выбранным способом.">
        <div className="items-editor wide-field">{editor.items.map((item,index) => { const result = allocated[index] || {}; return <article key={index}><div><b>Товар {index + 1}</b>{editor.items.length > 1 && <button onClick={() => removeItem(index)}><Trash2/></button>}</div><div className="item-fields"><label><span>Наименование</span><input value={item.product_name} onChange={event => updateItem(index,'product_name',event.target.value)}/></label><label><span>Артикул</span><input value={item.article} onChange={event => updateItem(index,'article',event.target.value)}/></label><label><span>Количество</span><input type="number" min="0" step="0.01" value={item.quantity ?? ''} onChange={event => updateItem(index,'quantity',event.target.value)}/></label><label><span>Стоимость товара</span><input type="number" min="0" step="0.01" value={item.product_value ?? ''} onChange={event => updateItem(index,'product_value',event.target.value)}/></label>{editor.allocation_method === 'manual' && <label><span>Ручная доля</span><input type="number" min="0" step="0.01" value={item.manual_cost ?? ''} onChange={event => updateItem(index,'manual_cost',event.target.value)}/></label>}<div className="allocation-result"><small>Распределено</small><b>{formatMoney(result.allocated_cost,editor.logistics_currency)}</b><span>{formatMoney(result.cost_per_unit,editor.logistics_currency)} / ед.</span></div></div></article>})}<button className="add-item" onClick={() => setEditor({ ...editor, items: [...editor.items, itemBlank()] })}><PackagePlus/> Добавить товар</button></div>
      </FormSection>
      <FormSection index="05" title="Комментарий"><Field label="Комментарий" wide><textarea rows="4" value={editor.comment} onChange={event => setEditor({ ...editor, comment: event.target.value })}/></Field></FormSection>
      {editor.pi_id && <div className="linked-actions"><span>Связанные записи</span><button onClick={() => onOpenPI(editor.pi_id)}><PackagePlus/> Открыть PI</button></div>}
    </Drawer>}
  </div>
}
