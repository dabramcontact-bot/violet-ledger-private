import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { CheckCircle2, FileArchive, Split, Upload, X } from 'lucide-react'
import './analytics-split-export.css'

const instructions = [
  ['instructions for working with the search task '],
  ['1) always put a link from the file against the analogue proposal'],
  ['2) characteristics should be as identical as possible'],
  ['3) the dimensions of the individual packaging and transport packaging must always be available. '],
  ['4) If additional costs are planned for the goods, please specify them separately or include them in the price. '],
  ["5) If we can't find the same one, we ask if the factory can make it, if the factory can make it, we take the price from the factory."],
  ['Very please Check the specifications that you are given with what I ask from you'],
  [],
  ['product link ','Company name','Item no.','OUR PIC','DES','Individual package size','CARTON SIZE','Price ','pieces per box','MATERIAL','COLOR','PACKAGE','UNIT','CBM','MOQ','']
]

const safeName = value => String(value || 'Категория')
  .replace(/[\\/:*?"<>|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80) || 'Категория'

function readSource(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false })
    const headerRow = rows.findIndex(row => row.some(cell => String(cell).trim() === 'Ссылка на товар'))
    if (headerRow < 0) continue
    const headers = rows[headerRow].map(cell => String(cell).trim())
    const linkCol = headers.indexOf('Ссылка на товар')
    const categoryCol = headers.indexOf('Категория 3 уровня')
    let fallback = ''
    for (let index = 0; index < headerRow; index += 1) {
      const label = rows[index].findIndex(cell => String(cell).trim() === 'Категория 3 уровня:')
      if (label >= 0) fallback = String(rows[index][label + 1] || '').trim()
    }
    const items = rows.slice(headerRow + 1)
      .map(row => ({
        link: String(row[linkCol] || '').trim(),
        category: String(row[categoryCol] || fallback).trim() || fallback
      }))
      .filter(item => /^https?:\/\//i.test(item.link))
      .slice(0, 30)
    if (items.length) return { items, fallback }
  }
  throw new Error('Не найдена колонка «Ссылка на товар».')
}

function makeWorkbook(links) {
  const rows = instructions.map(row => [...row])
  links.forEach(link => rows.push([link]))
  while (rows.length < 17) rows.push([])
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  links.forEach((link, index) => {
    const address = `A${10 + index}`
    sheet[address].l = { Target: link, Tooltip: 'Открыть товар' }
  })
  sheet['!cols'] = [
    { wch: 95 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }
  ]
  sheet['!rows'] = [{ hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 35 }, { hpt: 35 }, { hpt: 35 }, { hpt: 28 }, { hpt: 10 }, { hpt: 30 }]
  sheet['!autofilter'] = { ref: 'A9:O14' }
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Лист1')
  return XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true })
}

async function buildArchive(file) {
  const source = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const { items, fallback } = readSource(source)
  if (items.length < 30) throw new Error(`В файле найдено только ${items.length} ссылок. Нужно минимум 30.`)
  const category = safeName(items[0]?.category || fallback)
  const { zipSync, strToU8 } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js')
  const files = {}
  for (let group = 0; group < 6; group += 1) {
    const links = items.slice(group * 5, group * 5 + 5).map(item => item.link)
    files[`${category}_${String(group + 1).padStart(2, '0')}.xlsx`] = new Uint8Array(makeWorkbook(links))
  }
  files['README.txt'] = strToU8(`Категория: ${category}\nПервые 30 ссылок\n6 файлов по 5 ссылок`, true)
  return { category, archive: zipSync(files, { level: 6 }) }
}

export default function AnalyticsSplitExport() {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  async function process(file) {
    if (!file || busy) return
    setBusy(true)
    setStatus({ tone: 'info', text: 'Создаю 6 Excel-файлов…' })
    try {
      const { category, archive } = await buildArchive(file)
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${category}_6_файлов.zip`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ tone: 'success', text: `Готово: ${category}_6_файлов.zip` })
    } catch (error) {
      console.error(error)
      setStatus({ tone: 'error', text: error?.message || 'Не удалось обработать файл.' })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <>
    <button className="secondary split-export-trigger" type="button" onClick={() => { setOpen(true); setStatus(null) }}><Split/> Разбить файл</button>
    <input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={event => process(event.target.files?.[0])}/>
    {open && <div className="split-export-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false) }}>
      <aside className="split-export-drawer" role="dialog" aria-modal="true" aria-label="Разбить аналитический файл">
        <header><div><small>EXCEL CONVERTER</small><h2>Разбить аналитику</h2><p>Первые 30 ссылок → 6 файлов по 5 ссылок.</p></div><button type="button" disabled={busy} onClick={() => setOpen(false)}><X/></button></header>
        <section>
          <div className="split-export-rule"><b>1</b><span><strong>Загрузите аналитический отчёт</strong><small>Нужны колонки «Ссылка на товар» и «Категория 3 уровня».</small></span></div>
          <div className="split-export-rule"><b>2</b><span><strong>Берутся первые 30 ссылок</strong><small>Порядок строк из исходной таблицы сохраняется.</small></span></div>
          <div className="split-export-rule"><b>3</b><span><strong>Создаются 6 файлов</strong><small>В каждом документе ровно 5 ссылок и структура второго файла-шаблона.</small></span></div>
          {status && <div className={`split-export-status ${status.tone}`}>{status.tone === 'success' ? <CheckCircle2/> : <FileArchive/>}<span>{status.text}</span></div>}
        </section>
        <footer><button className="secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Закрыть</button><button className="primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><Upload/> {busy ? 'Обработка…' : 'Выбрать Excel'}</button></footer>
      </aside>
    </div>}
  </>
}
