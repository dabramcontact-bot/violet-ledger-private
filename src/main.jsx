import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import {
  Activity, Archive, ArrowRight, BarChart3, Check, ChevronRight, CircleAlert,
  ClipboardList, Clock3, FileCheck2, FilePenLine, Filter, LayoutDashboard,
  LogOut, Mail, Menu, PackageOpen, Pencil, Plus, Search, Send, ShieldCheck,
  Trash2, UserPlus, Users, X
} from 'lucide-react'
import './styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const EMPTY = {
  request_number: '', category: '', product_name: '', agent_name: '', request_sent_at: '',
  offer_received: false, offer_received_at: '', included_calculation: false,
  pi_sent: false, pi_sent_at: '', pi_revision: false, pi_revision_at: '',
  pi_signed: false, pi_signed_at: '', notes: ''
}

const roleLabel = { admin: 'Администратор', editor: 'Редактор', viewer: 'Просмотр' }
const statusMeta = {
  request: ['Запрос отправлен', 'blue'], offer: ['Предложение получено', 'cyan'],
  calculation: ['В расчёте', 'violet'], pi_sent: ['PI отправлена', 'orange'],
  revision: ['PI на доработке', 'rose'], signed: ['PI подписана', 'green']
}

function calcStatus(r) {
  if (r.pi_signed) return 'signed'
  if (r.pi_revision) return 'revision'
  if (r.pi_sent) return 'pi_sent'
  if (r.included_calculation) return 'calculation'
  if (r.offer_received) return 'offer'
  return 'request'
}

const date = (value) => value ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)) : '—'
const dateTime = (value) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (result.error) setMessage(result.error.message === 'Invalid login credentials' ? 'Неверный email или пароль' : result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Проверьте почту и подтвердите регистрацию.')
    setBusy(false)
  }

  return <div className="login-page">
    <div className="login-glow one"/><div className="login-glow two"/>
    <div className="login-brand"><div className="logo"><span>V</span></div><b>Violet Ledger</b></div>
    <main className="login-card">
      <div className="eyebrow"><ShieldCheck size={15}/> ЗАЩИЩЁННОЕ ПРОСТРАНСТВО</div>
      <h1>{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h1>
      <p>{mode === 'login' ? 'Войдите, чтобы продолжить работу с запросами и PI.' : 'Регистрация доступна только по приглашению администратора.'}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label>
        <label>Пароль<input type="password" required minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Не менее 8 символов"/></label>
        {message && <div className="auth-message"><CircleAlert size={17}/>{message}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}<ArrowRight size={18}/></button>
      </form>
      <button className="link-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>
        {mode === 'login' ? 'Получили приглашение? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
      </button>
    </main>
    <div className="login-note">Доступ только для приглашённых пользователей</div>
  </div>
}

function Sidebar({ page, setPage, profile, open, setOpen }) {
  const items = [
    ['dashboard', LayoutDashboard, 'Обзор'], ['requests', ClipboardList, 'Реестр запросов'],
    ['audit', Activity, 'Журнал действий']
  ]
  if (profile?.role === 'admin') items.push(['users', Users, 'Пользователи'])
  return <><div className={`mobile-overlay ${open?'show':''}`} onClick={()=>setOpen(false)}/><aside className={open?'open':''}>
    <div className="brand"><div className="logo"><span>V</span></div><div><b>Violet Ledger</b><small>PROCUREMENT OS</small></div><button className="close-mobile" onClick={()=>setOpen(false)}><X/></button></div>
    <nav>{items.map(([id, Icon, label])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}}><Icon size={19}/><span>{label}</span>{page===id&&<ChevronRight size={16}/>}</button>)}</nav>
    <div className="side-footer"><div className="avatar">{profile?.email?.[0]?.toUpperCase()}</div><div><b>{profile?.email}</b><small>{roleLabel[profile?.role]}</small></div><button title="Выйти" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button></div>
  </aside></>
}

