import React from 'react'
import { AlertTriangle, Download, FileText, LoaderCircle, Search, X } from 'lucide-react'
import { downloadFile, friendlyError, formatDateTime, removeFile, uploadFile } from './data'

export function StatusPill({ value, labels }) {
  return <span className={`status status-${value || 'neutral'}`}>{labels[value] || value || 'Не указан'}</span>
}

export function PageHeader({ eyebrow, title, description, action, actionLabel, icon: Icon }) {
  return <header className="page-header">
    <div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>
    {action && <button className="primary" onClick={action}>{Icon && <Icon/>}{actionLabel}</button>}
  </header>
}

export function SearchBox({ value, onChange, placeholder }) {
  return <label className="search-box"><Search/><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></label>
}

export function ErrorBanner({ error, onClose }) {
  if (!error) return null
  return <div className="error-banner"><AlertTriangle/><span>{friendlyError(error)}</span>{onClose && <button onClick={onClose}><X/></button>}</div>
}

export function EmptyState({ icon: Icon = FileText, title, text, action, actionLabel }) {
  return <div className="empty-state"><Icon/><b>{title}</b><span>{text}</span>{action && <button className="secondary" onClick={action}>{actionLabel}</button>}</div>
}

export function Drawer({ title, subtitle, children, onClose, footer, wide = false }) {
  return <div className="drawer-layer" role="dialog" aria-modal="true">
    <button className="drawer-backdrop" aria-label="Закрыть" onClick={onClose}/>
    <section className={`drawer ${wide ? 'wide' : ''}`}>
      <header><div><small>{subtitle}</small><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X/></button></header>
      <div className="drawer-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  </div>
}

export function ConfirmDelete({ label, onConfirm }) {
  return <button className="danger-button" onClick={() => window.confirm(`Удалить ${label}? Связанные данные удалены не будут.`) && onConfirm()}>Удалить</button>
}

export function BusyButton({ busy, children, ...props }) {
  return <button {...props} disabled={busy || props.disabled}>{busy && <LoaderCircle className="spin"/>}{children}</button>
}

export function FileList({ files = [], onChange, folder, userId, disabled = false, multiple = true }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  async function add(event) {
    const selected = [...event.target.files]
    if (!selected.length) return
    setBusy(true); setError('')
    try {
      const uploaded = []
      for (const file of selected) uploaded.push(await uploadFile(file, folder, userId))
      onChange([...(files || []), ...uploaded])
    } catch (reason) { setError(reason) } finally { setBusy(false); event.target.value = '' }
  }

  async function drop(file) {
    if (!window.confirm(`Удалить файл «${file.name}»?`)) return
    setBusy(true); setError('')
    try { await removeFile(file.path); onChange(files.filter(item => item.path !== file.path)) }
    catch (reason) { setError(reason) } finally { setBusy(false) }
  }

  return <div className="file-manager">
    <ErrorBanner error={error} onClose={() => setError('')}/>
    <div className="file-list">{files.map(file => <article key={file.path}>
      <FileText/><span><b>{file.name}</b><small>{formatDateTime(file.uploaded_at)}</small></span>
      <button type="button" title="Скачать" onClick={() => downloadFile(file.path, file.name)}><Download/></button>
      {!disabled && <button type="button" title="Удалить" onClick={() => drop(file)}><X/></button>}
    </article>)}</div>
    {!disabled && <label className="file-upload">{busy ? <LoaderCircle className="spin"/> : <FileText/>}<span>{busy ? 'Загрузка…' : 'Прикрепить документ'}</span><input type="file" multiple={multiple} onChange={add} disabled={busy}/></label>}
  </div>
}

export function FormSection({ index, title, text, children }) {
  return <section className="form-section"><div className="form-section-title"><span>{index}</span><div><b>{title}</b>{text && <small>{text}</small>}</div></div><div className="form-grid">{children}</div></section>
}

export function Field({ label, wide = false, children }) {
  return <label className={wide ? 'wide-field' : ''}><span>{label}</span>{children}</label>
}
