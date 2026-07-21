import * as XLSX from 'xlsx'

const ROOT_SELECTOR = '.requests-modern'
const TOOL_ID = 'analytics-split-tool-v1'
let busy = false

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

const icon = name => {
  const paths = {
    split:'<path d="M7 3v5c0 2 2 3 4 3h6"/><path d="m14 8 3 3-3 3"/><path d="M7 21v-5c0-2 2-3 4-3h6"/><path d="m14 10 3 3-3 3"/>',
    upload:'<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    file:'<path d="M4 3h11l5 5v13H4z"/><path d="M15 3v5h5"/>',
    check:'<path d="m5 12 4 4L19 6"/>'
  }
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.file}</svg>`
}

function safeName(value) {
  return String(value || 'Категория').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80) || 'Категория'
}

function readSource(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header:1,defval:'',raw:false})
    const headerRow = rows.findIndex(row => row.some(cell => String(cell).trim() === 'Ссылка на товар'))
    if (headerRow < 0) continue
    const headers = rows[headerRow].map(cell => String(cell).trim())
    const linkCol = headers.indexOf('Ссылка на товар')
    const categoryCol = headers.indexOf('Категория 3 уровня')
    let fallback = ''
    for (let i=0;i<headerRow;i++) {
      const label = rows[i].findIndex(cell => String(cell).trim() === 'Категория 3 уровня:')
      if (label >= 0) fallback = String(rows[i][label+1] || '').trim()
    }
    const items = rows.slice(headerRow+1).map(row => ({
      link:String(row[linkCol]||'').trim(),
      category:String(row[categoryCol]||fallback).trim() || fallback
    })).filter(item => /^https?:\/\//i.test(item.link)).slice(0,30)
    if (items.length) return {items,fallback}
  }
  throw new Error('Не найдена колонка «Ссылка на товар».')
}

function makeWorkbook(links) {
  const rows = instructions.map(row => [...row])
  links.forEach(link => rows.push([link]))
  while (rows.length < 17) rows.push([])
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  links.forEach((link,index) => {
    const address = `A${10+index}`
    sheet[address].l = {Target:link,Tooltip:'Открыть товар'}
  })
  sheet['!cols'] = [{wch:95},{wch:24},{wch:18},{wch:18},{wch:26},{wch:24},{wch:20},{wch:14},{wch:16},{wch:18},{wch:14},{wch:18},{wch:12},{wch:12},{wch:12},{wch:8}]
  sheet['!rows'] = [{hpt:22},{hpt:22},{hpt:22},{hpt:35},{hpt:35},{hpt:35},{hpt:28},{hpt:10},{hpt:30}]
  sheet['!autofilter'] = {ref:'A9:O14'}
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book,sheet,'Лист1')
  return XLSX.write(book,{bookType:'xlsx',type:'array',compression:true})
}

async function createArchive(file) {
  const source = XLSX.read(await file.arrayBuffer(),{type:'array'})
  const {items,fallback} = readSource(source)
  if (items.length < 30) throw new Error(`В файле найдено только ${items.length} ссылок. Нужно минимум 30.`)
  const category = safeName(items[0]?.category || fallback)
  const {zipSync,strToU8} = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js')
  const files = {}
  for (let group=0;group<6;group++) {
    const links = items.slice(group*5,group*5+5).map(item => item.link)
    files[`${category}_${String(group+1).padStart(2,'0')}.xlsx`] = new Uint8Array(makeWorkbook(links))
  }
  files['README.txt'] = strToU8(`Категория: ${category}\nПервые 30 ссылок\n6 файлов по 5 ссылок`,true)
  const archive = zipSync(files,{level:6})
  const url = URL.createObjectURL(new Blob([archive],{type:'application/zip'}))
  const anchor = document.createElement('a')
  anchor.href=url
  anchor.download=`${category}_6_файлов.zip`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
  return category
}

function renderTool() {
  const root=document.querySelector(ROOT_SELECTOR)
  if(!root || document.getElementById(TOOL_ID)) return
  const tool=document.createElement('div')
  tool.id=TOOL_ID
  tool.innerHTML=`<button type="button" class="analytics-split-button" data-split-action="open">${icon('split')} Разбить аналитический файл</button><input type="file" hidden accept=".xlsx,.xls" data-split-input>`
  root.querySelector('.register-head')?.append(tool)
}

function openModal() {
  const root=document.querySelector(ROOT_SELECTOR)
  if(!root || document.querySelector('.analytics-split-modal')) return
  document.body.insertAdjacentHTML('beforeend',`<div class="analytics-split-backdrop" data-split-action="close"></div><aside class="analytics-split-modal"><header><div><small>EXCEL CONVERTER</small><h2>Разбить аналитику</h2><p>Первые 30 ссылок → 6 файлов по 5 ссылок.</p></div><button type="button" data-split-action="close">${icon('close')}</button></header><section><div class="analytics-split-rule"><b>1</b><span><strong>Загрузите аналитический отчёт</strong><small>Нужны колонки «Ссылка на товар» и «Категория 3 уровня».</small></span></div><div class="analytics-split-rule"><b>2</b><span><strong>Система возьмёт первые 30 ссылок</strong><small>Порядок строк сохраняется.</small></span></div><div class="analytics-split-rule"><b>3</b><span><strong>Скачаете ZIP с 6 файлами</strong><small>В каждом Excel-файле ровно 5 ссылок.</small></span></div><div class="analytics-split-status" data-split-status></div></section><footer><button type="button" class="analytics-secondary" data-split-action="close">Отмена</button><button type="button" class="analytics-primary" data-split-action="choose">${icon('upload')} Выбрать Excel</button></footer></aside>`)
}

function closeModal() { document.querySelector('.analytics-split-backdrop')?.remove(); document.querySelector('.analytics-split-modal')?.remove() }
function setStatus(text,tone='info') { const node=document.querySelector('[data-split-status]'); if(!node)return; node.className=`analytics-split-status ${tone}`; node.innerHTML=text?`${tone==='success'?icon('check'):icon('file')}<span>${text}</span>`:'' }
async function handleFile(file) { if(!file||busy)return; busy=true; setStatus('Создаю 6 Excel-файлов…'); try { const category=await createArchive(file); setStatus(`Готово. Архив «${category}_6_файлов.zip» скачан.`,'success') } catch(error) { console.error(error); setStatus(error?.message||'Не удалось обработать файл.','error') } finally { busy=false; const input=document.querySelector('[data-split-input]'); if(input)input.value='' } }

document.addEventListener('click',event=>{ const node=event.target.closest('[data-split-action]'); if(!node)return; const action=node.dataset.splitAction; if(action==='open')openModal(); if(action==='close')closeModal(); if(action==='choose')document.querySelector('[data-split-input]')?.click() },true)
document.addEventListener('change',event=>{ if(event.target.matches('[data-split-input]'))handleFile(event.target.files?.[0]) },true)
new MutationObserver(renderTool).observe(document.getElementById('root')||document.body,{childList:true,subtree:true})
renderTool()
