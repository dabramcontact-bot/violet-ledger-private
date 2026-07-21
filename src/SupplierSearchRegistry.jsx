import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { CalendarDays, CheckCircle2, Download, ExternalLink, FileArchive, Layers3, Pencil, Send, Trash2, Upload, UserRound } from 'lucide-react'
import { canEdit, formatDate, supabase, text, today } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FormSection, SearchBox, StatusPill } from './components'
import './supplier-search-registry.css'

const TABLE = 'supplier_search_batches'
const PACKAGE_SIZE = 5
const PACKAGE_COUNT = 6
const LINK_LIMIT = PACKAGE_SIZE * PACKAGE_COUNT

const statusLabels = {
  not_sent: 'Не отправлено',
  sent: 'Отправлено',
  response_received: 'Ответ получен'
}

const templateRows = [
  ['instructions for working with the search task '],
  ['1) always put a link from the file against the analogue proposal'],
  ['2) characteristics should be as identical as possible'],
  ['3) the dimensions of the individual packaging and transport packaging must always be available. '],
  ['4) If additional costs are planned for the goods, please specify them separately or include them in the price. '],
  ["5) If we can't find the same one, we ask if the factory can make it, if the factory can make it, we take the price from the factory."],
  ['Very please Check the specifications that you are given with what I ask from you'],
  [],
  ['product link ', 'Company name', 'Item no.', 'OUR PIC', 'DES', 'Individual package size', 'CARTON SIZE', 'Price ', 'pieces per box', 'MATERIAL', 'COLOR', 'PACKAGE', 'UNIT', 'CBM', 'MOQ', '']
]

