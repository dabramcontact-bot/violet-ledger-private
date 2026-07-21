import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Clock3, CopyPlus, ListTodo, Pencil, PlayCircle, Plus, Sparkles, Trash2, UserRound, XCircle } from 'lucide-react'
import { canEdit, deleteRow, saveRow, supabase, text, today } from './data'
import { BusyButton, Drawer, EmptyState, ErrorBanner, Field, FormSection, SearchBox, StatusPill } from './components'
import './planner.css'

const TABLE = 'daily_planner_tasks'

const statusLabels = {
  planned: 'Запланировано',
  in_progress: 'В работе',
  done: 'Выполнено',
  cancelled: 'Отменено'
}

const priorityLabels = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочно'
}

const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().slice(0, 10)
}

function addMonths(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  return date.toISOString().slice(0, 10)
}

function dateTitle(value) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))
}

function compactDateTitle(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
    .format(new Date(`${value}T12:00:00`))
}

function monthTitle(value) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))
}

function shortWeekday(value) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
    .format(new Date(`${value}T12:00:00`))
    .replace('.', '')
}

function dayNumber(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function monthCells(value) {
  const current = new Date(`${value}T12:00:00`)
  const first = new Date(current.getFullYear(), current.getMonth(), 1, 12)
  const offset = (first.getDay() + 6) % 7
  const firstValue = first.toISOString().slice(0, 10)
  return Array.from({ length: 42 }, (_, index) => addDays(firstValue, index - offset))
}

function sameMonth(left, right) {
  return left.slice(0, 7) === right.slice(0, 7)
}

const timeValue = value => value ? String(value).slice(0, 5) : ''
const assigneeName = value => text(value).split('@')[0] || 'Не назначен'
const assigneeInitial = value => assigneeName(value).slice(0, 1).toUpperCase()

const blank = (date, email) => ({
  task_date: date,
  start_time: '',
  end_time: '',
  title: '',
  description: '',
  category: '',
  assignee_email: email || '',
  priority: 'normal',
  status: 'planned',
  completed_at: null,
  sort_order: 0
})

function normalize(row) {
  return {
    ...blank(row.task_date || today(), row.assignee_email),
    ...row,
    start_time: timeValue(row.start_time),
    end_time: timeValue(row.end_time)
  }
}

function taskTime(row) {
  if (!row.start_time) return 'Без времени'
  return row.end_time ? `${timeValue(row.start_time)}–${timeValue(row.end_time)}` : timeValue(row.start_time)
}

export default function Planner({ profile, session, signal }) {
  const [selectedDate, setSelectedDate] = useState(today())
  const [rows, setRows] = useState([])
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const editable = canEdit(profile)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error: loadError } = await supabase
        .from(TABLE)
        .select('*')
        .order('task_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (loadError) throw loadError
      setRows((data || []).map(normalize))
    } catch (reason) {
      setError(reason)
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignees() {
    const { data } = await supabase.from('profiles').select('email').order('email')
    const emails = [...new Set([profile?.email, ...(data || []).map(item => item.email)].filter(Boolean))]
    setAssignees(emails)
  }

  useEffect(() => {
    load()
    loadAssignees()
    const channel = supabase.channel('daily-planner-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (signal?.type === 'planner') setEditor(blank(selectedDate, profile?.email))
  }, [signal])

  const calendarDays = useMemo(() => monthCells(selectedDate), [selectedDate])
  const nearbyDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3)), [selectedDate])
  const dayRows = useMemo(() => rows
    .filter(row => row.task_date === selectedDate)
    .filter(row => {
      const haystack = [row.title, row.description, row.category, row.assignee_email].join(' ').toLowerCase()
      return (!query || haystack.includes(query.toLowerCase()))
        && (status === 'all' || row.status === status)
        && (assignee === 'all' || row.assignee_email === assignee)
    })
    .sort((a, b) => {
      const timeA = a.start_time || '99:99'
      const timeB = b.start_time || '99:99'
      return timeA.localeCompare(timeB) || (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) || a.title.localeCompare(b.title)
    }), [rows, selectedDate, query, status, assignee])

  const allDayRows = rows.filter(row => row.task_date === selectedDate)
  const summary = {
    total: allDayRows.length,
    done: allDayRows.filter(row => row.status === 'done').length,
    inProgress: allDayRows.filter(row => row.status === 'in_progress').length,
    overdue: allDayRows.filter(row => row.status === 'cancelled').length,
    remaining: allDayRows.filter(row => !['done', 'cancelled'].includes(row.status)).length
  }
  const progress = summary.total ? Math.round(summary.done / summary.total * 100) : 0
  const categories = [...new Set(rows.map(row => row.category).filter(Boolean))].sort()
  const prioritySummary = Object.keys(priorityLabels).map(key => [key, allDayRows.filter(row => row.priority === key && row.status !== 'cancelled').length])

  async function save() {
    if (!editor || !text(editor.task_date) || !text(editor.title)) {
      setError('Заполните дату и название задачи.')
      return
    }
    if (editor.start_time && editor.end_time && editor.end_time < editor.start_time) {
      setError('Время окончания не может быть раньше времени начала.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...editor,
        title: text(editor.title),
        description: text(editor.description),
        category: text(editor.category),
        assignee_email: text(editor.assignee_email),
        start_time: editor.start_time || null,
        end_time: editor.end_time || null,
        completed_at: editor.status === 'done' ? editor.completed_at || new Date().toISOString() : null
      }
      const saved = normalize(await saveRow(TABLE, payload, session.user.id))
      setRows(current => [saved, ...current.filter(row => row.id !== saved.id)])
      setSelectedDate(saved.task_date)
      setEditor(null)
    } catch (reason) {
      setError(reason)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(row, nextStatus) {
    if (!editable) return
    setError('')
    try {
      const payload = {
        status: nextStatus,
        completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
        updated_by: session.user.id
      }
      const { data, error: updateError } = await supabase.from(TABLE).update(payload).eq('id', row.id).select().single()
      if (updateError) throw updateError
      setRows(current => current.map(item => item.id === row.id ? normalize(data) : item))
    } catch (reason) {
      setError(reason)
    }
  }

  async function moveToTomorrow(row) {
    if (!editable) return
    setError('')
    try {
      const payload = {
        task_date: addDays(row.task_date, 1),
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        title: row.title,
        description: row.description || '',
        category: row.category || '',
        assignee_email: row.assignee_email || '',
        priority: row.priority || 'normal',
        status: 'planned',
        completed_at: null,
        sort_order: row.sort_order || 0,
        created_by: session.user.id,
        updated_by: session.user.id
      }
      const { data, error: insertError } = await supabase.from(TABLE).insert(payload).select().single()
      if (insertError) throw insertError
      setRows(current => [...current, normalize(data)])
    } catch (reason) {
      setError(reason)
    }
  }

  async function remove(row) {
    if (!editable || !window.confirm(`Удалить задачу «${row.title}»?`)) return
    setError('')
    try {
      await deleteRow(TABLE, row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setEditor(null)
    } catch (reason) {
      setError(reason)
    }
  }

  return <div className="page planner-page planner-redesign">
    <header className="planner-hero">
      <div><small>DAILY PLANNER</small><h1>Планер</h1><p>Ваш день под контролем</p></div>
      <div className="planner-hero-actions">
        <div className="planner-date-switcher"><button onClick={() => setSelectedDate(addDays(selectedDate, -1))} title="Предыдущий день"><ChevronLeft/></button><button className="planner-date-label" onClick={() => setSelectedDate(today())}>{compactDateTitle(selectedDate)}</button><button onClick={() => setSelectedDate(addDays(selectedDate, 1))} title="Следующий день"><ChevronRight/></button></div>
        <button className="planner-today-button" onClick={() => setSelectedDate(today())}>Сегодня</button>
        {editable && <button className="primary planner-new-task" onClick={() => setEditor(blank(selectedDate, profile?.email))}><Plus/> Новая задача</button>}
      </div>
    </header>

    <ErrorBanner error={error} onClose={() => setError('')}/>

    <section className="planner-overview-cards">
      <article className="overview-total"><span><small>Всего задач</small><b>{summary.total}</b></span><CalendarDays/></article>
      <article className="overview-progress"><span><small>В работе</small><b>{summary.inProgress}</b></span><PlayCircle/></article>
      <article className="overview-done"><span><small>Выполнено</small><b>{summary.done}</b></span><CheckCircle2/></article>
      <article className="overview-cancelled"><span><small>Отменено</small><b>{summary.overdue}</b></span><XCircle/></article>
    </section>

    <section className="planner-content-grid">
      <section className="planner-day-card">
        <header className="planner-day-header"><div><small>МОЙ ДЕНЬ</small><h2>{dateTitle(selectedDate)}</h2><p>{summary.total ? `Выполнено ${summary.done} из ${summary.total}` : 'Свободный день — можно запланировать главное'}</p></div><div className="planner-day-progress"><b>{progress}%</b><span><i style={{ width: `${progress}%` }}/></span></div></header>

        <div className="planner-nearby-days">{nearbyDays.map(date => <button key={date} className={`${date === selectedDate ? 'active' : ''} ${date === today() ? 'today' : ''}`} onClick={() => setSelectedDate(date)}><small>{shortWeekday(date)}</small><b>{dayNumber(date)}</b><i>{rows.filter(row => row.task_date === date && row.status !== 'cancelled').length}</i></button>)}</div>

        <div className="planner-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Найти задачу"/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={assignee} onChange={event => setAssignee(event.target.value)}><option value="all">Все ответственные</option>{assignees.map(email => <option key={email} value={email}>{email}</option>)}</select></div>

        {loading ? <div className="loading-state">Загрузка планера…</div> : !dayRows.length ? <EmptyState icon={ListTodo} title="Задач на день нет" text={allDayRows.length ? 'Измените поиск или фильтры.' : 'Добавьте первую задачу на выбранный день.'} action={editable ? () => setEditor(blank(selectedDate, profile?.email)) : null} actionLabel="Добавить задачу"/> : <div className="planner-clean-list">{dayRows.map(row => <article key={row.id} className={`planner-clean-task status-${row.status} priority-${row.priority}`}>
          <button className="planner-clean-check" disabled={!editable} onClick={() => updateStatus(row, row.status === 'done' ? 'planned' : 'done')} title={row.status === 'done' ? 'Вернуть в план' : 'Отметить выполненной'}>{row.status === 'done' ? <Check/> : row.status === 'in_progress' ? <PlayCircle/> : row.status === 'cancelled' ? <XCircle/> : <CircleDashed/>}</button>
          <div className="planner-clean-time"><b>{taskTime(row)}</b>{row.category && <small>{row.category}</small>}</div>
          <div className="planner-clean-main"><div><h3>{row.title}</h3><span className={`planner-priority priority-${row.priority}`}>{priorityLabels[row.priority]}</span></div>{row.description && <p>{row.description}</p>}</div>
          <div className="planner-clean-assignee"><span>{assigneeInitial(row.assignee_email)}</span><b>{assigneeName(row.assignee_email)}</b></div>
          <StatusPill value={row.status} labels={statusLabels}/>
          <div className="planner-clean-actions">{editable && <button title="Копировать на завтра" onClick={() => moveToTomorrow(row)}><CopyPlus/></button>}<button title="Открыть" onClick={() => setEditor(normalize(row))}><Pencil/></button>{editable && <button className="danger" title="Удалить" onClick={() => remove(row)}><Trash2/></button>}</div>
        </article>)}</div>}
      </section>

      <aside className="planner-side-stack">
        <section className="planner-calendar-card">
          <header><button onClick={() => setSelectedDate(addMonths(selectedDate, -1))}><ChevronLeft/></button><h3>{monthTitle(selectedDate)}</h3><button onClick={() => setSelectedDate(addMonths(selectedDate, 1))}><ChevronRight/></button></header>
          <div className="planner-calendar-weekdays">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="planner-calendar-grid">{calendarDays.map(date => <button key={date} className={`${date === selectedDate ? 'active' : ''} ${date === today() ? 'today' : ''} ${sameMonth(date, selectedDate) ? '' : 'muted'}`} onClick={() => setSelectedDate(date)}><span>{dayNumber(date)}</span>{rows.some(row => row.task_date === date && row.status !== 'cancelled') && <i/>}</button>)}</div>
        </section>

        <section className="planner-priorities-card"><header><div><small>РАСПРЕДЕЛЕНИЕ</small><h3>Приоритеты</h3></div><span>{summary.total}</span></header><div>{prioritySummary.map(([key, value]) => <article key={key}><i className={`priority-dot priority-${key}`}/><span>{priorityLabels[key]}</span><b>{value}</b></article>)}</div></section>

        <section className="planner-focus-card"><Sparkles/><small>ФОКУС ДНЯ</small><h3>{summary.remaining ? 'Сосредоточьтесь на главном' : 'На сегодня всё готово'}</h3><p>{summary.remaining ? `Осталось ${summary.remaining} ${summary.remaining === 1 ? 'задача' : 'задачи'}. Двигайтесь спокойно, по одной.` : 'Можно завершать день с чистой головой.'}</p><div className="planner-focus-progress"><span style={{ '--planner-progress': `${progress * 3.6}deg` }}><b>{progress}%</b></span><small>прогресс дня</small></div></section>
      </aside>
    </section>

    {editor && <Drawer title={editor.id ? editor.title : 'Новая задача'} subtitle={dateTitle(editor.task_date || selectedDate).toUpperCase()} onClose={() => setEditor(null)} footer={<><span className="footer-note">Задача будет доступна всей команде</span>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<BusyButton className="primary" busy={saving} onClick={save}>Сохранить</BusyButton></>}>
      <FormSection index="01" title="Когда и что сделать" text="Дата, время и короткое название задачи.">
        <Field label="Дата *"><input type="date" value={editor.task_date || ''} onChange={event => setEditor({ ...editor, task_date: event.target.value })}/></Field>
        <Field label="Категория"><input list="planner-category-options" value={editor.category || ''} onChange={event => setEditor({ ...editor, category: event.target.value })} placeholder="Например, Запросы"/><datalist id="planner-category-options">{categories.map(item => <option key={item} value={item}/>)}</datalist></Field>
        <Field label="Начало"><input type="time" value={editor.start_time || ''} onChange={event => setEditor({ ...editor, start_time: event.target.value })}/></Field>
        <Field label="Окончание"><input type="time" value={editor.end_time || ''} onChange={event => setEditor({ ...editor, end_time: event.target.value })}/></Field>
        <Field label="Название задачи *" wide><input value={editor.title || ''} onChange={event => setEditor({ ...editor, title: event.target.value })} placeholder="Что нужно сделать?"/></Field>
        <Field label="Описание" wide><textarea rows="4" value={editor.description || ''} onChange={event => setEditor({ ...editor, description: event.target.value })} placeholder="Детали, ссылки или ожидаемый результат"/></Field>
      </FormSection>
      <FormSection index="02" title="Ответственность и статус" text="Кому поручено и насколько задача срочная.">
        <Field label="Ответственный" wide><input list="planner-assignee-options" value={editor.assignee_email || ''} onChange={event => setEditor({ ...editor, assignee_email: event.target.value })} placeholder="Email участника"/><datalist id="planner-assignee-options">{assignees.map(email => <option key={email} value={email}/>)}</datalist></Field>
        <Field label="Приоритет"><select value={editor.priority || 'normal'} onChange={event => setEditor({ ...editor, priority: event.target.value })}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Статус"><select value={editor.status || 'planned'} onChange={event => setEditor({ ...editor, status: event.target.value })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      </FormSection>
    </Drawer>}
  </div>
}
