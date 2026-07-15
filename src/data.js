import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewecfqgjkihlhftstbuu.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_KSQAViRvjfL3FP4l-qaBiQ_YLOh_YRI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
export const FILE_BUCKET = 'violet-ledger-files'
export const currencies = ['USD', 'EUR', 'CNY', 'BYN', 'RUB']
export const requestStatuses = {
  request: 'Запрос отправлен',
  offer: 'Предложение получено',
  calculation: 'Внесено в расчёт'
}
export const piStatuses = {
  requested: 'PI запрошено',
  verification: 'Сверка характеристик',
  confirmed: 'Характеристики подтверждены',
  signed: 'PI подписано',
  ved: 'Отправлено в ВЭД'
}
export const logisticsStatuses = {
  waiting: 'Ожидает отправки',
  ready: 'Готов к выезду',
  transit: 'В пути',
  arrived: 'Прибыл на склад',
  delayed: 'Задерживается'
}
export const paymentStatuses = {
  planned: 'Ожидает оплаты',
  partial: 'Частично оплачено',
  paid: 'Оплачено',
  overdue: 'Просрочено',
  cancelled: 'Отменено'
}

export const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const uid = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
export const text = value => String(value ?? '').trim()
export const number = value => value === '' || value == null ? null : Number(value)
export const formatDate = value => value ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)) : '—'
export const formatDateTime = value => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
export const formatMoney = (value, currency = '') => value == null || value === ''
  ? '—'
  : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))}${currency ? ` ${currency}` : ''}`

export function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/row-level security|permission denied|42501/i.test(message)) return 'Недостаточно прав для этого действия.'
  if (/relation .* does not exist|column .* does not exist|schema cache/i.test(message)) return 'База данных ещё не обновлена. Выполните последнее SQL-обновление из папки supabase в Supabase SQL Editor.'
  if (/duplicate key|23505/i.test(message)) return 'Запись с таким номером уже существует.'
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Нет связи с Supabase. Проверьте интернет и повторите действие.'
  return message || 'Не удалось выполнить действие.'
}

export async function loadRows(table, order = 'updated_at', options = {}) {
  let query = supabase.from(table).select(options.select || '*')
  if (order) query = query.order(order, { ascending: options.ascending ?? false, nullsFirst: false })
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveRow(table, row, userId) {
  const payload = { ...row, updated_by: userId }
  const id = payload.id
  delete payload.id
  delete payload.created_at
  delete payload.updated_at
  const query = id
    ? supabase.from(table).update(payload).eq('id', id)
    : supabase.from(table).insert({ ...payload, created_by: userId })
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function uploadFile(file, folder, userId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_')
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safeName}`
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return { path, name: file.name, uploaded_at: new Date().toISOString(), size: file.size, type: file.type }
}

export async function downloadFile(path, name) {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).download(path)
  if (error) throw error
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = name || 'document'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function removeFile(path) {
  if (!path) return
  const { error } = await supabase.storage.from(FILE_BUCKET).remove([path])
  if (error) throw error
}

export async function exportExcel(title, rows, columns) {
  const XLSX = await import('xlsx')
  const prepared = rows.map(row => Object.fromEntries(columns.map(([key, label, transform]) => [label, transform ? transform(row[key], row) : row[key] ?? ''])))
  const sheet = XLSX.utils.json_to_sheet(prepared)
  sheet['!cols'] = columns.map(([, label]) => ({ wch: Math.min(38, Math.max(12, label.length + 3)) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, title.slice(0, 31))
  XLSX.writeFile(book, `Violet_Ledger_${title}_${today()}.xlsx`, { compression: true })
}

export function canEdit(profile) {
  return profile?.role === 'admin' || profile?.role === 'editor'
}

export function calculateAllocation(items, total, method) {
  const source = (items || []).map(item => ({ ...item, quantity: Number(item.quantity) || 0, product_value: Number(item.product_value) || 0 }))
  const amount = Number(total) || 0
  if (!source.length) return []
  const quantityTotal = source.reduce((sum, item) => sum + item.quantity, 0)
  const valueTotal = source.reduce((sum, item) => sum + item.product_value, 0)
  return source.map(item => {
    let allocated = Number(item.manual_cost) || 0
    if (method === 'equal') allocated = amount / source.length
    if (method === 'quantity') allocated = quantityTotal ? amount * item.quantity / quantityTotal : amount / source.length
    if (method === 'value') allocated = valueTotal ? amount * item.product_value / valueTotal : amount / source.length
    return { ...item, allocated_cost: Number(allocated.toFixed(2)), cost_per_unit: item.quantity ? Number((allocated / item.quantity).toFixed(2)) : 0 }
  })
}