function Header({ title, subtitle, onAdd, canEdit, setOpen }) {
  return <header><button className="menu" onClick={()=>setOpen(true)}><Menu/></button><div><h1>{title}</h1><p>{subtitle}</p></div>{onAdd&&canEdit&&<button className="primary" onClick={onAdd}><Plus size={18}/>Новый запрос</button>}</header>
}

function Stat({ icon: Icon, label, value, tone, note }) {
  return <div className="stat"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}

function StatusPill({ status }) { const [label,tone]=statusMeta[status]||statusMeta.request; return <span className={`status ${tone}`}><i/>{label}</span> }

function Dashboard({ rows, onAdd, canEdit, setOpen }) {
  const counts = useMemo(()=>rows.reduce((a,r)=>{a[calcStatus(r)]++;return a},{request:0,offer:0,calculation:0,pi_sent:0,revision:0,signed:0}),[rows])
  const active = rows.filter(r=>calcStatus(r)!=='signed').length
  return <>
    <Header title="Добрый вечер" subtitle="Все закупочные процессы — в одном спокойном пространстве." onAdd={onAdd} canEdit={canEdit} setOpen={setOpen}/>
    <section className="stats-grid">
      <Stat icon={ClipboardList} label="Всего запросов" value={rows.length} tone="violet" note="За всё время"/>
      <Stat icon={Clock3} label="В работе" value={active} tone="blue" note="Требуют внимания"/>
      <Stat icon={FilePenLine} label="PI на доработке" value={counts.revision} tone="rose" note="Приоритетный этап"/>
      <Stat icon={FileCheck2} label="PI подписано" value={counts.signed} tone="green" note="Завершено"/>
    </section>
    <section className="panel pipeline-panel"><div className="panel-head"><div><h2>Воронка закупок</h2><p>Распределение запросов по текущему этапу</p></div></div>
      <div className="pipeline">{Object.entries(statusMeta).map(([key,[label,tone]],i)=><div className="pipe-step" key={key}><div className={`pipe-circle ${tone}`}>{counts[key]}</div><b>{label}</b><span>{rows.length ? Math.round(counts[key]/rows.length*100) : 0}%</span>{i<5&&<div className="pipe-line"/>}</div>)}</div>
    </section>
    <section className="panel"><div className="panel-head"><div><h2>Последние запросы</h2><p>Недавно обновлённые позиции</p></div></div><RequestTable rows={rows.slice(0,6)} compact/></section>
  </>
}

function RequestTable({ rows, onEdit, onDelete, canEdit, compact=false }) {
  if (!rows.length) return <div className="empty"><PackageOpen size={38}/><b>Запросов пока нет</b><span>Добавьте первую позицию, чтобы начать работу.</span></div>
  return <div className="table-wrap"><table><thead><tr><th>Запрос</th><th>Товар и категория</th><th>Агент</th><th>Отправлен</th><th>Текущий этап</th>{!compact&&<th/>}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>
    <td><b className="request-no">{r.request_number}</b></td><td><b>{r.product_name}</b><small>{r.category}</small></td><td>{r.agent_name}</td><td>{date(r.request_sent_at)}</td><td><StatusPill status={calcStatus(r)}/></td>{!compact&&<td><div className="row-actions">{canEdit&&<><button onClick={()=>onEdit(r)}><Pencil size={16}/></button><button className="danger" onClick={()=>onDelete(r)}><Trash2 size={16}/></button></>}</div></td>}
  </tr>)}</tbody></table></div>
}

function Requests({ rows, onAdd, onEdit, onDelete, canEdit, setOpen }) {
  const [q,setQ]=useState(''); const [status,setStatus]=useState('all')
  const filtered=rows.filter(r=>(status==='all'||calcStatus(r)===status)&&[r.request_number,r.product_name,r.category,r.agent_name].join(' ').toLowerCase().includes(q.toLowerCase()))
  return <><Header title="Реестр запросов" subtitle={`${rows.length} позиций в общей базе`} onAdd={onAdd} canEdit={canEdit} setOpen={setOpen}/>
    <section className="panel registry"><div className="toolbar"><div className="search"><Search size={18}/><input placeholder="Поиск по номеру, товару, категории или агенту" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="filter"><Filter size={17}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Все этапы</option>{Object.entries(statusMeta).map(([k,[l]])=><option key={k} value={k}>{l}</option>)}</select></div></div>
    <RequestTable rows={filtered} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit}/></section></>
}

