import './workflow-v3-core.js'

const V = window.VL3
const { state, svg, escapeHtml, formatNumber, canEdit, pageHeader, renderError, renderLoading, supplierOptions, TRANSPORT_TYPES, withNetworkRetry, supabase } = V

function filteredLogistics() {
  const query = state.logisticsQuery.trim().toLowerCase()
  return state.logistics.filter(row => {
    const matchesQuery = !query || [row.article, row.pi_number, row.carrier, row.supplier_name, row.transport_type].join(' ').toLowerCase().includes(query)
    return matchesQuery && (state.transportType === 'all' || row.transport_type === state.transportType)
  })
}
function logisticsStats() {
  return {
    volume: state.logistics.reduce((sum, row) => sum + Number(row.volume_m3 || 0), 0),
    cost: state.logistics.reduce((sum, row) => sum + Number(row.shipping_cost || 0), 0),
    carriers: new Set(state.logistics.map(row => row.carrier).filter(Boolean)).size,
    suppliers: new Set(state.logistics.map(row => row.supplier_name).filter(Boolean)).size,
  }
}
function transportIcon(type) { return type === 'Авиационный' ? 'route' : type === 'Морской' ? 'cube' : 'truck' }
function renderLogisticsRows(rows) {
  if (!rows.length) return `<div class="vl3-empty">${svg('truck', 34)}<b>Логистических заявок пока нет</b><span>Создавайте их только после решения о покупке.</span></div>`
  return `<div class="vl3-table-wrap"><table class="vl3-table vl3-logistics-table"><thead><tr><th>Артикул</th><th>Номер PI</th><th>Поставщик</th><th>Транспорт</th><th>Объём</th><th>Стоимость</th><th>Перевозчик</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${escapeHtml(row.article)}</b></td><td><span class="vl3-pi">${escapeHtml(row.pi_number)}</span></td><td><span class="vl3-supplier">${svg('factory', 14)}${escapeHtml(row.supplier_name)}</span></td><td><span class="vl3-transport">${svg(transportIcon(row.transport_type), 15)}${escapeHtml(row.transport_type)}</span></td><td><b>${formatNumber(row.volume_m3, 3)} м³</b></td><td><b>${formatNumber(row.shipping_cost)}</b></td><td>${escapeHtml(row.carrier)}</td><td><div class="vl3-row-actions">${canEdit() ? `<button title="Редактировать" data-action="edit-logistics" data-id="${row.id}">${svg('edit', 15)}</button><button class="danger" title="Удалить" data-action="delete-logistics" data-id="${row.id}">${svg('trash', 15)}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>
    <div class="vl3-mobile-list">${rows.map(row => `<article class="vl3-mobile-card logistics"><div class="vl3-mobile-head"><span class="vl3-pi">${escapeHtml(row.pi_number)}</span><span class="vl3-transport">${svg(transportIcon(row.transport_type), 14)}${escapeHtml(row.transport_type)}</span></div><h3>${escapeHtml(row.article)}</h3><p>${escapeHtml(row.supplier_name)}</p><div class="vl3-mobile-meta"><span>${svg('cube', 14)}<small>Объём</small><b>${formatNumber(row.volume_m3, 3)} м³</b></span><span>${svg('wallet', 14)}<small>Стоимость</small><b>${formatNumber(row.shipping_cost)}</b></span></div><div class="vl3-carrier">${svg('truck', 15)}<span><small>Перевозчик</small><b>${escapeHtml(row.carrier)}</b></span></div>${canEdit() ? `<div class="vl3-mobile-actions"><button data-action="edit-logistics" data-id="${row.id}">${svg('edit', 15)} Редактировать</button><button class="danger" data-action="delete-logistics" data-id="${row.id}">${svg('trash', 15)}</button></div>` : ''}</article>`).join('')}</div>`
}

V.defaultLogistics = function defaultLogistics() {
  return { kind: 'logistics', id: null, article: '', pi_number: '', shipping_cost: '', transport_type: '', volume_m3: '', carrier: '', supplier_name: '' }
}
function renderLogisticsModal() {
  const value = { ...V.defaultLogistics(), ...(state.modal || {}), kind: 'logistics' }
  return `<div class="vl3-modal-backdrop" data-action="close-modal"><div class="vl3-modal logistics" role="dialog" aria-modal="true"><div class="vl3-modal-head"><div><small>LOGISTICS / INDEPENDENT</small><h2>${value.id ? 'Редактировать заявку' : 'Новая логистическая заявка'}</h2><p>Заявка не связана с реестром запросов. Номер PI и артикул вводятся вручную.</p></div><button data-action="close-modal" aria-label="Закрыть">${svg('close')}</button></div>
    <form id="vl3-logistics-form"><input type="hidden" name="id" value="${escapeHtml(value.id || '')}"><div class="vl3-logistics-visual"><span>${svg('factory', 22)}Поставщик</span><i></i><span>${svg('clipboard', 22)}PI</span><i></i><span>${svg('truck', 22)}Перевозка</span></div><div class="vl3-form-grid">
      <label>Артикул *<input required name="article" value="${escapeHtml(value.article)}" placeholder="Например, 8208329"></label><label>Номер PI *<input required name="pi_number" value="${escapeHtml(value.pi_number)}" placeholder="Например, PI-2026-018"></label>
      <label>Стоимость перевозки *<input required type="number" min="0" step="0.01" name="shipping_cost" value="${escapeHtml(value.shipping_cost)}" placeholder="0.00"></label><label>Вид транспорта *<select required name="transport_type"><option value="" disabled${value.transport_type ? '' : ' selected'}>Выберите транспорт</option>${TRANSPORT_TYPES.map(item => `<option value="${escapeHtml(item)}"${item === value.transport_type ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>
      <label>Объём, м³ *<input required type="number" min="0" step="0.001" name="volume_m3" value="${escapeHtml(value.volume_m3)}" placeholder="0.000"></label><label>Перевозчик *<input required name="carrier" value="${escapeHtml(value.carrier)}" placeholder="Название перевозчика"></label><label class="full">Поставщик *<select required name="supplier_name">${supplierOptions(value.supplier_name)}</select></label></div>
      <div class="vl3-form-error" hidden></div><div class="vl3-modal-actions"><button type="button" class="vl3-secondary" data-action="close-modal">Отмена</button><button type="submit" class="vl3-primary">${svg('check', 16)} Сохранить заявку</button></div></form></div></div>`
}

V.renderLogisticsPage = function renderLogisticsPage() {
  const rows = filteredLogistics()
  const stats = logisticsStats()
  return `${pageHeader('logistics', state.logistics.length)}${renderError()}${!canEdit() ? `<div class="vl3-readonly">${svg('user', 16)} Режим просмотра: логистические заявки изменяет только администратор.</div>` : ''}
    <section class="vl3-stats"><article><span>${svg('truck')}Все заявки</span><strong>${state.logistics.length}</strong><small>Только купленные позиции</small></article><article><span>${svg('cube')}Общий объём</span><strong>${formatNumber(stats.volume, 3)}</strong><small>м³ по всем заявкам</small></article><article><span>${svg('wallet')}Стоимость</span><strong>${formatNumber(stats.cost)}</strong><small>Сумма перевозок</small></article><article><span>${svg('route')}Перевозчики</span><strong>${stats.carriers}</strong><small>${stats.suppliers} поставщиков</small></article></section>
    <section class="vl3-route-banner"><div><span>01</span>${svg('factory', 22)}<b>Поставщик</b></div><i></i><div><span>02</span>${svg('clipboard', 22)}<b>PI</b></div><i></i><div class="active"><span>03</span>${svg('truck', 22)}<b>Перевозка</b></div><i></i><div><span>04</span>${svg('wallet', 22)}<b>Платёж</b></div></section>
    <section class="vl3-panel"><div class="vl3-toolbar"><div class="vl3-panel-title"><small>LOGISTICS REGISTER</small><h2>Самостоятельные заявки</h2><span>${rows.length} из ${state.logistics.length}</span></div><div class="vl3-controls"><label class="vl3-search">${svg('search', 17)}<input data-filter="logisticsQuery" value="${escapeHtml(state.logisticsQuery)}" placeholder="Артикул, PI, перевозчик или поставщик"></label><label class="vl3-select">${svg('filter', 17)}<select data-filter="transportType"><option value="all"${state.transportType === 'all' ? ' selected' : ''}>Все виды транспорта</option>${TRANSPORT_TYPES.map(item => `<option value="${escapeHtml(item)}"${state.transportType === item ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label></div></div>${state.loading ? renderLoading() : renderLogisticsRows(rows)}</section>${state.modal?.kind === 'logistics' ? renderLogisticsModal() : ''}`
}

V.saveLogistics = async function saveLogistics(form) {
  if (!canEdit()) throw new Error('Изменения может вносить только администратор.')
  const value = Object.fromEntries(new FormData(form).entries())
  const shippingCost = Number(value.shipping_cost)
  const volume = Number(value.volume_m3)
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw new Error('Укажите корректную стоимость перевозки.')
  if (!Number.isFinite(volume) || volume < 0) throw new Error('Укажите корректный объём в м³.')
  const payload = {
    article: String(value.article || '').trim(),
    pi_number: String(value.pi_number || '').trim(),
    shipping_cost: shippingCost,
    transport_type: String(value.transport_type || '').trim(),
    volume_m3: volume,
    carrier: String(value.carrier || '').trim(),
    supplier_name: String(value.supplier_name || '').trim(),
    updated_by: state.session.user.id,
  }
  const id = String(value.id || '')
  if (id) await withNetworkRetry(() => supabase.from('logistics_requests').update(payload).eq('id', id))
  else await withNetworkRetry(() => supabase.from('logistics_requests').insert({ ...payload, created_by: state.session.user.id }))
  state.modal = null
  await V.loadActiveData()
}
