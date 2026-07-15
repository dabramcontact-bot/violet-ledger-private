import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, FileCheck2, Layers3, PackagePlus, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { canEdit, currencies, deleteRow, exportExcel, formatDate, formatMoney, loadRows, number, piStatuses, saveRow, text, today, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FileList, FormSection, PageHeader, SearchBox, StatusPill } from './components'
import './procurement-register-premium.css'

const itemBlank = seed => ({
  item_id: seed?.item_id || uid('ITEM'),
  request_id: seed?.request_id || seed?.id || null,
  request_number: seed?.request_number || '',
  product_name: seed?.product_name || '',
  article: seed?.article || seed?.article_numbers || '',
  quantity: seed?.quantity ?? seed?.requested_quantity ?? '',
  unit: seed?.unit || 'шт',
  unit_price: seed?.unit_price ?? seed?.supplier_price ?? '',
  total_amount: seed?.total_amount ?? '',
  payment_terms: seed?.payment_terms || '',
  production_days: seed?.production_days ?? '',
  characteristics: seed?.characteristics || '',
  packaging: seed?.packaging || '',
  dimensions: seed?.dimensions || '',
  weight: seed?.weight || ''
})

const blank = seed => ({
  pi_number: uid('PI'),
  request_id: seed?.id || null,
  pi_date: today(),
  supplier: seed?.agent_name || '',
  currency: seed?.currency || 'CNY',
  status: 'requested',
  requested_at: today(),
  confirmed_at: null,
  signed_at: null,
  ved_at: null,
  tnved_email_sent: false,
  tnved_email_sent_at: null,
  nomenclature_email_sent: false,
  nomenclature_email_sent_at: null,
  responsible: seed?.responsible || '',
  comment: '',
  attachments: [],
  items: [itemBlank(seed)]
})

const itemAmount = item => {
  const stored = number(item?.total_amount)
  const quantity = number(item?.quantity)
  const price = number(item?.unit_price)
  return quantity != null && price != null ? quantity * price : stored || 0
}

function normalize(row, requests = []) {
  const requestMap = new Map(requests.map(item => [item.id, item]))
  const fallbackRequest = requestMap.get(row.request_id)
  const legacyItem = itemBlank({
    request_id: row.request_id,
    request_number: fallbackRequest?.request_number || row.request_number || '',
    product_name: row.product_name,
    article: row.article,
    quantity: row.quantity,
    unit_price: row.unit_price,
    total_amount: row.total_amount,
    payment_terms: row.payment_terms,
    production_days: row.production_days,
    characteristics: row.characteristics,
    packaging: row.packaging,
    dimensions: row.dimensions,
    weight: row.weight
  })
  const sourceItems = Array.isArray(row.items) && row.items.length ? row.items : [legacyItem]
  const items = sourceItems.map(source => {
    const linked = requestMap.get(source.request_id)
    return itemBlank({ ...source, request_number: linked?.request_number || source.request_number || '' })
  })
  return { ...blank(), ...row, items, attachments: Array.isArray(row.attachments) ? row.attachments : [] }
}

