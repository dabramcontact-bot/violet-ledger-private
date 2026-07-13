import './workflow-v3-core.js'

const V = window.VL3
const { state, svg, escapeHtml, formatDate, requestStage, stagePill, canEdit, pageHeader, renderError, renderLoading, supplierOptions, localDateValue, withNetworkRetry, supabase } = V

function filteredRequests() {
  const query = state.requestQuery.trim().toLowerCase()
  return state.requests.filter(row => {
    const matchesQuery = !query || [row.request_number, row.product_name, row.category, row.agent_name, row.article_numbers].join(' ').toLowerCase().includes(query)
    return matchesQuery && (state.requestStage === 'all' || requestStage(row) === state.requestStage)
  })
}
function requestStats() {
  return state.requests.reduce((acc, row) => { acc[requestStage(row)] += 1; return acc }, { request: 0, offer: 0, calculation: 0 })
}
function renderRequestJourney(row) {
  const index = ['request', 'offer', 'calculation'].indexOf(requestStage(row))
  const items = [['request', 'Запрос'], ['offer', 'Предложение'], ['calculation', 'В расчёте']]
  return `<div class="vl3-journey" style="--vl3-progress:${index * 50}%"><i class="vl3-journey-line"><em></em></i>${items.map(([, label], itemIndex) => `<span class="${itemIndex <= index ? 'done' : ''} ${itemIndex === index ? 'current' : ''}"><b>${itemIndex < index ? svg('check', 12) : itemIndex + 1}</b><small>${label}</small></span>`).join('')}</div>`
}
function renderRequestRows(rows) {
  if (!rows.length) return `<div class="vl3-empty">${svg('clipboard', 34)}<b>Запросов не найдено</b><span>Измените фильтры или создайте новый запрос.</span></div>`
  return `<div class="vl3-table-wrap"><table class="vl3-table"><thead><tr><th>Запрос</th><th>Товар / артикул</th><th>Поставщик</th><th>Дата</th><th>Этап</th><th></th></tr></thead><tbody>${rows.map(row => `<tr>
    <td>${canEdit() ? `<button class="vl3-link" data-action="edit-request" data-id="${row.id}">${escapeHtml(row.request_number)}</button>` : `<span class="vl3-link static">${escapeHtml(row.request_number)}</span>`}</td>
    <td><b>${escapeHtml(row.product_name)}</b><small>${escapeHtml(row.category)}${row.article_numbers ? ` · ${escapeHtml(row.article_numbers)}` : ''}</small></td>
    <td><span class="vl3-supplier">${svg('factory', 14)}${escapeHtml(row.agent_name)}</span></td><td>${formatDate(row.request_sent_at)}</td><td>${stagePill(row)}${renderRequestJourney(row)}</td>
    <td><div class="vl3-row-actions">${canEdit() ? `<button title="Редактировать" data-action="edit-request" data-id="${row.id}">${svg('edit', 15)}</button><button class="danger" title="Удалить" data-action="delete-request" data-id="${row.id}">${svg('trash', 15)}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>
    <div class="vl3-mobile-list">${rows.map(row => `<article class="vl3-mobile-card"><div class="vl3-mobile-head">${canEdit() ? `<button class="vl3-link" data-action="edit-request" data-id="${row.id}">${escapeHtml(row.request_number)}</button>` : `<span class="vl3-link static">${escapeHtml(row.request_number)}</span>`}${stagePill(row)}</div><h3>${escapeHtml(row.product_name)}</h3><p>${escapeHtml(row.category)}${row.article_numbers ? ` · ${escapeHtml(row.article_numbers)}` : ''}</p>${renderRequestJourney(row)}<div class="vl3-mobile-meta"><span>${svg('factory', 14)}<small>Поставщик</small><b>${escapeHtml(row.agent_name)}</b></span><span>${svg('calendar', 14)}<small>Отправлен</small><b>${formatDate(row.request_sent_at)}</b></span></div>${canEdit() ? `<div class="vl3-mobile-actions"><button data-action="edit-request" data-id="${row.id}">${svg('edit', 15)} Редактировать</button><button class="danger" data-action="delete-request" data-id="${row.id}">${svg('trash', 15)}</button></div>` : ''}</article>`).join('')}</div>`
}

V.defaultRequest = function defaultRequest() {
  return { kind: 'request', id: null, request_number: '', request_sent_at: localDateValue(), category: '', product_name: '', article_numbers: '', agent_name: '', offer_received: false, offer_received_at: '', included_calculation: false, notes: '' }
}
function renderRequestModal() {
  const value = { ...V.defaultRequest(), ...(state.modal || {}), kind: 'request' }
  return `<div class="vl3-modal-backdrop" data-action="close-modal"><div class="vl3-modal" role="dialog" aria-modal="true"><div class="vl3-modal-head"><div><small>REQUEST / RFQ</small><h2>${value.id ? 'Редактировать запрос' : 'Новый запрос'}</h2><p>Только запрос, предложение и внесение в расчёт. PI и логистика ведутся отдельно.</p></div><button data-action="close-modal" aria-label="Закрыть">${svg('close')}</button></div>
    <form id="vl3-request-form"><input type="hidden" name="id" value="${escapeHtml(value.id || '')}"><div class="vl3-form-grid">
      <label>Номер запроса *<input required name="request_number" value="${escapeHtml(value.request_number)}" placeholder="REQ-2026-001"></label><label>Дата отправки *<input required type="date" name="request_sent_at" value="${escapeHtml(value.request_sent_at || '')}"></label>
      <label>Категория *<input required name="category" value="${escapeHtml(value.category)}" placeholder="Например, Освещение"></label><label>Поставщик *<select required name="agent_name">${supplierOptions(value.agent_name)}</select></label>
      <label class="full">Название товара *<input required name="product_name" value="${escapeHtml(value.product_name)}" placeholder="Введите название товара"></label><label class="full">Артикул / артикулы<input name="article_numbers" value="${escapeHtml(value.article_numbers || '')}" placeholder="Например, AB-1024, AB-1025"></label></div>
      <section class="vl3-cycle"><div class="vl3-section-title"><small>ЭТАПЫ ОБРАБОТКИ</small><h3>Запрос → предложение → расчёт</h3></div>
        <label class="vl3-cycle-row"><input type="checkbox" name="offer_received"${value.offer_received ? ' checked' : ''}><span><b>Предложение получено</b><small>Зафиксируйте дату ответа поставщика</small></span><input type="date" name="offer_received_at" value="${escapeHtml(value.offer_received_at || '')}"></label>
        <label class="vl3-cycle-row final"><input type="checkbox" name="included_calculation"${value.included_calculation ? ' checked' : ''}><span><b>Внесено в расчёт</b><small>Финальная точка обработки запроса</small></span>${svg('check', 18)}</label></section>
      <label class="vl3-textarea">Комментарий<textarea name="notes" rows="3" placeholder="Условия, замечания, следующий шаг…">${escapeHtml(value.notes || '')}</textarea></label><div class="vl3-form-error" hidden></div>
      <div class="vl3-modal-actions"><button type="button" class="vl3-secondary" data-action="close-modal">Отмена</button><button type="submit" class="vl3-primary">${svg('check', 16)} Сохранить запрос</button></div>
    </form></div></div>`
}

V.renderRequestsPage = function renderRequestsPage() {
  const rows = filteredRequests()
  const stats = requestStats()
  return `${pageHeader('requests', state.requests.length)}${renderError()}${!canEdit() ? `<div class="vl3-readonly">${svg('user', 16)} Режим просмотра: добавление и редактирование доступны только администратору.</div>` : ''}
    <section class="vl3-stats"><article><span>${svg('clipboard')}Все запросы</span><strong>${state.requests.length}</strong><small>Общий реестр RFQ</small></article><article><span>${svg('calendar')}Отправлены</span><strong>${stats.request}</strong><small>Ожидают предложения</small></article><article><span>${svg('factory')}Предложения</span><strong>${stats.offer}</strong><small>Получены от поставщика</small></article><article><span>${svg('check')}В расчёте</span><strong>${stats.calculation}</strong><small>Цикл запроса завершён</small></article></section>
    <section class="vl3-panel"><div class="vl3-toolbar"><div class="vl3-panel-title"><small>REQUEST REGISTER</small><h2>Рабочий реестр</h2><span>${rows.length} из ${state.requests.length}</span></div><div class="vl3-controls"><label class="vl3-search">${svg('search', 17)}<input data-filter="requestQuery" value="${escapeHtml(state.requestQuery)}" placeholder="Номер, товар, артикул или поставщик"></label><label class="vl3-select">${svg('filter', 17)}<select data-filter="requestStage"><option value="all"${state.requestStage === 'all' ? ' selected' : ''}>Все этапы</option><option value="request"${state.requestStage === 'request' ? ' selected' : ''}>Запрос отправлен</option><option value="offer"${state.requestStage === 'offer' ? ' selected' : ''}>Предложение получено</option><option value="calculation"${state.requestStage === 'calculation' ? ' selected' : ''}>Внесено в расчёт</option></select></label></div></div>${state.loading ? renderLoading() : renderRequestRows(rows)}</section>${state.modal?.kind === 'request' ? renderRequestModal() : ''}`
}

V.saveRequest = async function saveRequest(form) {
  if (!canEdit()) throw new Error('Изменения может вносить только администратор.')
  const value = Object.fromEntries(new FormData(form).entries())
  const offerReceived = form.elements.offer_received.checked
  const includedCalculation = form.elements.included_calculation.checked
  const payload = {
    request_number: String(value.request_number || '').trim(),
    request_sent_at: value.request_sent_at,
    category: String(value.category || '').trim(),
    product_name: String(value.product_name || '').trim(),
    article_numbers: String(value.article_numbers || '').trim(),
    agent_name: String(value.agent_name || '').trim(),
    offer_received: offerReceived,
    offer_received_at: offerReceived ? (value.offer_received_at || localDateValue()) : null,
    included_calculation: includedCalculation,
    notes: String(value.notes || '').trim(),
    status: includedCalculation ? 'calculation' : offerReceived ? 'offer' : 'request',
    updated_by: state.session.user.id,
  }
  const id = String(value.id || '')
  if (id) await withNetworkRetry(() => supabase.from('requests').update(payload).eq('id', id))
  else await withNetworkRetry(() => supabase.from('requests').insert({ ...payload, created_by: state.session.user.id }))
  state.modal = null
  await V.loadActiveData()
}
