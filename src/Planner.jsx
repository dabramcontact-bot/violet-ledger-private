import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, CircleDot, Clock3, Columns3,
  Download, GripVertical, List, Pencil, Plus, Trash2, UserRound, UsersRound
} from 'lucide-react'
import {
  canEdit, deleteRow, exportExcel, formatDate, loadRows, saveRow, supabase, text, today
} from './data'
import {
  BusyButton, Drawer, EmptyState, ErrorBanner, Field, FormSection, PageHeader, SearchBox
} from './components'
import './planner.css'

const taskStatuses = {
  backlog: 'Запланировано',
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Готово'
}

const priorities = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный'
}

const categories = ['Общее', 'Запросы', 'PI', 'Логистика', 'Платежи', 'Маркетплейсы']
const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }

const blank = profile => ({
  task_number: '',
  title: '',
  description: '',
  status: 'todo',
  priority: 'normal',
  category: 'Общее',
  assignee_id: profile?.id || '',
  start_date: today(),
  due_date: '',
  related_ref: '',
  tags: []
})

const normalize = task => ({
  ...blank(),
  ...task,
  assignee_id: task.assignee_id || '',
  start_date: task.start_date || '',
  due_date: task.due_date || '',
  tags: Array.isArray(task.tags) ? task.tags : []
})