export default function PI({ profile, session, signal, initialFilter, onOpenRequest, onCreateLogistics }) {
  const [rows, setRows] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [supplier, setSupplier] = useState('all')
  const editable = canEdit(profile)

  async function load() {
    setLoading(true); setError('')
    try {
      const [piRows, requestRows] = await Promise.all([loadRows('pi_records'), loadRows('requests')])
      setRequests(requestRows)
      setRows(piRows.map(row => normalize(row, requestRows)))
    } catch (reason) { setError(reason) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (signal?.type === 'pi') setEditor(blank(signal.seed)) }, [signal])
  useEffect(() => {
    if (signal?.type !== 'open-pi' || !rows.length) return
    const row = rows.find(item => item.id === signal.id)
    if (row) setEditor(normalize(row, requests))
  }, [signal, rows, requests])
  useEffect(() => { if (initialFilter?.status) setStatus(initialFilter.status) }, [initialFilter])

  const filtered = useMemo(() => rows.filter(row => {
    const itemText = (row.items || []).map(item => `${item.product_name} ${item.article} ${item.request_number}`).join(' ')
    const haystack = [row.pi_number, row.supplier, itemText].join(' ').toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (status === 'all' || row.status === status) && (supplier === 'all' || row.supplier === supplier)
  }), [rows, query, status, supplier])

  const suppliers = [...new Set(rows.map(row => row.supplier).filter(Boolean))].sort()
  const editorTotal = editor?.items?.reduce((sum, item) => sum + itemAmount(item), 0) || 0
  const editorQuantity = editor?.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0
  const linkedEditorRequests = editor ? [...new Map(editor.items.filter(item => item.request_id).map(item => [item.request_id, item])).values()] : []

  function updateStatus(next) {
    const patch = { status: next }
    if (next === 'requested') patch.requested_at = editor.requested_at || today()
    if (next === 'confirmed') patch.confirmed_at = editor.confirmed_at || today()
    if (next === 'signed') patch.signed_at = editor.signed_at || today()
    if (next === 'ved') patch.ved_at = editor.ved_at || today()
    setEditor(current => ({ ...current, ...patch }))
  }

  function toggleMail(key, checked) {
    setEditor(current => ({ ...current, [key]: checked, [`${key}_at`]: checked ? current[`${key}_at`] || today() : null }))
  }

  function updateItem(index, key, value) {
    setEditor(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  }

  function selectItemRequest(index, id) {
    const source = requests.find(item => item.id === id)
    if (!source) {
      setEditor(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, request_id: null, request_number: '' } : item) }))
      return
    }
    setEditor(current => ({
      ...current,
      supplier: current.supplier || source.agent_name,
      currency: source.currency || current.currency,
      items: current.items.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        request_id: source.id,
        request_number: source.request_number,
        product_name: source.product_name || item.product_name,
        article: source.article_numbers || item.article,
        quantity: source.requested_quantity ?? item.quantity,
        unit: source.unit || item.unit,
        unit_price: source.supplier_price ?? item.unit_price,
        production_days: source.production_days ?? item.production_days
      } : item)
    }))
  }

  function removeItem(index) {
    setEditor(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function save() {
    if (!text(editor.pi_number) || !text(editor.supplier)) { setError('Заполните номер PI и поставщика.'); return }
    if (!editor.items.length) { setError('Добавьте хотя бы одну товарную позицию.'); return }
    if (editor.items.some(item => !text(item.product_name) || !(Number(item.quantity) > 0))) {
      setError('Для каждой позиции заполните наименование и количество больше нуля.'); return
    }
    setSaving(true); setError('')
    try {
      const items = editor.items.map(item => {
        const quantity = number(item.quantity)
        const unitPrice = number(item.unit_price)
        return {
          item_id: text(item.item_id) || uid('ITEM'),
          request_id: item.request_id || null,
          request_number: text(item.request_number),
          product_name: text(item.product_name),
          article: text(item.article),
          quantity,
          unit: text(item.unit) || 'шт',
          unit_price: unitPrice,
          total_amount: quantity != null && unitPrice != null ? Number((quantity * unitPrice).toFixed(2)) : number(item.total_amount),
          payment_terms: text(item.payment_terms),
          production_days: number(item.production_days),
          characteristics: text(item.characteristics),
          packaging: text(item.packaging),
          dimensions: text(item.dimensions),
          weight: text(item.weight)
        }
      })
      const first = items[0]
      const terms = [...new Set(items.map(item => item.payment_terms).filter(Boolean))].join(' · ')
      const payload = {
        ...editor,
        pi_number: text(editor.pi_number),
        supplier: text(editor.supplier),
        responsible: text(editor.responsible),
        comment: text(editor.comment),
        request_id: items.find(item => item.request_id)?.request_id || null,
        product_name: first.product_name,
        article: first.article,
        quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        unit_price: items.length === 1 ? first.unit_price : null,
        total_amount: items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
        payment_terms: terms,
        production_days: Math.max(0, ...items.map(item => Number(item.production_days || 0))) || null,
        characteristics: first.characteristics,
        packaging: first.packaging,
        dimensions: first.dimensions,
        weight: first.weight,
        items
      }
      delete payload.request_number
      const saved = normalize(await saveRow('pi_records', payload, session.user.id), requests)
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)])
      setEditor(null)
    } catch (reason) { setError(reason) }
    finally { setSaving(false) }
  }

  async function remove(row) {
    if (!window.confirm(`Удалить PI ${row.pi_number}? Логистика и платежи останутся в системе.`)) return
    try {
      await deleteRow('pi_records', row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setEditor(null)
    } catch (reason) { setError(reason) }
  }

  function exportRows() {
    const lines = filtered.flatMap(row => row.items.map((item, index) => ({ ...row, ...item, line_number: index + 1, pi_status: row.status, pi_date_value: row.pi_date, pi_supplier: row.supplier, pi_currency: row.currency, pi_comment: row.comment })))
    exportExcel('PI', lines, [
      ['pi_number', 'Номер PI'], ['pi_date_value', 'Дата PI', formatDate], ['pi_supplier', 'Поставщик'], ['line_number', 'Позиция'],
      ['request_number', 'Исходный запрос'], ['product_name', 'Наименование товара'], ['article', 'Артикул'], ['quantity', 'Количество'], ['unit', 'Единица'],
      ['unit_price', 'Цена за единицу'], ['total_amount', 'Сумма позиции'], ['pi_currency', 'Валюта'], ['payment_terms', 'Условия'],
      ['production_days', 'Срок производства, дней'], ['characteristics', 'Характеристики'], ['packaging', 'Упаковка'], ['dimensions', 'Размеры'], ['weight', 'Вес'],
      ['pi_status', 'Статус PI', value => piStatuses[value]], ['tnved_email_sent', 'Письмо на код ТН ВЭД', value => value ? 'Да' : 'Нет'],
      ['nomenclature_email_sent', 'Письмо на номенклатуру', value => value ? 'Да' : 'Нет'], ['responsible', 'Ответственный'], ['pi_comment', 'Комментарий']
    ])
  }

  return <div className="page procurement-page pi-modern">
    <PageHeader eyebrow="PROFORMA INVOICE" title="PI" description="Один документ может содержать несколько номенклатур — каждая со своим количеством и условиями." action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить PI" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>

    <section className="metric-strip five procurement-metrics pi-metrics">{Object.entries(piStatuses).map(([key, label], index) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}><span className="metric-step">0{index + 1}</span><div><small>{label}</small><em>{key === 'ved' ? 'Контроль писем' : 'Рабочий этап PI'}</em></div><b>{rows.filter(row => row.status === key).length}</b></button>)}</section>

    <section className="register-panel procurement-register">
      <div className="register-head"><div><small>PI REGISTER</small><h2>Документы и номенклатуры</h2><p>{filtered.length} из {rows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
      <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Номер PI, товар, артикул или поставщик"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(piStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={supplier} onChange={event => setSupplier(event.target.value)}><option value="all">Все поставщики</option>{suppliers.map(item => <option key={item}>{item}</option>)}</select></div>
      {loading ? <div className="loading-state">Загрузка PI…</div> : !filtered.length ? <EmptyState icon={FileCheck2} title="PI не найдены" text={rows.length ? 'Измените фильтры.' : 'Создайте PI и добавьте товарные позиции.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить PI"/> : <>
        <div className="data-table"><table><thead><tr><th>Документ</th><th>Товарные позиции</th><th>Поставщик</th><th>Сумма</th><th>Статус</th><th>ВЭД</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}>
          <td><button className="table-link" onClick={() => setEditor(normalize(row, requests))}>PI {row.pi_number}</button><small>{formatDate(row.pi_date)}</small></td>
          <td><div className="pi-table-items">{row.items.slice(0, 2).map(item => <span key={item.item_id}><i/>{item.product_name}<small>{item.quantity || '—'} {item.unit || 'шт'}{item.article ? ` · ${item.article}` : ''}</small></span>)}{row.items.length > 2 && <b>+ ещё {row.items.length - 2}</b>}</div></td>
          <td><b>{row.supplier}</b><small>{row.items.length} поз.</small></td>
          <td><b>{formatMoney(row.items.reduce((sum, item) => sum + itemAmount(item), 0), row.currency)}</b><small>{row.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} ед.</small></td>
          <td><StatusPill value={row.status} labels={piStatuses}/></td>
          <td><div className="mail-flags"><span className={row.tnved_email_sent ? 'done' : ''}>ТН ВЭД</span><span className={row.nomenclature_email_sent ? 'done' : ''}>Номенклатура</span></div></td>
          <td><div className="row-actions"><button title="Открыть" onClick={() => setEditor(normalize(row, requests))}><Pencil/></button>{editable && <button title="Передать все позиции в логистику" onClick={() => onCreateLogistics(row)}><Truck/></button>}{editable && <button className="danger" title="Удалить" onClick={() => remove(row)}><Trash2/></button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => setEditor(normalize(row, requests))}><div><button>PI {row.pi_number}</button><StatusPill value={row.status} labels={piStatuses}/></div><h3>{row.items[0]?.product_name || 'Без товара'}{row.items.length > 1 ? ` + ещё ${row.items.length - 1}` : ''}</h3><p>{row.supplier}</p><dl><div><dt>Позиций</dt><dd>{row.items.length}</dd></div><div><dt>Сумма</dt><dd>{formatMoney(row.items.reduce((sum, item) => sum + itemAmount(item), 0), row.currency)}</dd></div><div><dt>Дата</dt><dd>{formatDate(row.pi_date)}</dd></div></dl></article>)}</div>
      </>}
    </section>

    {editor && <Drawer wide title={editor.id ? `PI ${editor.pi_number}` : 'Новая PI'} subtitle={editor.id ? `${editor.items.length} ТОВАРНЫХ ПОЗИЦИЙ` : 'MULTI-ITEM PI'} onClose={() => setEditor(null)} footer={<><span className="footer-note">{editor.items.length} поз. · {formatMoney(editorTotal, editor.currency)}</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить PI</BusyButton></>}>
      <FormSection index="01" title="Документ" text="Общие реквизиты для всех товарных позиций.">
        <Field label="Номер PI *"><input value={editor.pi_number} onChange={event => setEditor({ ...editor, pi_number: event.target.value })}/></Field>
        <Field label="Дата PI"><input type="date" value={editor.pi_date || ''} onChange={event => setEditor({ ...editor, pi_date: event.target.value })}/></Field>
        <Field label="Поставщик *"><input value={editor.supplier} onChange={event => setEditor({ ...editor, supplier: event.target.value })}/></Field>
        <Field label="Валюта PI"><select value={editor.currency} onChange={event => setEditor({ ...editor, currency: event.target.value })}>{currencies.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Ответственный" wide><input value={editor.responsible} onChange={event => setEditor({ ...editor, responsible: event.target.value })}/></Field>
      </FormSection>

      <FormSection index="02" title="Товарные позиции" text="Количество, цена и условия заполняются отдельно для каждой номенклатуры.">
        <div className="pi-items-editor wide-field">{editor.items.map((item, index) => <article key={item.item_id} className="pi-item-card">
          <header><div><span>{String(index + 1).padStart(2, '0')}</span><div><small>НОМЕНКЛАТУРА</small><b>{item.product_name || `Товар ${index + 1}`}</b></div></div>{editor.items.length > 1 && <button type="button" title="Удалить позицию" onClick={() => removeItem(index)}><Trash2/></button>}</header>
          <div className="pi-item-source"><ClipboardList/><label><span>Создать из запроса</span><select value={item.request_id || ''} onChange={event => selectItemRequest(index, event.target.value)}><option value="">Без связи с запросом</option>{requests.map(row => <option key={row.id} value={row.id}>{row.request_number} · {row.product_name}</option>)}</select></label></div>
          <div className="pi-item-grid">
            <label className="wide"><span>Наименование товара *</span><input value={item.product_name} onChange={event => updateItem(index, 'product_name', event.target.value)} placeholder="Введите наименование"/></label>
            <label><span>Артикул</span><input value={item.article} onChange={event => updateItem(index, 'article', event.target.value)}/></label>
            <label><span>Количество *</span><input type="number" min="0" step="0.01" value={item.quantity ?? ''} onChange={event => updateItem(index, 'quantity', event.target.value)}/></label>
            <label><span>Единица</span><input value={item.unit} onChange={event => updateItem(index, 'unit', event.target.value)}/></label>
            <label><span>Цена за единицу</span><input type="number" min="0" step="0.01" value={item.unit_price ?? ''} onChange={event => updateItem(index, 'unit_price', event.target.value)}/></label>
            <div className="pi-item-amount"><small>Сумма позиции</small><b>{formatMoney(itemAmount(item), editor.currency)}</b></div>
            <label><span>Срок производства, дней</span><input type="number" min="0" value={item.production_days ?? ''} onChange={event => updateItem(index, 'production_days', event.target.value)}/></label>
            <label className="wide"><span>Условия по позиции</span><input value={item.payment_terms} onChange={event => updateItem(index, 'payment_terms', event.target.value)} placeholder="Оплата, готовность, особые условия"/></label>
            <label className="wide"><span>Характеристики</span><textarea rows="3" value={item.characteristics} onChange={event => updateItem(index, 'characteristics', event.target.value)} placeholder="Модель, цвет, материал, комплектация…"/></label>
            <label><span>Упаковка</span><input value={item.packaging} onChange={event => updateItem(index, 'packaging', event.target.value)}/></label>
            <label><span>Размеры</span><input value={item.dimensions} onChange={event => updateItem(index, 'dimensions', event.target.value)}/></label>
            <label><span>Вес</span><input value={item.weight} onChange={event => updateItem(index, 'weight', event.target.value)}/></label>
          </div>
        </article>)}<button type="button" className="pi-add-item" onClick={() => setEditor(current => ({ ...current, items: [...current.items, itemBlank()] }))}><PackagePlus/><span><b>Добавить номенклатуру</b><small>Новая позиция внутри этого же PI</small></span><Plus/></button></div>
        <div className="pi-document-total wide-field"><span><Layers3/><small>ИТОГО ПО ДОКУМЕНТУ</small></span><div><small>{editor.items.length} поз. · {editorQuantity} ед.</small><b>{formatMoney(editorTotal, editor.currency)}</b></div></div>
      </FormSection>

      <FormSection index="03" title="Статус PI и контрольные даты">
        <Field label="Статус PI"><select value={editor.status} onChange={event => updateStatus(event.target.value)}>{Object.entries(piStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Дата запроса"><input type="date" value={editor.requested_at || ''} onChange={event => setEditor({ ...editor, requested_at: event.target.value })}/></Field>
        <Field label="Подтверждение характеристик"><input type="date" value={editor.confirmed_at || ''} onChange={event => setEditor({ ...editor, confirmed_at: event.target.value || null })}/></Field>
        <Field label="Дата подписания"><input type="date" value={editor.signed_at || ''} onChange={event => setEditor({ ...editor, signed_at: event.target.value || null })}/></Field>
        <Field label="Передача в ВЭД"><input type="date" value={editor.ved_at || ''} onChange={event => setEditor({ ...editor, ved_at: event.target.value || null })}/></Field>
      </FormSection>

      {editor.status === 'ved' && <FormSection index="04" title="Отправлено в ВЭД" text="Каждое письмо отмечается отдельно.">
        <label className="check-card wide-field"><input type="checkbox" checked={editor.tnved_email_sent} onChange={event => toggleMail('tnved_email_sent', event.target.checked)}/><span><b>Письмо на определение кода ТН ВЭД</b><small>Отдельная контрольная отметка</small></span></label><Field label="Дата отправки"><input type="date" value={editor.tnved_email_sent_at || ''} onChange={event => setEditor({ ...editor, tnved_email_sent_at: event.target.value || null })}/></Field>
        <label className="check-card wide-field"><input type="checkbox" checked={editor.nomenclature_email_sent} onChange={event => toggleMail('nomenclature_email_sent', event.target.checked)}/><span><b>Письмо на создание номенклатуры</b><small>Не зависит от письма на код ТН ВЭД</small></span></label><Field label="Дата отправки"><input type="date" value={editor.nomenclature_email_sent_at || ''} onChange={event => setEditor({ ...editor, nomenclature_email_sent_at: event.target.value || null })}/></Field>
      </FormSection>}

      <FormSection index={editor.status === 'ved' ? '05' : '04'} title="Документы и комментарий"><Field label="Файл PI и дополнительные документы" wide><FileList files={editor.attachments} onChange={attachments => setEditor({ ...editor, attachments })} folder="pi" userId={session.user.id} disabled={!editable}/></Field><Field label="Комментарий" wide><textarea rows="4" value={editor.comment} onChange={event => setEditor({ ...editor, comment: event.target.value })}/></Field></FormSection>
      {editor.id && <div className="linked-actions"><span>СВЯЗАННЫЕ ЗАПИСИ</span>{linkedEditorRequests.map(item => <button key={item.request_id} onClick={() => onOpenRequest(item.request_id)}><ClipboardList/> {item.request_number || 'Открыть запрос'}</button>)}<button onClick={() => onCreateLogistics(normalize(editor, requests))}><Truck/> Передать все позиции в логистику</button></div>}
    </Drawer>}
  </div>
}
