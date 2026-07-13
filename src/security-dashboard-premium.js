import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SECTION_SELECTOR = '.story-cards[data-scene="security"]'
let frame = 0
let activeSection = null
let activeShell = null
let liveChannel = null
let loadingPromise = null

const icons = {
  shield: '<path d="M12 3 20 6v5c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 9-9M15 8l2 2M17 6l2 2"/>',
  activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
}

function svg(name, className = '') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.shield}</svg>`
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const plural = (value, one, few, many) => {
  const number = Math.abs(Number(value) || 0) % 100
  const tail = number % 10
  if (number > 10 && number < 20) return many
  if (tail === 1) return one
  if (tail >= 2 && tail <= 4) return few
  return many
}

function formatEventTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date)
}

function actionText(log) {
  const request = log.request_number ? ` ${log.request_number}` : ''
  if (log.action === 'INSERT') return `создал(а) запрос${request}`
  if (log.action === 'DELETE') return `удалил(а) запрос${request}`
  return `обновил(а) запрос${request}`
}

function initials(value) {
  const source = String(value || 'Система').split('@')[0]
  return source.split(/[.\s_-]+/).filter(Boolean).slice(0, 2).map(item => item[0]).join('').toUpperCase() || 'VL'
}

function emptyData() {
  return { profiles: [], logs: [], totalEvents: null, profilesError: false, logsError: false }
}

async function loadSecurityData(force = false) {
  if (loadingPromise && !force) return loadingPromise

  loadingPromise = (async () => {
    const [profilesResult, logsResult] = await Promise.all([
      supabase.from('profiles').select('id,email,role,created_at').order('created_at', { ascending: true }).limit(500),
      supabase.from('audit_log').select('id,actor_email,action,request_number,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(8),
    ])

    return {
      profiles: profilesResult.error ? [] : (profilesResult.data || []),
      logs: logsResult.error ? [] : (logsResult.data || []),
      totalEvents: logsResult.error ? null : (logsResult.count ?? logsResult.data?.length ?? 0),
      profilesError: Boolean(profilesResult.error),
      logsError: Boolean(logsResult.error),
    }
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}

function createShell() {
  const shell = document.createElement('div')
  shell.className = 'security-premium-shell'
  shell.innerHTML = `
    <header class="security-premium-heading">
      <div class="security-premium-badge">${svg('shield')}<span>Ваша система под контролем</span></div>
      <h2>Защита без лишнего шума.</h2>
      <p>Роли, правила доступа и журнал изменений работают в фоне — спокойно, прозрачно и без ручного контроля.</p>
    </header>

    <div class="security-premium-grid">
      <article class="security-premium-card security-access-card">
        <div class="security-card-head">
          <span class="security-card-icon tone-violet">${svg('shield')}</span>
          <div><small>RLS / ACCESS</small><h3>Данные защищены.<br>Доступ — только по ролям.</h3></div>
        </div>
        <p class="security-card-description">Политики доступа отделяют просмотр от редактирования и административных действий.</p>
        <div class="security-layers" aria-hidden="true">
          <div class="security-layer layer-back"></div>
          <div class="security-layer layer-middle"></div>
          <div class="security-layer layer-front">${svg('shield')}</div>
          <span class="security-signal signal-one"></span>
          <span class="security-signal signal-two"></span>
          <span class="security-signal signal-three"></span>
          <div class="security-role-tag role-admin"><b>Admin</b><small>Полный доступ</small></div>
          <div class="security-role-tag role-editor"><b>Editor</b><small>Рабочие изменения</small></div>
          <div class="security-role-tag role-viewer"><b>Viewer</b><small>Только просмотр</small></div>
        </div>
        <div class="security-card-metrics security-access-metrics">
          <span><i>${svg('lock')}</i><b data-security-metric="roles">—</b><small>активных ролей</small></span>
          <span><i>${svg('users')}</i><b data-security-metric="users">—</b><small>пользователей</small></span>
          <span><i>${svg('shield')}</i><b>RLS</b><small>защита данных</small></span>
        </div>
      </article>

      <article class="security-premium-card security-permissions-card">
        <div class="security-card-head">
          <span class="security-card-icon tone-gold">${svg('users')}</span>
          <div><small>PERMISSIONS</small><h3>Команда видит только<br>разрешённую информацию.</h3></div>
        </div>
        <p class="security-card-description">Уровень доступа каждого пользователя определяется его ролью в системе.</p>
        <div class="security-permission-list">
          <div class="security-permission-row" data-role="viewer">
            <i>${svg('eye')}</i><span><b>Просмотр</b><small>Без изменения данных</small></span><strong data-security-role="viewer">—</strong><em><u></u></em>
          </div>
          <div class="security-permission-row" data-role="editor">
            <i>${svg('pencil')}</i><span><b>Редактирование</b><small>Работа с запросами</small></span><strong data-security-role="editor">—</strong><em><u></u></em>
          </div>
          <div class="security-permission-row" data-role="admin">
            <i>${svg('key')}</i><span><b>Администраторы</b><small>Полный контроль системы</small></span><strong data-security-role="admin">—</strong><em><u></u></em>
          </div>
        </div>
        <div class="security-permissions-footer">
          <span><b data-security-metric="users-footer">—</b><small>пользователей</small></span>
          <span><b>Live</b><small>контроль доступа</small></span>
          <button type="button" data-security-go="access">Открыть доступ ${svg('arrow')}</button>
        </div>
      </article>

      <article class="security-premium-card security-audit-card">
        <div class="security-card-head">
          <span class="security-card-icon tone-pink">${svg('file')}</span>
          <div><small>AUDIT TRAIL</small><h3>Каждое изменение<br>фиксируется автоматически.</h3></div>
        </div>
        <p class="security-card-description">Журнал сохраняет автора, действие, номер запроса и точное время события.</p>
        <div class="security-audit-window">
          <div class="security-audit-window-head"><span>${svg('activity')} Журнал действий</span><button type="button" data-security-go="audit">Смотреть все</button></div>
          <div class="security-audit-list" aria-live="polite"></div>
        </div>
        <div class="security-card-metrics security-audit-metrics">
          <span><b data-security-metric="events">—</b><small>всего событий</small></span>
          <span><b data-security-metric="today">—</b><small>сегодня</small></span>
          <span><b>24/7</b><small>мониторинг</small></span>
        </div>
      </article>
    </div>

    <div class="security-premium-footnote">${svg('lock')}<span>Безопасность данных встроена в каждое действие системы</span></div>
  `

  shell.addEventListener('click', event => {
    const target = event.target.closest('[data-security-go]')
    if (!target) return
    const label = target.dataset.securityGo === 'audit' ? 'Журнал' : 'Доступ'
    const navButton = [...document.querySelectorAll('aside nav button')].find(button => button.textContent.includes(label))
    navButton?.click()
  })

  return shell
}

function renderAuditList(shell, data) {
  const list = shell.querySelector('.security-audit-list')
  if (!list) return

  if (data.logsError) {
    list.innerHTML = '<div class="security-audit-state"><b>Журнал недоступен</b><span>Недостаточно прав для просмотра событий.</span></div>'
    return
  }
  if (!data.logs.length) {
    list.innerHTML = '<div class="security-audit-state"><b>Событий пока нет</b><span>Новые изменения появятся здесь автоматически.</span></div>'
    return
  }

  list.innerHTML = data.logs.slice(0, 4).map((log, index) => `
    <div class="security-audit-item tone-${index % 4}">
      <i>${escapeHtml(initials(log.actor_email))}</i>
      <span><b>${escapeHtml(log.actor_email || 'Система')}</b><small>${escapeHtml(actionText(log))}</small></span>
      <time>${escapeHtml(formatEventTime(log.created_at))}</time>
    </div>
  `).join('')
}

function renderData(shell, data) {
  const roleCounts = { admin: 0, editor: 0, viewer: 0 }
  data.profiles.forEach(profile => {
    const role = profile.role in roleCounts ? profile.role : 'viewer'
    roleCounts[role] += 1
  })

  const uniqueRoles = data.profiles.length ? Object.values(roleCounts).filter(Boolean).length : 0
  const setMetric = (name, value) => shell.querySelectorAll(`[data-security-metric="${name}"]`).forEach(node => { node.textContent = value })
  setMetric('roles', data.profilesError ? '—' : String(uniqueRoles))
  setMetric('users', data.profilesError ? '—' : String(data.profiles.length))
  setMetric('users-footer', data.profilesError ? '—' : String(data.profiles.length))
  setMetric('events', data.logsError || data.totalEvents === null ? '—' : String(data.totalEvents))

  const today = new Date().toDateString()
  const todayCount = data.logs.filter(log => new Date(log.created_at).toDateString() === today).length
  setMetric('today', data.logsError ? '—' : String(todayCount))

  const maxRoleCount = Math.max(...Object.values(roleCounts), 1)
  Object.entries(roleCounts).forEach(([role, count]) => {
    shell.querySelectorAll(`[data-security-role="${role}"]`).forEach(node => { node.textContent = data.profilesError ? '—' : String(count) })
    const bar = shell.querySelector(`[data-role="${role}"] em u`)
    if (bar) bar.style.width = data.profilesError ? '0%' : `${Math.max(count / maxRoleCount * 100, count ? 12 : 0)}%`
  })

  shell.querySelectorAll('.security-role-tag').forEach(tag => {
    const role = tag.classList.contains('role-admin') ? 'admin' : tag.classList.contains('role-editor') ? 'editor' : 'viewer'
    const count = roleCounts[role]
    const small = tag.querySelector('small')
    if (small && !data.profilesError) small.textContent = `${count} ${plural(count, 'пользователь', 'пользователя', 'пользователей')}`
  })

  renderAuditList(shell, data)
}

async function refresh(shell, force = false) {
  shell.classList.add('is-loading')
  try {
    const data = await loadSecurityData(force)
    if (shell.isConnected) renderData(shell, data)
  } catch (error) {
    if (shell.isConnected) renderData(shell, { ...emptyData(), profilesError: true, logsError: true })
    console.warn('[security-premium] Could not load security data:', error)
  } finally {
    shell.classList.remove('is-loading')
  }
}

function ensureMounted() {
  frame = 0
  const section = document.querySelector(SECTION_SELECTOR)
  if (!section) {
    activeSection = null
    activeShell = null
    return
  }
  if (activeSection === section && activeShell?.isConnected) return

  section.classList.add('security-premium-source')
  section.querySelectorAll(':scope > .security-premium-shell').forEach(node => node.remove())
  const shell = createShell()
  section.append(shell)
  activeSection = section
  activeShell = shell
  requestAnimationFrame(() => shell.classList.add('is-ready'))
  refresh(shell)
}

function scheduleMount() {
  if (!frame) frame = requestAnimationFrame(ensureMounted)
}

function subscribeLive() {
  if (liveChannel) return
  liveChannel = supabase
    .channel('security-dashboard-premium-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, () => activeShell && refresh(activeShell, true))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => activeShell && refresh(activeShell, true))
    .subscribe()
}

subscribeLive()
scheduleMount()
const root = document.getElementById('root') || document.body
new MutationObserver(scheduleMount).observe(root, { childList: true, subtree: true })