function RequestModal({ value, onClose, onSave }) {
  const [form,setForm]=useState(value||EMPTY); const [busy,setBusy]=useState(false); const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const checks=[['offer_received','Предложение получено','offer_received_at'],['included_calculation','Внесено в расчёт',null],['pi_sent','PI отправлена','pi_sent_at'],['pi_revision','PI отправлена на доработку','pi_revision_at'],['pi_signed','PI подписана','pi_signed_at']]
  async function submit(e){e.preventDefault();setBusy(true);await onSave(form);setBusy(false)}
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><div className="eyebrow">КАРТОЧКА ЗАПРОСА</div><h2>{value?.id?'Редактировать запрос':'Новый запрос'}</h2></div><button onClick={onClose}><X/></button></div><form onSubmit={submit}>
    <div className="form-grid"><label>Номер запроса *<input required value={form.request_number} onChange={e=>set('request_number',e.target.value)} placeholder="REQ-2026-001"/></label><label>Дата отправки *<input type="date" required value={form.request_sent_at||''} onChange={e=>set('request_sent_at',e.target.value)}/></label><label>Категория товара *<input required value={form.category} onChange={e=>set('category',e.target.value)} placeholder="Например, Освещение"/></label><label>Китайский агент *<input required value={form.agent_name} onChange={e=>set('agent_name',e.target.value)} placeholder="Имя или компания"/></label><label className="full">Название товара *<input required value={form.product_name} onChange={e=>set('product_name',e.target.value)} placeholder="Введите название товара"/></label></div>
    <div className="stage-title"><span>Этапы обработки</span><small>Отмечайте по мере прохождения</small></div><div className="stage-list">{checks.map(([key,label,dateKey],i)=><div className={`stage-row ${form[key]?'done':''}`} key={key}><button type="button" className="check" onClick={()=>set(key,!form[key])}>{form[key]&&<Check size={16}/>}</button><span className="stage-number">{i+1}</span><b>{label}</b>{dateKey&&form[key]&&<input type="date" value={form[dateKey]||''} onChange={e=>set(dateKey,e.target.value)}/>}</div>)}</div>
    <label>Комментарий<textarea rows="3" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Условия, замечания, следующий шаг…"/></label>
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Отмена</button><button className="primary" disabled={busy}>{busy?'Сохранение…':'Сохранить запрос'}<Check size={18}/></button></div>
  </form></div></div>
}

function UsersPage({ profile, setOpen }) {
  const [users,setUsers]=useState([]); const [email,setEmail]=useState(''); const [role,setRole]=useState('editor'); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const load=async()=>{const {data,error}=await supabase.from('allowed_users').select('*').order('created_at');if(!error)setUsers(data||[])}
  useEffect(()=>{load()},[])
  async function invite(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.from('allowed_users').upsert({email:email.toLowerCase().trim(),role,invited_by:profile.id},{onConflict:'email'});if(error)setError(error.message);else{setEmail('');load()}setBusy(false)}
  async function remove(id){if(!confirm('Отозвать приглашение? Уже созданный профиль останется активным, пока администратор не отключит пользователя в Supabase Auth.'))return;await supabase.from('allowed_users').delete().eq('id',id);load()}
  return <><Header title="Пользователи" subtitle="Приглашения и роли команды" setOpen={setOpen}/><div className="users-layout"><section className="panel invite-card"><div className="panel-head"><div><h2>Пригласить сотрудника</h2><p>Добавьте email до регистрации пользователя</p></div><UserPlus/></div><form onSubmit={invite}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@company.com"/></label><label>Роль<select value={role} onChange={e=>setRole(e.target.value)}><option value="editor">Редактор</option><option value="viewer">Только просмотр</option><option value="admin">Администратор</option></select></label>{error&&<div className="auth-message">{error}</div>}<button className="primary wide" disabled={busy}><Mail size={18}/>Добавить приглашение</button></form></section><section className="panel"><div className="panel-head"><div><h2>Разрешённые email</h2><p>{users.length} пользователей и приглашений</p></div></div><div className="user-list">{users.map(u=><div className="user-row" key={u.id}><div className="avatar">{u.email[0].toUpperCase()}</div><div><b>{u.email}</b><small>Добавлен {date(u.created_at?.slice(0,10))}</small></div><span className={`role ${u.role}`}>{roleLabel[u.role]}</span>{u.email!==profile.email&&<button onClick={()=>remove(u.id)}><Trash2 size={17}/></button>}</div>)}</div></section></div></>
}

