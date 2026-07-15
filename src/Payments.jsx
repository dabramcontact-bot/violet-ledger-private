import React, { useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2, WalletCards } from 'lucide-react'
import { canEdit, currencies, deleteRow, exportExcel, formatDate, formatMoney, loadRows, number, paymentStatuses, saveRow, text, today, uid } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FileList, FormSection, PageHeader, SearchBox, StatusPill } from './components'

const blank = seed => ({
  payment_number: uid('PAY'), pi_id: seed?.id || null, pi_number: seed?.pi_number || '', supplier_name: seed?.supplier || '', product_name: seed?.product_name || '',
  purpose: '', amount: seed?.total_amount || '', currency: seed?.currency || 'CNY', due_date: '', paid_at: '', percent_of_order: '', status: 'planned',
  payment_reference: '', responsible: seed?.responsible || '', notes: '', attachments: []
})
function normalize(row) { return { ...blank(), ...row, attachments: Array.isArray(row.attachments) ? row.attachments : [] } }

export default function Payments({ profile, session, signal, initialFilter, onOpenPI }) {
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
    try { const [paymentRows, piRows] = await Promise.all([loadRows('payments'), loadRows('pi_records')]); setRows(paymentRows.map(normalize)); setPis(piRows) }
    catch (reason) { setError(reason) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (signal?.type === 'payments') setEditor(blank(signal.seed)) }, [signal])
  useEffect(() => { if (signal?.type === 'open-payments' && rows.length) { const row = rows.find(item => item.id === signal.id); if (row) setEditor(normalize(row)) } }, [signal, rows])
  useEffect(() => { if (initialFilter?.status) setStatus(initialFilter.status) }, [initialFilter])

  const filtered = useMemo(() => rows.filter(row => (!query || [row.payment_number,row.pi_number,row.supplier_name,row.product_name,row.purpose].join(' ').toLowerCase().includes(query.toLowerCase())) && (status === 'all' || row.status === status)), [rows,query,status])
  const paid = editor ? Number(editor.amount || 0) * Number(editor.percent_of_order || 0) / 100 : 0

  function selectPI(id) {
    const source = pis.find(item => item.id === id)
    if (!source) { setEditor({ ...editor, pi_id: null }); return }
    setEditor(current => ({ ...current, pi_id: source.id, pi_number: source.pi_number, supplier_name: source.supplier, product_name: source.product_name, amount: source.total_amount || current.amount, currency: source.currency || current.currency, responsible: source.responsible || current.responsible }))
  }
  function updatePercent(value) {
    const percent = Number(value || 0)
    const next = percent >= 100 ? 'paid' : percent > 0 ? 'partial' : editor.status === 'cancelled' ? 'cancelled' : 'planned'
    setEditor({ ...editor, percent_of_order: value, status: next, paid_at: percent >= 100 ? editor.paid_at || today() : editor.paid_at })
  }
  async function save() {
    if (!text(editor.payment_number) || !text(editor.pi_number) || !text(editor.supplier_name)) { setError('Заполните номер платежа, PI и поставщика.'); return }
    if (!(Number(editor.amount) > 0)) { setError('Сумма платежа должна быть больше нуля.'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...editor, payment_number: text(editor.payment_number), pi_number: text(editor.pi_number), request_number: text(editor.pi_number), supplier_name: text(editor.supplier_name), product_name: text(editor.product_name), purpose: text(editor.purpose), amount: number(editor.amount), percent_of_order: number(editor.percent_of_order) || 0, payment_reference: text(editor.payment_reference), responsible: text(editor.responsible), notes: text(editor.notes), payment_type: 'prepayment', paid_amount: paid, fee_amount: 0, deferral_days: 0, submission_lead_days: 15 }
      const saved = normalize(await saveRow('payments', payload, session.user.id)); setRows(current => [saved, ...current.filter(row => row.id !== saved.id)]); setEditor(null)
    } catch (reason) { setError(reason) } finally { setSaving(false) }
  }
  async function remove(row) {
    if (!window.confirm(`Удалить платёж ${row.payment_number}? PI останется в системе.`)) return
    try { await deleteRow('payments', row.id); setRows(current => current.filter(item => item.id !== row.id)); setEditor(null) } catch (reason) { setError(reason) }
  }
  function exportRows() {
    exportExcel('Payments', filtered, [
      ['payment_number','Номер платежа'], ['pi_number','Номер PI'], ['supplier_name','Поставщик'], ['product_name','Товар'], ['purpose','Назначение'],
      ['amount','Сумма'], ['currency','Валюта'], ['due_date','Плановая дата',formatDate], ['paid_at','Фактическая дата',formatDate],
      ['percent_of_order','Процент оплаты'], ['paid_amount','Оплачено', (_,row) => Number(row.amount || 0) * Number(row.percent_of_order || 0) / 100],
      ['status','Статус', value => paymentStatuses[value]], ['payment_reference','Платёжный документ'], ['responsible','Ответственный'], ['notes','Комментарий']
    ])
  }

  return <div className="page">
    <PageHeader eyebrow="PAYMENT REGISTER" title="Платежи" description="Плановые и фактические оплаты, связанные с PI и поставщиками." action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить платёж" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>
    <section className="metric-strip five">{Object.entries(paymentStatuses).map(([key,label]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key ? 'all' : key)}><small>{label}</small><b>{rows.filter(row => row.status === key).length}</b></button>)}</section>
    <section className="register-panel">
      <div className="register-head"><div><small>FINANCE REGISTER</small><h2>Платежи по PI</h2><p>{filtered.length} из {rows.length}</p></div><button className="secondary" onClick={exportRows}><Download/> Экспорт в Excel</button></div>
      <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Номер платежа, PI, поставщик или товар"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(paymentStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {loading ? <div className="loading-state">Загрузка платежей…</div> : !filtered.length ? <EmptyState icon={WalletCards} title="Платежи не найдены" text={rows.length ? 'Измените фильтры.' : 'Создайте первый платёж.'} action={editable ? () => setEditor(blank()) : null} actionLabel="Добавить платёж"/> : <>
        <div className="data-table"><table><thead><tr><th>Платёж / PI</th><th>Поставщик</th><th>Назначение</th><th>Сумма</th><th>Даты</th><th>Статус</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}>
          <td><button className="table-link" onClick={() => setEditor(normalize(row))}>{row.payment_number}</button><b>PI {row.pi_number}</b><small>{row.product_name || 'Товар не указан'}</small></td><td>{row.supplier_name}</td><td>{row.purpose || '—'}</td><td><b>{formatMoney(row.amount,row.currency)}</b><small>{row.percent_of_order || 0}% · оплачено {formatMoney(Number(row.amount || 0) * Number(row.percent_of_order || 0) / 100,row.currency)}</small></td><td><b>{formatDate(row.due_date)}</b><small>Факт: {formatDate(row.paid_at)}</small></td><td><StatusPill value={row.status} labels={paymentStatuses}/></td><td><div className="row-actions"><button onClick={() => setEditor(normalize(row))}><Pencil/></button>{editable && <button className="danger" onClick={() => remove(row)}><Trash2/></button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="mobile-cards">{filtered.map(row => <article key={row.id} onClick={() => setEditor(normalize(row))}><div><button>{row.payment_number}</button><StatusPill value={row.status} labels={paymentStatuses}/></div><h3>PI {row.pi_number}</h3><p>{row.supplier_name}</p><dl><div><dt>Сумма</dt><dd>{formatMoney(row.amount,row.currency)}</dd></div><div><dt>Оплачено</dt><dd>{row.percent_of_order || 0}%</dd></div><div><dt>Срок</dt><dd>{formatDate(row.due_date)}</dd></div></dl></article>)}</div>
      </>}
    </section>

    {editor && <Drawer wide title={editor.id ? editor.payment_number : 'Новый платёж'} subtitle={editor.id ? 'PAYMENT CARD' : 'CREATE PAYMENT'} onClose={() => setEditor(null)} footer={<><span className="footer-note">Платёж не меняет статус запроса</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Платёж и PI">
        <Field label="Номер платежа *"><input value={editor.payment_number} onChange={event => setEditor({ ...editor, payment_number: event.target.value })}/></Field><Field label="Связать с PI"><select value={editor.pi_id || ''} onChange={event => selectPI(event.target.value)}><option value="">Без связи</option>{pis.map(pi => <option key={pi.id} value={pi.id}>{pi.pi_number} · {pi.product_name}</option>)}</select></Field><Field label="Номер PI *"><input value={editor.pi_number} onChange={event => setEditor({ ...editor, pi_number: event.target.value })}/></Field><Field label="Поставщик *"><input value={editor.supplier_name} onChange={event => setEditor({ ...editor, supplier_name: event.target.value })}/></Field><Field label="Товар"><input value={editor.product_name} onChange={event => setEditor({ ...editor, product_name: event.target.value })}/></Field><Field label="Ответственный"><input value={editor.responsible} onChange={event => setEditor({ ...editor, responsible: event.target.value })}/></Field><Field label="Назначение платежа" wide><input value={editor.purpose} onChange={event => setEditor({ ...editor, purpose: event.target.value })}/></Field>
      </FormSection>
      <FormSection index="02" title="Сумма и даты">
        <Field label="Сумма *"><input type="number" min="0.01" step="0.01" value={editor.amount ?? ''} onChange={event => setEditor({ ...editor, amount: event.target.value })}/></Field><Field label="Валюта"><select value={editor.currency} onChange={event => setEditor({ ...editor, currency: event.target.value })}>{currencies.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Плановая дата"><input type="date" value={editor.due_date || ''} onChange={event => setEditor({ ...editor, due_date: event.target.value || null })}/></Field><Field label="Фактическая дата"><input type="date" value={editor.paid_at || ''} onChange={event => setEditor({ ...editor, paid_at: event.target.value || null })}/></Field><Field label="Процент оплаты"><input type="number" min="0" max="100" step="0.01" value={editor.percent_of_order ?? ''} onChange={event => updatePercent(event.target.value)}/></Field><Field label="Статус"><select value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value })}>{Object.entries(paymentStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><div className="calculated-card"><small>Оплачено</small><b>{formatMoney(paid,editor.currency)}</b></div><div className="calculated-card violet"><small>Остаток</small><b>{formatMoney(Math.max(0,Number(editor.amount || 0)-paid),editor.currency)}</b></div>
      </FormSection>
      <FormSection index="03" title="Документ и комментарий"><Field label="Номер / реквизиты документа" wide><input value={editor.payment_reference} onChange={event => setEditor({ ...editor, payment_reference: event.target.value })}/></Field><Field label="Платёжный документ" wide><FileList files={editor.attachments} onChange={attachments => setEditor({ ...editor, attachments })} folder="payments" userId={session.user.id} disabled={!editable}/></Field><Field label="Комментарий" wide><textarea rows="4" value={editor.notes} onChange={event => setEditor({ ...editor, notes: event.target.value })}/></Field></FormSection>
      {editor.pi_id && <div className="linked-actions"><span>Связанные записи</span><button onClick={() => onOpenPI(editor.pi_id)}><WalletCards/> Открыть PI</button></div>}
    </Drawer>}
  </div>
}