const safeFileName = value => text(value || 'Категория')
  .replace(/[\\/:*?"<>|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .slice(0, 80) || 'Категория'

function parseAnalyticsFile(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
    const headerIndex = rows.findIndex(row => row.some(cell => text(cell) === 'Ссылка на товар'))
    if (headerIndex < 0) continue

    const headers = rows[headerIndex].map(text)
    const linkColumn = headers.indexOf('Ссылка на товар')
    const categoryColumn = headers.indexOf('Категория 3 уровня')
    let fallbackCategory = ''

    for (let index = 0; index < headerIndex; index += 1) {
      const labelIndex = rows[index].findIndex(cell => text(cell) === 'Категория 3 уровня:')
      if (labelIndex >= 0) fallbackCategory = text(rows[index][labelIndex + 1])
    }

    const items = rows.slice(headerIndex + 1)
      .map(row => ({
        link: text(row[linkColumn]),
        category: text(row[categoryColumn]) || fallbackCategory
      }))
      .filter(item => /^https?:\/\//i.test(item.link))
      .slice(0, LINK_LIMIT)

    if (items.length) {
      return {
        items,
        category: safeFileName(fallbackCategory || items.find(item => item.category)?.category)
      }
    }
  }

  throw new Error('Не найдена колонка «Ссылка на товар».')
}

function createPackageWorkbook(links) {
  const rows = templateRows.map(row => [...row])
  links.slice(0, PACKAGE_SIZE).forEach(link => rows.push([link]))
  const sheet = XLSX.utils.aoa_to_sheet(rows)

  links.slice(0, PACKAGE_SIZE).forEach((link, index) => {
    const address = `A${10 + index}`
    if (sheet[address]) sheet[address].l = { Target: link, Tooltip: 'Открыть товар' }
  })

  sheet['!cols'] = [
    { wch: 95 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }
  ]
  sheet['!rows'] = [{ hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 35 }, { hpt: 35 }, { hpt: 35 }, { hpt: 28 }, { hpt: 10 }, { hpt: 30 }]
  sheet['!autofilter'] = { ref: 'A9:O14' }

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Лист1')
  return book
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadPackage(row) {
  const book = createPackageWorkbook(Array.isArray(row.links) ? row.links : [])
  XLSX.writeFile(book, `${safeFileName(row.batch_name)}.xlsx`, { compression: true })
}

async function downloadImport(rows) {
  const { zipSync } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js')
  const files = {}
  rows.forEach(row => {
    const data = XLSX.write(createPackageWorkbook(row.links || []), { bookType: 'xlsx', type: 'array', compression: true })
    files[`${safeFileName(row.batch_name)}.xlsx`] = new Uint8Array(data)
  })
  const category = safeFileName(rows[0]?.category_level_3)
  downloadBlob(new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }), `${category}_6_файлов.zip`)
}

export default function SupplierSearchRegistry({ profile, session, suppliers = [] }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [editor, setEditor] = useState(null)
  const editable = canEdit(profile)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).order('batch_number', { ascending: true })
      if (loadError) throw loadError
      setRows(data || [])
    } catch (reason) {
      setError(reason)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('supplier-search-batches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = useMemo(() => rows.filter(row => {
    const haystack = [row.batch_name, row.category_level_3, row.source_file_name, row.supplier_name].join(' ').toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (status === 'all' || row.status === status)
  }), [rows, query, status])

  const imports = useMemo(() => {
    const groups = new Map()
    filtered.forEach(row => {
      if (!groups.has(row.import_id)) groups.set(row.import_id, { ...row, rows: [] })
      groups.get(row.import_id).rows.push(row)
    })
    return [...groups.values()].map(group => ({ ...group, rows: group.rows.sort((a, b) => a.batch_number - b.batch_number) }))
  }, [filtered])

  const summary = {
    total: rows.length,
    not_sent: rows.filter(row => row.status === 'not_sent').length,
    sent: rows.filter(row => row.status === 'sent').length,
    response_received: rows.filter(row => row.status === 'response_received').length
  }

  async function importFile(file) {
    if (!file || !editable) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const parsed = parseAnalyticsFile(workbook)
      if (parsed.items.length < LINK_LIMIT) throw new Error(`В файле найдено только ${parsed.items.length} ссылок. Нужно минимум ${LINK_LIMIT}.`)

      const importId = crypto.randomUUID()
      const payload = Array.from({ length: PACKAGE_COUNT }, (_, index) => {
        const links = parsed.items.slice(index * PACKAGE_SIZE, index * PACKAGE_SIZE + PACKAGE_SIZE).map(item => item.link)
        return {
          import_id: importId,
          category_level_3: parsed.category,
          batch_number: index + 1,
          batch_name: `${parsed.category}_${String(index + 1).padStart(2, '0')}`,
          links,
          source_file_name: file.name,
          supplier_name: '',
          sent_at: null,
          status: 'not_sent',
          notes: '',
          created_by: session.user.id,
          updated_by: session.user.id
        }
      })

      const { error: insertError } = await supabase.from(TABLE).insert(payload)
      if (insertError) throw insertError
      setSuccess(`Сохранено 6 файлов по категории «${parsed.category}». Теперь можно назначить поставщиков.`)
      await load()
    } catch (reason) {
      setError(reason)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function saveEditor() {
    if (!editor || !editable) return
    setSaving(true)
    setError('')
    try {
      const nextStatus = editor.status || 'not_sent'
      const payload = {
        supplier_name: text(editor.supplier_name),
        sent_at: nextStatus === 'not_sent' ? null : (editor.sent_at || today()),
        status: nextStatus,
        notes: text(editor.notes),
        updated_by: session.user.id
      }
      const { data, error: saveError } = await supabase.from(TABLE).update(payload).eq('id', editor.id).select().single()
      if (saveError) throw saveError
      setRows(current => current.map(row => row.id === data.id ? data : row))
      setEditor(null)
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }

  async function removeImport(group) {
    if (!editable || !window.confirm(`Удалить все 6 файлов подборки «${group.category_level_3}»?`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from(TABLE).delete().eq('import_id', group.import_id)
      if (deleteError) throw deleteError
      setRows(current => current.filter(row => row.import_id !== group.import_id))
    } catch (reason) {
      setError(reason)
    }
  }

  return <section className="supplier-search-registry">
    <ErrorBanner error={error} onClose={() => setError('')}/>
    {success && <div className="supplier-search-success"><CheckCircle2/><span>{success}</span><button onClick={() => setSuccess('')}>×</button></div>}

    <section className="supplier-search-intro">
      <div><small>SUPPLIER SEARCH PACKAGES</small><h2>Подборы поставщикам</h2><p>Загрузите аналитику один раз. Система сохранит первые 30 ссылок как 6 рабочих файлов по 5 ссылок.</p></div>
      {editable && <BusyButton className="primary" busy={uploading} onClick={() => fileRef.current?.click()}><Upload/> Загрузить аналитику</BusyButton>}
      <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={event => importFile(event.target.files?.[0])}/>
    </section>

    <section className="supplier-search-metrics">
      <article><Layers3/><span><small>Всего файлов</small><b>{summary.total}</b></span></article>
      <article><FileArchive/><span><small>Не отправлено</small><b>{summary.not_sent}</b></span></article>
      <article><Send/><span><small>Отправлено</small><b>{summary.sent}</b></span></article>
      <article><CheckCircle2/><span><small>Ответ получен</small><b>{summary.response_received}</b></span></article>
    </section>

    <section className="register-panel supplier-search-panel">
      <div className="register-head"><div><small>РЕЕСТР ПОДБОРОВ</small><h2>Файлы для отправки</h2><p>{filtered.length} из {rows.length}</p></div></div>
      <div className="filters"><SearchBox value={query} onChange={setQuery} placeholder="Категория, файл или поставщик"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>

      {loading ? <div className="loading-state">Загрузка подборов…</div> : !imports.length ? <EmptyState icon={FileArchive} title="Подборов пока нет" text={rows.length ? 'Измените поиск или статус.' : 'Загрузите аналитический Excel — система создаст шесть файлов.'} action={editable ? () => fileRef.current?.click() : null} actionLabel="Загрузить аналитику"/> : <div className="supplier-import-list">{imports.map(group => <section className="supplier-import" key={group.import_id}>
        <header><div><small>{group.source_file_name || 'Аналитический отчёт'}</small><h3>{group.category_level_3}</h3><p>{formatDate(String(group.created_at || '').slice(0, 10))} · 6 файлов · 30 ссылок</p></div><div className="supplier-import-actions"><button className="secondary" onClick={() => downloadImport(rows.filter(item => item.import_id === group.import_id).sort((a, b) => a.batch_number - b.batch_number)).catch(setError)}><Download/> Скачать все 6</button>{editable && <button className="icon-danger" title="Удалить подборку" onClick={() => removeImport(group)}><Trash2/></button>}</div></header>
        <div className="supplier-batch-grid">{group.rows.map(row => <article className="supplier-batch-card" key={row.id}>
          <div className="supplier-batch-head"><span><small>ФАЙЛ {String(row.batch_number).padStart(2, '0')}</small><b>{row.batch_name}</b></span><StatusPill value={row.status} labels={statusLabels}/></div>
          <ol>{(row.links || []).map((link, index) => <li key={link}><span>{index + 1}</span><a href={link} target="_blank" rel="noreferrer">{link}<ExternalLink/></a></li>)}</ol>
          <dl><div><dt><UserRound/> Поставщик</dt><dd>{row.supplier_name || 'Не назначен'}</dd></div><div><dt><CalendarDays/> Отправлено</dt><dd>{formatDate(row.sent_at)}</dd></div></dl>
          <footer><button className="secondary" onClick={() => downloadPackage(row)}><Download/> Excel</button>{editable && <button className="primary-soft" onClick={() => setEditor({ ...row })}><Pencil/> Назначить</button>}</footer>
        </article>)}</div>
      </section>)}</div>}
    </section>

    {editor && <Drawer title={editor.batch_name} subtitle="НАЗНАЧЕНИЕ ПОСТАВЩИКУ" onClose={() => setEditor(null)} footer={<><button className="secondary" onClick={() => setEditor(null)}>Отмена</button><BusyButton className="primary" busy={saving} onClick={saveEditor}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Отправка файла" text="Поставщика и статус вы отмечаете вручную.">
        <Field label="Поставщик" wide><input list="supplier-search-options" value={editor.supplier_name || ''} onChange={event => setEditor({ ...editor, supplier_name: event.target.value })} placeholder="Выберите или введите поставщика"/><datalist id="supplier-search-options">{suppliers.map(item => <option key={item} value={item}/>)}</datalist></Field>
        <Field label="Статус"><select value={editor.status || 'not_sent'} onChange={event => setEditor({ ...editor, status: event.target.value, sent_at: event.target.value === 'not_sent' ? '' : (editor.sent_at || today()) })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Дата отправки"><input type="date" disabled={editor.status === 'not_sent'} value={editor.sent_at || ''} onChange={event => setEditor({ ...editor, sent_at: event.target.value })}/></Field>
        <Field label="Комментарий" wide><textarea rows="4" value={editor.notes || ''} onChange={event => setEditor({ ...editor, notes: event.target.value })} placeholder="Например, отправлено в WeChat, ждём цену до пятницы"/></Field>
      </FormSection>
      <FormSection index="02" title="Ссылки в файле" text="Ровно пять позиций из исходного отчёта.">
        <div className="supplier-drawer-links wide-field">{(editor.links || []).map((link, index) => <a key={link} href={link} target="_blank" rel="noreferrer"><span>{index + 1}</span><b>{link}</b><ExternalLink/></a>)}</div>
      </FormSection>
    </Drawer>}
  </section>
}
