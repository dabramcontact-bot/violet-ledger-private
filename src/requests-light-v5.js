const BODY_CLASS = 'requests-light-v5-active'
const ALLOWED_STAGES = new Set(['all', 'request', 'offer', 'calculation'])
let frame = 0

function isRequestsActive() {
  return [...document.querySelectorAll('aside nav button, .mobile-bottom-nav button')]
    .some(button => button.classList.contains('active') && button.textContent?.includes('Запросы'))
}

function icon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3h11l5 5v13H4Z"/><path d="M15 3v5h5M8 11l5 6M13 11l-5 6"/></svg>'
}

function rowsFromTable(registry) {
  return [...registry.querySelectorAll('.request-table-view tbody tr')].map(tr => {
    const cells = [...tr.querySelectorAll('td')]
    const productLines = cells[1]?.innerText.split('\n').filter(Boolean) || []
    return {
      'Номер запроса': cells[0]?.innerText.replace(/\s+/g, ' ').trim() || '',
      'Название товара': productLines[0] || '',
      'Категория и артикул': productLines.slice(1).join(' · '),
      'Поставщик': cells[2]?.innerText.replace(/\s+/g, ' ').trim() || '',
      'Дата отправки': cells[3]?.querySelector('input')?.value || cells[3]?.innerText.trim() || '',
      'Текущий этап': cells[6]?.querySelector('.status-pill')?.innerText.trim() || cells[6]?.innerText.replace(/\s+/g, ' ').trim() || ''
    }
  })
}

async function exportExcel(button, registry) {
  const original = button.innerHTML
  button.disabled = true
  button.textContent = 'Подготовка…'
  try {
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
    const data = rowsFromTable(registry)
    const sheet = XLSX.utils.json_to_sheet(data, { header: ['Номер запроса', 'Название товара', 'Категория и артикул', 'Поставщик', 'Дата отправки', 'Текущий этап'] })
    sheet['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 28 }, { wch: 38 }, { wch: 16 }, { wch: 26 }]
    sheet['!autofilter'] = { ref: `A1:F${Math.max(data.length + 1, 1)}` }
    sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Запросы')
    const date = new Intl.DateTimeFormat('ru-RU').format(new Date()).replaceAll('.', '-')
    XLSX.writeFile(book, `Запросы_${date}.xlsx`, { compression: true })
    button.innerHTML = `${icon()} Выгружено: ${data.length}`
  } catch (error) {
    console.error('Excel export failed', error)
    button.textContent = 'Ошибка выгрузки'
  } finally {
    window.setTimeout(() => { button.innerHTML = original; button.disabled = false }, 1800)
  }
}

function addExport(registry) {
  const head = registry.querySelector('.registry-toolbar-head')
  if (!head || head.querySelector('.requests-v5-export')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'requests-v5-export'
  button.innerHTML = `${icon()} Экспорт в Excel`
  button.addEventListener('click', () => exportExcel(button, registry))
  head.append(button)
}

function trimStageFilter(registry) {
  const select = registry.querySelector('select[aria-label="Фильтр по этапу"]')
  if (!select) return
  ;[...select.options].forEach(option => { if (!ALLOWED_STAGES.has(option.value)) option.remove() })
  const labels = { all: 'Все этапы', request: 'Запрос отправлен', offer: 'Предложение получено', calculation: 'Внесено в расчёт' }
  ;[...select.options].forEach(option => { option.textContent = labels[option.value] || option.textContent })
}

function addSectionLabel(registry) {
  const head = registry.querySelector('.registry-toolbar-head')
  if (!head || head.querySelector('.requests-v5-caption')) return
  const caption = document.createElement('p')
  caption.className = 'requests-v5-caption'
  caption.textContent = 'Запрос → предложение → внесено в расчёт'
  head.querySelector('div')?.append(caption)
}

function sync() {
  frame = 0
  const active = isRequestsActive()
  document.body.classList.toggle(BODY_CLASS, active)
  if (!active) return
  const registry = document.querySelector('main.content .panel.registry')
  if (!registry) return
  registry.dataset.requestsLightV5 = 'true'
  addExport(registry)
  addSectionLabel(registry)
  trimStageFilter(registry)
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(sync)
}

document.addEventListener('click', event => {
  if (event.target.closest('aside nav button, .mobile-bottom-nav button')) requestAnimationFrame(schedule)
}, true)

schedule()
new MutationObserver(schedule).observe(document.getElementById('root') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
