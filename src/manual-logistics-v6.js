import { createClient } from '@supabase/supabase-js'
import { LOGISTICS_SUPABASE_URL, LOGISTICS_SUPABASE_KEY } from './manual-logistics-config.js'

const supabase = createClient(LOGISTICS_SUPABASE_URL, LOGISTICS_SUPABASE_KEY)
const ROOT_ID = 'manual-logistics-v6-root'
const state = { active:false, rows:[], profile:null, session:null, loading:false, query:'', company:'all', modal:null, error:'', channel:null }
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')
const fmt = value => value ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)) : '—'
const today = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10) }
const pathMap = {
  plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>', box:'<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/>',
  company:'<path d="M3 21V9l6 3V8l6 4V5h6v16H3Z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  alert:'<path d="M10.3 2.8 1.8 17.5A2 2 0 0 0 3.5 20h17a2 2 0 0 0 1.7-2.5L13.7 2.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'
}
const icon = (name,size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${pathMap[name]||pathMap.box}</svg>`
const canEdit = () => state.profile?.role === 'admin'

function ensureRoot(){
  const main=document.querySelector('main.content'); if(!main)return null
  let root=document.getElementById(ROOT_ID)
  if(!root){root=document.createElement('div');root.id=ROOT_ID;root.addEventListener('click',onClick);root.addEventListener('submit',onSubmit);root.addEventListener('input',onInput);root.addEventListener('change',onChange);main.append(root)}
  return root
}
function visibleRows(){
  const q=state.query.trim().toLowerCase()
  return state.rows.filter(row=>(!q||[row.article,row.pi_number,row.logistics_company].join(' ').toLowerCase().includes(q))&&(state.company==='all'||row.logistics_company===state.company))
}
function getStats(){
  const now=today()
  return {total:state.rows.length,ready:state.rows.filter(r=>r.ready_date&&r.ready_date<=now&&!r.departure_date).length,transit:state.rows.filter(r=>r.departure_date&&!r.warehouse_date).length,arrived:state.rows.filter(r=>r.warehouse_date).length}
}
function renderRows(rows){
  if(!rows.length)return `<div class="ml6-empty">${icon('truck',34)}<b>Логистических заявок пока нет</b><span>Создайте первую запись вручную.</span></div>`
  return `<div class="ml6-table-wrap"><table><thead><tr><th>Артикул</th><th>Номер PI</th><th>Дата готовности</th><th>Дата выезда</th><th>Дата прихода на склад</th><th>Логистическая компания</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td><b>${esc(row.article)}</b></td><td><span class="ml6-pi">${esc(row.pi_number)}</span></td><td>${fmt(row.ready_date)}</td><td>${fmt(row.departure_date)}</td><td>${fmt(row.warehouse_date)}</td><td>${esc(row.logistics_company)}</td><td><div class="ml6-actions">${canEdit()?`<button data-action="edit" data-id="${row.id}">${icon('edit',15)}</button><button class="danger" data-action="delete" data-id="${row.id}">${icon('trash',15)}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div><div class="ml6-cards">${rows.map(row=>`<article><div><span class="ml6-pi">${esc(row.pi_number)}</span>${canEdit()?`<button data-action="edit" data-id="${row.id}">${icon('edit',15)}</button>`:''}</div><h3>${esc(row.article)}</h3><p>${icon('company',14)} ${esc(row.logistics_company)}</p><dl><div><dt>Готовность</dt><dd>${fmt(row.ready_date)}</dd></div><div><dt>Выезд</dt><dd>${fmt(row.departure_date)}</dd></div><div><dt>Склад</dt><dd>${fmt(row.warehouse_date)}</dd></div></dl></article>`).join('')}</div>`
}
function blank(){return {id:'',article:'',pi_number:'',ready_date:'',departure_date:'',warehouse_date:'',logistics_company:''}}
function renderModal(){
  const row={...blank(),...state.modal}
  return `<div class="ml6-backdrop" data-action="close"><div class="ml6-modal"><div class="ml6-modal-head"><div><small>MANUAL LOGISTICS</small><h2>${row.id?'Редактировать заявку':'Новая логистическая заявка'}</h2><p>Заполняется вручную и не связана с запросами.</p></div><button data-action="close">${icon('close')}</button></div><form id="ml6-form"><input type="hidden" name="id" value="${esc(row.id)}"><div class="ml6-form-grid"><label>Артикул *<input required name="article" value="${esc(row.article)}"></label><label>Номер PI *<input required name="pi_number" value="${esc(row.pi_number)}"></label><label>Дата готовности<input type="date" name="ready_date" value="${esc(row.ready_date||'')}"></label><label>Дата выезда<input type="date" name="departure_date" value="${esc(row.departure_date||'')}"></label><label>Дата прихода на склад<input type="date" name="warehouse_date" value="${esc(row.warehouse_date||'')}"></label><label>Логистическая компания *<input required name="logistics_company" value="${esc(row.logistics_company)}"></label></div><div class="ml6-form-error" hidden></div><div class="ml6-modal-actions"><button type="button" data-action="close">Отмена</button><button class="ml6-primary" type="submit">Сохранить заявку</button></div></form></div></div>`
}
function render(){
  if(!state.active)return
  const root=ensureRoot();if(!root)return
  const rows=visibleRows(),s=getStats(),companies=[...new Set(state.rows.map(r=>r.logistics_company).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
  root.innerHTML=`<section class="ml6-page"><header class="ml6-header"><div><small>LOGISTICS REGISTER</small><h1>Логистика</h1><p>Самостоятельный реестр. Запросы сюда не переносятся — каждая запись создаётся вручную.</p></div>${canEdit()?`<button class="ml6-primary" data-action="new">${icon('plus')} Новая заявка</button>`:''}</header>${state.error?`<div class="ml6-error">${icon('alert')}<span>${esc(state.error)}</span></div>`:''}<section class="ml6-stats"><article><span>${icon('box')}Всего заявок</span><b>${s.total}</b><small>В самостоятельном реестре</small></article><article><span>${icon('calendar')}Готово к выезду</span><b>${s.ready}</b><small>Есть дата готовности</small></article><article><span>${icon('truck')}В пути</span><b>${s.transit}</b><small>Есть дата выезда</small></article><article><span>${icon('company')}На складе</span><b>${s.arrived}</b><small>Есть дата прихода</small></article></section><section class="ml6-panel"><div class="ml6-toolbar"><div><small>РУЧНОЕ ЗАПОЛНЕНИЕ</small><h2>Логистические заявки</h2><span>${rows.length} из ${state.rows.length}</span></div><div class="ml6-controls"><label>${icon('search',16)}<input data-filter="query" value="${esc(state.query)}" placeholder="Артикул, PI или компания"></label><select data-filter="company"><option value="all">Все компании</option>${companies.map(c=>`<option value="${esc(c)}"${state.company===c?' selected':''}>${esc(c)}</option>`).join('')}</select></div></div>${state.loading?'<div class="ml6-empty">Загрузка…</div>':renderRows(rows)}</section>${state.modal?renderModal():''}</section>`
}
async function load(){
  state.loading=true;state.error='';render()
  try{
    const {data:{session},error:authError}=await supabase.auth.getSession();if(authError)throw authError;state.session=session;if(!session)throw new Error('Войдите в систему снова.')
    const {data:profile,error:profileError}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();if(profileError)throw profileError;state.profile=profile
    const {data,error}=await supabase.from('manual_logistics').select('*').order('updated_at',{ascending:false});if(error)throw error;state.rows=data||[]
  }catch(error){state.error=/manual_logistics/i.test(error.message||'')?'Сначала выполните supabase/manual-logistics-upgrade.sql в Supabase SQL Editor.':(error.message||'Не удалось загрузить логистику.')}finally{state.loading=false;render()}
}
async function save(form){
  const data=Object.fromEntries(new FormData(form).entries())
  const payload={article:data.article.trim(),pi_number:data.pi_number.trim(),ready_date:data.ready_date||null,departure_date:data.departure_date||null,warehouse_date:data.warehouse_date||null,logistics_company:data.logistics_company.trim(),updated_by:state.session.user.id}
  const result=data.id?await supabase.from('manual_logistics').update(payload).eq('id',data.id):await supabase.from('manual_logistics').insert({...payload,created_by:state.session.user.id})
  if(result.error)throw result.error;state.modal=null;await load()
}
async function onSubmit(e){if(e.target.id!=='ml6-form')return;e.preventDefault();const box=e.target.querySelector('.ml6-form-error');try{box.hidden=true;await save(e.target)}catch(err){box.textContent=err.message||'Не удалось сохранить.';box.hidden=false}}
async function onClick(e){
  const node=e.target.closest('[data-action]');if(!node)return;const action=node.dataset.action
  if(action==='close'&&node.classList.contains('ml6-backdrop')&&e.target!==node)return;e.preventDefault();e.stopPropagation()
  if(action==='new'){state.modal=blank();document.body.classList.add('ml6-modal-open');render()}
  if(action==='close'){state.modal=null;document.body.classList.remove('ml6-modal-open');render()}
  if(action==='edit'){const row=state.rows.find(r=>r.id===node.dataset.id);if(row){state.modal={...row};document.body.classList.add('ml6-modal-open');render()}}
  if(action==='delete'){const row=state.rows.find(r=>r.id===node.dataset.id);if(!row||!confirm(`Удалить логистическую заявку по PI ${row.pi_number}?`))return;const {error}=await supabase.from('manual_logistics').delete().eq('id',row.id);if(error)state.error=error.message;else await load()}
}
function onInput(e){if(e.target.dataset.filter==='query'){state.query=e.target.value;render();document.querySelector('[data-filter="query"]')?.focus()}}
function onChange(e){if(e.target.dataset.filter==='company'){state.company=e.target.value;render()}}
function activate(){state.active=true;document.body.classList.add('manual-logistics-v6-active');ensureRoot();render();load();if(!state.channel)state.channel=supabase.channel('manual-logistics-v6').on('postgres_changes',{event:'*',schema:'public',table:'manual_logistics'},load).subscribe()}
function deactivate(){state.active=false;document.body.classList.remove('manual-logistics-v6-active','ml6-modal-open');document.getElementById(ROOT_ID)?.remove();if(state.channel){supabase.removeChannel(state.channel);state.channel=null}}
document.addEventListener('click',e=>{const button=e.target.closest('aside nav button, .mobile-bottom-nav button');if(!button)return;const text=button.textContent.replace(/\s+/g,' ').trim();if(text.includes('Логистика'))requestAnimationFrame(activate);else if(state.active)deactivate()})
new MutationObserver(()=>{if(state.active)ensureRoot()}).observe(document.getElementById('root')||document.body,{childList:true,subtree:true})
