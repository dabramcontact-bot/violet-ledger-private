import React, { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download, FileCheck2, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { canEdit, currencies, deleteRow, exportExcel, formatDate, formatMoney, loadRows, number, piStatuses, saveRow, text, today, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FileList, FormSection, PageHeader, SearchBox, StatusPill } from './components'

const blank = seed => ({
  pi_number: uid('PI'), request_id: seed?.id || null, pi_date: today(), supplier: seed?.agent_name || '', product_name: seed?.product_name || '',
  article: seed?.article_numbers || '', quantity: seed?.requested_quantity || '', unit_price: seed?.supplier_price || '', total_amount: '',
  currency: seed?.currency || 'CNY', payment_terms: '', production_days: seed?.production_days || '', characteristics: '', packaging: '',
  dimensions: '', weight: '', status: 'requested', requested_at: today(), confirmed_at: null, signed_at: null, ved_at: null,
  tnved_email_sent: false, tnved_email_sent_at: null, nomenclature_email_sent: false, nomenclature_email_sent_at: null,
  responsible: seed?.responsible || '', comment: '', attachments: [], request_number: seed?.request_number || ''
})

function normalize(row) { return { ...blank(), ...row, attachments: Array.isArray(row.attachments) ? row.attachments : [] } }

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
      setRows(piRows.map(row => normalize({ ...row, request_number: requestRows.find(item => item.id === row.request_id)?.request_number || '' })))
      setRequests(requestRows)
    } catch (reason) { setError(reason) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (signal?.type === 'pi') setEditor(blank(signal.seed)) }, [signal])
  useEffect(() => { if (signal?.type === 'open-pi' && rows.length) { const row = rows.find(item => item.id === signal.id); if (row) setEditor(normalize(row)) } }, [signal, rows])
  useEffect(() => { if (initialFilter?.status) setStatus(initialFilter.status) }, [initialFilter])

  const filtered = useMemo(() => rows.filter(row => {
    const haystack = [row.pi_number, row.product_name, row.article, row.supplier, row.request_number].join(' ').toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (status === 'all' || row.status === status) && (supplier === 'all' || row.supplier === supplier)
  }), [rows, query, status, supplier])
  const suppliers = [...new Set(rows.map(row => row.supplier).filter(Boolean))].sort()

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

  function selectRequest(id) {
    const source = requests.find(item => item.id === id)
    if (!source) { setEditor({ ...editor, request_id: null, request_number: '' }); return }
    setEditor(current => ({ ...current, request_id: source.id, request_number: source.request_number, supplier: current.supplier || source.agent_name, product_name: current.product_name || source.product_name, article: current.article || source.article_numbers, quantity: current.quantity || source.requested_quantity, unit_price: current.unit_price || source.supplier_price, currency: source.currency || current.currency }))
  }

  async function save() {
    if (!text(editor.pi_number) || !text(editor.product_name) || !text(editor.supplier)) { setError('Заполните номер PI, товар и поставщика.'); return }
    setSaving(true); setError('')
    try {
      const quantity = number(editor.quantity)
      const unitPrice = number(editor.unit_price)
      const payload = {
        ...editor, pi_number: text(editor.pi_number), supplier: text(editor.supplier), product_name: text(editor.product_name), article: text(editor.article),
        quantity, unit_price: unitPrice, total_amount: number(editor.total_amount) ?? (quantity != null && unitPrice != null ? quantity * unitPrice : null),
        payment_terms: text(editor.payment_terms), production_days: number(editor.production_days), characteristics: text(editor.characteristics),
        packaging: text(editor.packaging), dimensions: text(editor.dimensions), weight: text(editor.weight), responsible: text(editor.responsible), comment: text(editor.comment)
      }
      delete payload.request_number
      const saved = normalize(await saveRow('pi_records', payload, session.user.id))
      saved.request_number = requests.find(item => item.id === saved.request_id)?.request_number || ''
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)]); setEditor(null)
    } catch (reason) { setError(reason) } finally { setSaving(false) }
  }

  async function remove(row) {
    if (!window.confirm(`Удалить PI ${row.pi_number}? Логистика и платежи останутся в системе.`)) return
    try { await deleteRow('pi_records', row.id); setRows(current => current.filter(item => item.id !== row.id)); setEditor(null) } catch (reason) { setError(reason) }
  }

  function exportRows() {
    exportExcel('PI', filtered, [
      ['pi_number','Номер PI'], ['pi_date','Дата PI', formatDate], ['request_number','Исходный запрос'], ['supplier','Поставщик'], ['product_name','Товар'],
      ['article','Артикул'], ['quantity','Количество'], ['unit_price','Цена за единицу'], ['total_amount','Общая сумма'], ['currency','Валюта'],
      ['payment_terms','Условия оплаты'], ['production_days','Срок производства'], ['status','Статус', value => piStatuses[value]],
      ['tnved_email_sent','Письмо на код ТН ВЭД', value => value ? 'Да' : 'Нет'], ['tnved_email_sent_at','Дата письма ТН ВЭД', formatDate],
      ['nomenclature_email_sent','Письмо на номенклатуру', value => value ? 'Да' : 'Нет'], ['nomenclature_email_sent_at','Дата письма на номенклатуру', formatDate],
      ['responsible','Ответственный'], ['comment','Комментарий']
    ])
  }

  return <div className="page">
    <PageHeader eyebrow="PROFORMA INVOICE" title="PI" description="Сверка характеристик, подписание и отдельный контроль передачи в ВЭД." action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить PI" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>
    <section className="metric-strip five">{Object.entries(piStatuses).map(([key, label]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}><small>{label}</small><b>{rows.filter(row => row.status === key).length}</b></button>)}</section>
    <section className="register-panel">
      <div className="register-head"><div><small>PI REGISTER</small><h2>Документы поставщиков</h2><p>{filtered.length} из {rows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
      <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Номер PI, товар, артикул или поставщик"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(piStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><select value={supplier} onChange={event => setSupplier(event.target.value)}><option value="all">Все поставщики</option>{suppliers.map(item => <option key={item}>{item}</option>)}</select></div>
      {loading ? <div className="loading-state">Загрузка PI…</div> : !filtered.length ? <EmptyState icon={FileCheck2} title="PI не найдены" text={rows.length ? 'Измените фильтры.' : 'Создайте PI вручную или из запроса.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить PI"/> : <>
        <div className="data-table"><table><thead><tr><th>PI / товар</th><th>Поставщик</th><th>Сумма</th><th>Статус</th><th>ВЭД</th><th>Ответственный</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}>
          <td><button className="table-link" onClick={() => setEditor(normalize(row))}>{row.pi_number}</button><b>{row.product_name}</b><small>{row.article || 'Без артикула'} · {formatDate(row.pi_date)}</small></td>
          <td><b>{row.supplier}</b><small>{row.request_number ? `Запрос ${row.request_number}` : 'Без исходного запроса'}</small></td><td>{formatMoney(row.total_amount, row.currency)}<small>{row.quantity || '—'} × {formatMoney(row.unit_price, row.currency)}</small></td>
          <td><StatusPill value={row.status} labels={piStatuses}/></td><td><div className="mail-flags"><span className={row.tnved_email_sent ? 'done' : ''}>ТН ВЭД</span><span className={row.nomenclature_email_sent ? 'done' : ''}>Номенклатура</span></div></td><td>{row.responsible || '—'}</td>
          <td><div className="row-actions"><button onClick={() => setEditor(normalize(row))}><Pencil/></button>{editable && <button title="Передать в логистику" onClick={() => onCreateLogistics(row)}><Truck/></button>}{editable && <button className="danger" onClick={() => remove(row)}><Trash2/></button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => setEditor(normalize(row))}><div><button>{row.pi_number}</button><StatusPill value={row.status} labels={piStatuses}/></div><h3>{row.product_name}</h3><p>{row.supplier}</p><dl><div><dt>Артикул</dt><dd>{row.article || '—'}</dd></div><div><dt>Сумма</dt><dd>{formatMoney(row.total_amount,row.currency)}</dd></div><div><dt>Дата</dt><dd>{formatDate(row.pi_date)}</dd></div></dl></article>)}</div>
      </>}
    </section>

    {editor && <Drawer wide title={editor.id ? `PI ${editor.pi_number}` : 'Новая PI'} subtitle={editor.id ? 'PI CARD' : 'CREATE PI'} onClose={() => setEditor(null)} footer={<><span className="footer-note">Файлы и изменения сохраняются в Supabase</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить PI</BusyButton></>}>
      <FormSection index="01" title="Документ и связь с запросом">
        <Field label="Номер PI *"><input value={editor.pi_number} onChange={event => setEditor({ ...editor, pi_number: event.target.value })}/></Field><Field label="Дата PI"><input type="date" value={editor.pi_date || ''} onChange={event => setEditor({ ...editor, pi_date: event.target.value })}/></Field>
        <Field label="Исходный запрос" wide><select value={editor.request_id || ''} onChange={event => selectRequest(event.target.value)}><option value="">Без связи с запросом</option>{requests.map(row => <option key={row.id} value={row.id}>{row.request_number} · {row.product_name}</option>)}</select></Field>
        <Field label="Поставщик *"><input value={editor.supplier} onChange={event => setEditor({ ...editor, supplier: event.target.value })}/></Field><Field label="Ответственный"><input value={editor.responsible} onChange={event => setEditor({ ...editor, responsible: event.target.value })}/></Field>
        <Field label="Товар *" wide><input value={editor.product_name} onChange={event => setEditor({ ...editor, product_name: event.target.value })}/></Field><Field label="Артикул"><input value={editor.article} onChange={event => setEditor({ ...editor, article: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="02" title="Количество и условия">
        <Field label="Количество"><input type="number" min="0" step="0.01" value={editor.quantity ?? ''} onChange={event => setEditor({ ...editor, quantity: event.target.value, total_amount: Number(event.target.value || 0) * Number(editor.unit_price || 0) || '' })}/></Field>
        <Field label="Цена за единицу"><input type="number" min="0" step="0.01" value={editor.unit_price ?? ''} onChange={event => setEditor({ ...editor, unit_price: event.target.value, total_amount: Number(editor.quantity || 0) * Number(event.target.value || 0) || '' })}/></Field>
        <Field label="Общая сумма"><input type="number" min="0" step="0.01" value={editor.total_amount ?? ''} onChange={event => setEditor({ ...editor, total_amount: event.target.value })}/></Field><Field label="Валюта"><select value={editor.currency} onChange={event => setEditor({ ...editor, currency: event.target.value })}>{currencies.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Условия оплаты" wide><input value={editor.payment_terms} onChange={event => setEditor({ ...editor, payment_terms: event.target.value })}/></Field><Field label="Срок производства, дней"><input type="number" min="0" value={editor.production_days ?? ''} onChange={event => setEditor({ ...editor, production_days: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="03" title="Характеристики">
        <Field label="Характеристики" wide><textarea rows="4" value={editor.characteristics} onChange={event => setEditor({ ...editor, characteristics: event.target.value })}/></Field><Field label="Упаковка"><input value={editor.packaging} onChange={event => setEditor({ ...editor, packaging: event.target.value })}/></Field><Field label="Размеры"><input value={editor.dimensions} onChange={event => setEditor({ ...editor, dimensions: event.target.value })}/></Field><Field label="Вес"><input value={editor.weight} onChange={event => setEditor({ ...editor, weight: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="04" title="Статус PI и контрольные даты">
        <Field label="Статус PI"><select value={editor.status} onChange={event => updateStatus(event.target.value)}>{Object.entries(piStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Дата запроса"><input type="date" value={editor.requested_at || ''} onChange={event => setEditor({ ...editor, requested_at: event.target.value })}/></Field><Field label="Подтверждение характеристик"><input type="date" value={editor.confirmed_at || ''} onChange={event => setEditor({ ...editor, confirmed_at: event.target.value || null })}/></Field><Field label="Дата подписания"><input type="date" value={editor.signed_at || ''} onChange={event => setEditor({ ...editor, signed_at: event.target.value || null })}/></Field><Field label="Передача в ВЭД"><input type="date" value={editor.ved_at || ''} onChange={event => setEditor({ ...editor, ved_at: event.target.value || null })}/></Field>
      </FormSection>
      {editor.status === 'ved' && <FormSection index="05" title="Отправлено в ВЭД" text="Каждое письмо отмечается отдельно.">
        <label className="check-card wide-field"><input type="checkbox" checked={editor.tnved_email_sent} onChange={event => toggleMail('tnved_email_sent', event.target.checked)}/><span><b>Письмо на определение кода ТН ВЭД</b><small>Отдельная контрольная отметка</small></span></label><Field label="Дата отправки"><input type="date" value={editor.tnved_email_sent_at || ''} onChange={event => setEditor({ ...editor, tnved_email_sent_at: event.target.value || null })}/></Field>
        <label className="check-card wide-field"><input type="checkbox" checked={editor.nomenclature_email_sent} onChange={event => toggleMail('nomenclature_email_sent', event.target.checked)}/><span><b>Письмо на создание номенклатуры</b><small>Не зависит от письма на код ТН ВЭД</small></span></label><Field label="Дата отправки"><input type="date" value={editor.nomenclature_email_sent_at || ''} onChange={event => setEditor({ ...editor, nomenclature_email_sent_at: event.target.value || null })}/></Field>
      </FormSection>}
      <FormSection index={editor.status === 'ved' ? '06' : '05'} title="Документы и комментарий"><Field label="Файл PI и дополнительные документы" wide><FileList files={editor.attachments} onChange={attachments => setEditor({ ...editor, attachments })} folder="pi" userId={session.user.id} disabled={!editable}/></Field><Field label="Комментарий" wide><textarea rows="4" value={editor.comment} onChange={event => setEditor({ ...editor, comment: event.target.value })}/></Field></FormSection>
      {editor.id && <div className="linked-actions"><span>Связанные записи</span>{editor.request_id && <button onClick={() => onOpenRequest(editor.request_id)}><ClipboardList/> Открыть исходный запрос</button>}<button onClick={() => onCreateLogistics(editor)}><Truck/> Передать в логистику</button></div>}
    </Drawer>}
  </div>
}