function AuditPage({ setOpen }) {
 const [logs,setLogs]=useState([]); useEffect(()=>{supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100).then(({data})=>setLogs(data||[]))},[])
 const action={INSERT:'создал(а)',UPDATE:'изменил(а)',DELETE:'удалил(а)'}
 return <><Header title="Журнал действий" subtitle="Последние изменения в общей базе" setOpen={setOpen}/><section className="panel"><div className="timeline">{logs.length?logs.map(l=><div className="timeline-row" key={l.id}><div className={`timeline-icon ${l.action.toLowerCase()}`}>{l.action==='INSERT'?<Plus/>:l.action==='DELETE'?<Trash2/>:<Pencil/>}</div><div><b>{l.actor_email||'Система'} {action[l.action]} запрос</b><span>{l.request_number||'Без номера'} · {dateTime(l.created_at)}</span></div></div>):<div className="empty"><Archive/><b>Журнал пока пуст</b></div>}</div></section></>
}

function App() {
  const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[rows,setRows]=useState([]),[page,setPage]=useState('dashboard'),[modal,setModal]=useState(null),[sideOpen,setSideOpen]=useState(false),[loading,setLoading]=useState(true)
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[])
  useEffect(()=>{if(!session){setProfile(null);setRows([]);return}loadProfile();loadRows();const channel=supabase.channel('requests-live').on('postgres_changes',{event:'*',schema:'public',table:'requests'},loadRows).subscribe();return()=>supabase.removeChannel(channel)},[session])
  async function loadProfile(){const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();if(error){console.error(error);return}setProfile(data)}
  async function loadRows(){const {data}=await supabase.from('requests').select('*').order('updated_at',{ascending:false});setRows(data||[])}
  async function save(form){const payload={...form,status:calcStatus(form),updated_by:session.user.id};delete payload.id;delete payload.created_at;delete payload.updated_at;delete payload.created_by;if(form.id) await supabase.from('requests').update(payload).eq('id',form.id);else await supabase.from('requests').insert({...payload,created_by:session.user.id});setModal(null);loadRows()}
  async function remove(r){if(!confirm(`Удалить запрос ${r.request_number}?`))return;await supabase.from('requests').delete().eq('id',r.id);loadRows()}
  if(loading)return <div className="splash"><div className="logo"><span>V</span></div></div>
  if(!session)return <Login/>
  if(!profile)return <div className="access-denied"><ShieldCheck size={44}/><h2>Проверяем доступ</h2><p>Если экран не меняется, ваш email ещё не добавлен администратором или SQL-схема не установлена.</p><button className="secondary" onClick={()=>supabase.auth.signOut()}>Выйти</button></div>
  const canEdit=['admin','editor'].includes(profile.role)
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} profile={profile} open={sideOpen} setOpen={setSideOpen}/><main className="content">{page==='dashboard'&&<Dashboard rows={rows} onAdd={()=>setModal(EMPTY)} canEdit={canEdit} setOpen={setSideOpen}/>} {page==='requests'&&<Requests rows={rows} onAdd={()=>setModal(EMPTY)} onEdit={setModal} onDelete={remove} canEdit={canEdit} setOpen={setSideOpen}/>} {page==='users'&&<UsersPage profile={profile} setOpen={setSideOpen}/>} {page==='audit'&&<AuditPage setOpen={setSideOpen}/>}</main>{modal&&<RequestModal value={modal} onClose={()=>setModal(null)} onSave={save}/>}</div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
