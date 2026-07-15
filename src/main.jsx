import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, CircleAlert, ClipboardList, FileCheck2, LayoutDashboard, LogOut, Menu, ShieldCheck, Truck, WalletCards, X } from 'lucide-react'
import { supabase } from './data'
import Dashboard from './Dashboard'
import Requests from './Requests'
import PI from './PI'
import Logistics from './Logistics'
import Payments from './Payments'
import './styles.css'
import './phantom-motion-v2.css'
import './phantom-motion-v2.js'

const navItems = [
  ['dashboard', LayoutDashboard, 'Обзор'],
  ['requests', ClipboardList, 'Запросы'],
  ['pi', FileCheck2, 'PI'],
  ['logistics', Truck, 'Логистика'],
  ['payments', WalletCards, 'Платежи']
]

function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } })
    if (result.error) setMessage(result.error.message === 'Invalid login credentials' ? 'Неверный email или пароль.' : result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Проверьте почту и подтвердите регистрацию.')
    setBusy(false)
  }
  return <main className="login-page">
    <section className="login-visual"><div className="login-brand"><span>VL</span><div><b>VIOLET LEDGER</b><small>PROCUREMENT CONTROL</small></div></div><div className="login-art"><i/><i/><i/><i/><div><ClipboardList/><span/><FileCheck2/><span/><Truck/><span/><WalletCards/></div></div><div className="login-copy"><small>PRIVATE PROCUREMENT NETWORK</small><h1>Каждая сделка.<br/>Под полным контролем.</h1><p>Запросы, PI, логистика и платежи в защищённом пространстве команды.</p></div></section>
    <section className="login-form"><div className="eyebrow"><ShieldCheck/> ДОСТУП ПО ПРИГЛАШЕНИЮ</div><h2>{mode === 'login' ? 'С возвращением.' : 'Создайте аккаунт.'}</h2><p>{mode === 'login' ? 'Войдите, чтобы продолжить работу.' : 'Регистрация доступна приглашённым пользователям.'}</p><form onSubmit={submit}><label><span>Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email"/></label><label><span>Пароль</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>{message && <div className="auth-error"><CircleAlert/>{message}</div>}<button className="primary wide-button" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти в Violet Ledger' : 'Создать аккаунт'}<ArrowRight/></button></form><button className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'Получили приглашение? Создать аккаунт' : 'Уже есть аккаунт? Войти'}</button><small className="security-note"><ShieldCheck/> Данные защищены Supabase RLS</small></section>
  </main>
}

function Sidebar({ page, setPage, profile, open, setOpen }) {
  return <><button className={`mobile-overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} aria-label="Закрыть меню"/><aside className={open ? 'open' : ''}>
    <div className="brand"><span>VL</span><div><b>VIOLET LEDGER</b><small>PROCUREMENT CONTROL</small></div><button onClick={() => setOpen(false)}><X/></button></div>
    <div className="side-caption"><span>CN</span><i/><span>BY</span></div>
    <nav>{navItems.map(([id,Icon,label],index) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setOpen(false) }}><small>0{index + 1}</small><Icon/><span>{label}</span></button>)}</nav>
    <footer><div className="avatar">{profile?.email?.[0]?.toUpperCase()}</div><span><b>{profile?.email}</b><small>{profile?.role === 'admin' ? 'Администратор' : profile?.role === 'editor' ? 'Редактор' : 'Просмотр'}</small></span><button title="Выйти" onClick={() => supabase.auth.signOut()}><LogOut/></button></footer>
  </aside></>
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [signal, setSignal] = useState(null)
  const [filter, setFilter] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setProfile(null); setLoading(false) })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => setProfile(data || { id:session.user.id, email:session.user.email, role:'viewer' }))
  }, [session])

  function navigate(destination, nextFilter = null) {
    setPage(destination); setFilter(nextFilter); setSignal(nextFilter?.id ? { type:`open-${destination}`, id:nextFilter.id, nonce:Date.now() } : null)
  }
  function create(type, seed = null) {
    setPage(type); setFilter(null); setSignal({ type, seed, nonce:Date.now() })
  }

  if (loading) return <div className="app-loading"><span>VL</span><b>Загрузка Violet Ledger…</b></div>
  if (!session) return <Login/>
  if (!profile) return <div className="app-loading"><span>VL</span><b>Проверка доступа…</b></div>

  return <div className="app-shell">
    <Sidebar page={page} setPage={destination => navigate(destination)} profile={profile} open={menuOpen} setOpen={setMenuOpen}/>
    <header className="mobile-header"><button onClick={() => setMenuOpen(true)}><Menu/></button><div><b>VIOLET LEDGER</b><small>{navItems.find(([id]) => id === page)?.[2]}</small></div><span>{profile.email[0].toUpperCase()}</span></header>
    <main className="workspace">
      {page === 'dashboard' && <Dashboard onNavigate={navigate} onCreate={create}/>} 
      {page === 'requests' && <Requests profile={profile} session={session} signal={signal} initialFilter={filter} onCreatePI={row => create('pi', row)}/>} 
      {page === 'pi' && <PI profile={profile} session={session} signal={signal} initialFilter={filter} onOpenRequest={id => navigate('requests',{id})} onCreateLogistics={row => create('logistics', row)}/>} 
      {page === 'logistics' && <Logistics profile={profile} session={session} signal={signal} initialFilter={filter} onOpenPI={id => navigate('pi',{id})}/>} 
      {page === 'payments' && <Payments profile={profile} session={session} signal={signal} initialFilter={filter} onOpenPI={id => navigate('pi',{id})}/>} 
    </main>
    <nav className="mobile-nav">{navItems.map(([id,Icon,label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon/><span>{label}</span></button>)}</nav>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)