const isOverdue = task => task.status !== 'done' && task.due_date && task.due_date < today()
const initials = email => String(email || '?').split('@')[0].split(/[._-]/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
const shortEmail = email => String(email || 'Не назначен').split('@')[0]

function TaskCard({ task, profileById, editable, onOpen, onMove }) {
  const assignee = profileById.get(task.assignee_id)
  return <article
    className={`planner-card priority-${task.priority} ${isOverdue(task) ? 'overdue' : ''}`}
    draggable={editable}
    onDragStart={event => event.dataTransfer.setData('text/task-id', task.id)}
    onClick={() => onOpen(task)}
  >
    <header>
      <span className={`priority-badge priority-${task.priority}`}>{priorities[task.priority]}</span>
      {editable && <GripVertical/>}
    </header>
    <h3>{task.title}</h3>
    {task.description && <p>{task.description}</p>}
    <div className="planner-card-tags">
      <span>{task.category}</span>
      {task.related_ref && <span>{task.related_ref}</span>}
      {task.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
    </div>
    <footer>
      <span className={isOverdue(task) ? 'task-date overdue' : 'task-date'}>
        {isOverdue(task) ? <AlertTriangle/> : <CalendarDays/>}
        {task.due_date ? formatDate(task.due_date) : 'Без срока'}
      </span>
      <span className="task-assignee" title={assignee?.email || 'Исполнитель не назначен'}>
        <i>{assignee ? initials(assignee.email) : '?'}</i>{shortEmail(assignee?.email)}
      </span>
    </footer>
    {editable && task.status !== 'done' && <button
      className="planner-quick-complete"
      type="button"
      title="Отметить выполненной"
      onClick={event => { event.stopPropagation(); onMove(task, 'done') }}
    ><CheckCircle2/></button>}
  </article>
}

export default function Planner({ profile, session, signal }) {
  const [rows, setRows] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [view, setView] = useState('board')
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [category, setCategory] = useState('all')
  const [scope, setScope] = useState('active')
  const editable = canEdit(profile)

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [tasks, team] = await Promise.all([
        loadRows('planner_tasks'),
        loadRows('profiles', 'email', { ascending: true, select: 'id,email,role' })
      ])
      setRows(tasks.map(normalize))
      setProfiles(team)
    } catch (reason) { setError(reason) }
    finally { if (!quiet) setLoading(false) }
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('violet-ledger-planner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_tasks' }, () => load({ quiet: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load({ quiet: true }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => { if (signal?.type === 'planner') setEditor(blank(profile)) }, [signal, profile])

  const profileById = useMemo(() => new Map(profiles.map(item => [item.id, item])), [profiles])
  const filtered = useMemo(() => rows.filter(task => {
    const owner = profileById.get(task.assignee_id)?.email || ''
    const haystack = [task.task_number, task.title, task.description, task.category, task.related_ref, owner, ...task.tags].join(' ').toLowerCase()
    const scopeMatch = scope === 'all'
      || (scope === 'active' && task.status !== 'done')
      || (scope === 'mine' && task.assignee_id === profile.id && task.status !== 'done')
      || (scope === 'overdue' && isOverdue(task))
      || (scope === 'done' && task.status === 'done')
    return scopeMatch
      && (!query || haystack.includes(query.toLowerCase()))
      && (assignee === 'all' || task.assignee_id === assignee)
      && (category === 'all' || task.category === category)
  }).sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff) return priorityDiff
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  }), [rows, profileById, scope, query, assignee, category, profile.id])

  const summary = {
    active: rows.filter(task => task.status !== 'done').length,
    mine: rows.filter(task => task.assignee_id === profile.id && task.status !== 'done').length,
    overdue: rows.filter(isOverdue).length,
    done: rows.filter(task => task.status === 'done').length
  }

  async function save() {
    if (!text(editor.title)) { setError('Введите название задачи.'); return }
    if (editor.start_date && editor.due_date && editor.due_date < editor.start_date) {
      setError('Срок выполнения не может быть раньше даты начала.'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        ...editor,
        title: text(editor.title),
        description: text(editor.description),
        category: text(editor.category) || 'Общее',
        related_ref: text(editor.related_ref),
        assignee_id: editor.assignee_id || null,
        start_date: editor.start_date || null,
        due_date: editor.due_date || null,
        tags: editor.tags.map(text).filter(Boolean)
      }
      const saved = normalize(await saveRow('planner_tasks', payload, session.user.id))
      setRows(current => [saved, ...current.filter(task => task.id !== saved.id)])
      setEditor(null)
    } catch (reason) { setError(reason) }
    finally { setSaving(false) }
  }

  async function remove(task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return
    try {
      await deleteRow('planner_tasks', task.id)
      setRows(current => current.filter(item => item.id !== task.id))
      setEditor(null)
    } catch (reason) { setError(reason) }
  }

  async function move(task, status) {
    if (!editable || task.status === status) return
    const previous = task.status
    setRows(current => current.map(item => item.id === task.id ? { ...item, status } : item))
    try {
      const saved = normalize(await saveRow('planner_tasks', { ...task, status }, session.user.id))
      setRows(current => current.map(item => item.id === saved.id ? saved : item))
      if (editor?.id === saved.id) setEditor(saved)
    } catch (reason) {
      setRows(current => current.map(item => item.id === task.id ? { ...item, status: previous } : item))
      setError(reason)
    }
  }

  function exportRows() {
    exportExcel('Planner', filtered, [
      ['task_number', 'Номер'],
      ['title', 'Задача'],
      ['status', 'Статус', value => taskStatuses[value]],
      ['priority', 'Приоритет', value => priorities[value]],
      ['category', 'Направление'],
      ['assignee_id', 'Исполнитель', value => profileById.get(value)?.email || ''],
      ['start_date', 'Начало', value => formatDate(value)],
      ['due_date', 'Срок', value => formatDate(value)],
      ['related_ref', 'Связанный документ'],
      ['description', 'Описание']
    ])
  }

  return <div className="page planner-page">
    <PageHeader eyebrow="TEAM WORKSPACE" title="Планнер" description="Общие задачи команды, исполнители и сроки — с синхронизацией в реальном времени." action={editable ? () => setEditor(blank(profile)) : null} actionLabel="Создать задачу" icon={Plus}/>
    <ErrorBanner error={error} onClose={() => setError('')}/>

    <section className="planner-summary">
      <button className={scope === 'active' ? 'active' : ''} onClick={() => setScope('active')}><CircleDot/><span><small>АКТИВНЫЕ</small><b>{summary.active}</b></span></button>
      <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}><UserRound/><span><small>МОИ ЗАДАЧИ</small><b>{summary.mine}</b></span></button>
      <button className={`danger ${scope === 'overdue' ? 'active' : ''}`} onClick={() => setScope('overdue')}><Clock3/><span><small>ПРОСРОЧЕНО</small><b>{summary.overdue}</b></span></button>
      <button className={scope === 'done' ? 'active' : ''} onClick={() => setScope('done')}><CheckCircle2/><span><small>ВЫПОЛНЕНО</small><b>{summary.done}</b></span></button>
    </section>

    <section className="planner-toolbar">
      <SearchBox value={query} onChange={setQuery} placeholder="Задача, документ, тег или сотрудник"/>
      <select value={assignee} onChange={event => setAssignee(event.target.value)}><option value="all">Все сотрудники</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.email}</option>)}</select>
      <select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Все направления</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
      <div className="planner-view-switch"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')} title="Доска"><Columns3/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="Список"><List/></button></div>
      <button className="secondary planner-export" onClick={exportRows}><Download/> Excel</button>
    </section>

    {loading ? <div className="loading-state">Загрузка планнера…</div> : !filtered.length ? <EmptyState icon={UsersRound} title="Задачи не найдены" text={rows.length ? 'Измените фильтры или создайте новую задачу.' : 'Создайте первую общую задачу команды.'} action={editable ? () => setEditor(blank(profile)) : null} actionLabel="Создать задачу"/> : view === 'board' ? <section className="planner-board">
      {Object.entries(taskStatuses).map(([status, label]) => {
        const tasks = filtered.filter(task => task.status === status)
        return <div className={`planner-column column-${status}`} key={status} onDragOver={event => editable && event.preventDefault()} onDrop={event => {
          event.preventDefault()
          const task = rows.find(item => item.id === event.dataTransfer.getData('text/task-id'))
          if (task) move(task, status)
        }}>
          <header><span><i/><b>{label}</b></span><em>{tasks.length}</em></header>
          <div>{tasks.map(task => <TaskCard key={task.id} task={task} profileById={profileById} editable={editable} onOpen={item => setEditor(normalize(item))} onMove={move}/>)}</div>
          {editable && <button className="planner-column-add" onClick={() => setEditor({ ...blank(profile), status })}><Plus/> Добавить задачу</button>}
        </div>
      })}
    </section> : <section className="planner-list register-panel">
      <div className="data-table"><table><thead><tr><th>Задача</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>Направление</th><th>Срок</th><th/></tr></thead><tbody>{filtered.map(task => {
        const owner = profileById.get(task.assignee_id)
        return <tr key={task.id} className={isOverdue(task) ? 'overdue-row' : ''}><td><button className="table-link" onClick={() => setEditor(normalize(task))}>{task.title}</button><small>{task.task_number}</small></td><td><span className={`planner-status status-${task.status}`}>{taskStatuses[task.status]}</span></td><td><span className={`priority-badge priority-${task.priority}`}>{priorities[task.priority]}</span></td><td><span className="task-assignee"><i>{owner ? initials(owner.email) : '?'}</i>{shortEmail(owner?.email)}</span></td><td>{task.category}</td><td><span className={isOverdue(task) ? 'task-date overdue' : 'task-date'}>{isOverdue(task) && <AlertTriangle/>}{task.due_date ? formatDate(task.due_date) : '—'}</span></td><td><div className="row-actions"><button onClick={() => setEditor(normalize(task))}><Pencil/></button>{editable && <button className="danger" onClick={() => remove(task)}><Trash2/></button>}</div></td></tr>
      })}</tbody></table></div>
    </section>}

    {editor && <Drawer wide title={editor.id ? editor.title : 'Новая задача'} subtitle={editor.task_number || 'TEAM TASK'} onClose={() => setEditor(null)} footer={<>{editor.id && editable && <button className="danger-button" onClick={() => remove(editor)}><Trash2/> Удалить</button>}<span className="footer-note">Изменения увидят все сотрудники</span>{editable && <BusyButton className="primary" busy={saving} onClick={save}>Сохранить задачу</BusyButton>}</>}>
      <fieldset className="planner-fieldset" disabled={!editable}>
        <FormSection index="01" title="Задача" text="Коротко сформулируйте результат, который нужно получить.">
          <Field label="Название *" wide><input value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} placeholder="Например, согласовать финальную версию PI"/></Field>
          <Field label="Описание" wide><textarea rows="4" value={editor.description} onChange={event => setEditor({ ...editor, description: event.target.value })} placeholder="Детали, критерий готовности или важный контекст"/></Field>
          <Field label="Направление"><select value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })}>{categories.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Связанный документ"><input value={editor.related_ref} onChange={event => setEditor({ ...editor, related_ref: event.target.value })} placeholder="REQ-, PI-, LOG- или PAY-"/></Field>
        </FormSection>
        <FormSection index="02" title="Ответственный и статус" text="Задача появится на общей доске и у назначенного сотрудника.">
          <Field label="Исполнитель"><select value={editor.assignee_id} onChange={event => setEditor({ ...editor, assignee_id: event.target.value })}><option value="">Не назначен</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.email}</option>)}</select></Field>
          <Field label="Статус"><select value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value })}>{Object.entries(taskStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Приоритет"><select value={editor.priority} onChange={event => setEditor({ ...editor, priority: event.target.value })}>{Object.entries(priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Теги"><input value={editor.tags.join(', ')} onChange={event => setEditor({ ...editor, tags: event.target.value.split(',') })} placeholder="поставщик, срочно, проверка"/></Field>
        </FormSection>
        <FormSection index="03" title="Сроки" text="Просроченные незавершённые задачи подсвечиваются автоматически.">
          <Field label="Дата начала"><input type="date" value={editor.start_date} onChange={event => setEditor({ ...editor, start_date: event.target.value })}/></Field>
          <Field label="Срок выполнения"><input type="date" value={editor.due_date} onChange={event => setEditor({ ...editor, due_date: event.target.value })}/></Field>
        </FormSection>
      </fieldset>
    </Drawer>}
  </div>
}
