import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type Settings = {
  user_id: string
  enabled: boolean
  channel: 'email' | 'telegram' | 'both'
  email: string
  telegram_chat_id: string
  reminder_days: number[]
}

type Payment = {
  id: string
  pi_number: string
  request_number: string
  supplier_name: string
  amount: number
  percent_of_order: number
  currency: string
  due_date: string
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ${currency}`
}

function daysUntil(dateString: string) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const target = new Date(`${dateString}T00:00:00Z`)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function reminderKey(days: number) {
  return days < 0 ? `overdue-${Math.abs(days)}` : `due-${days}`
}

function messageFor(payment: Payment, days: number) {
  const pi = payment.pi_number || payment.request_number || 'без номера'
  const paid = Number(payment.amount || 0) * Number(payment.percent_of_order || 0) / 100
  const balance = Math.max(0, Number(payment.amount || 0) - paid)
  const timing = days < 0
    ? `Платёж просрочен на ${Math.abs(days)} дн.`
    : days === 0
      ? 'Оплатить сегодня.'
      : `До оплаты ${days} дн.`
  return [
    `Violet Ledger — напоминание по PI ${pi}`,
    payment.supplier_name ? `Поставщик: ${payment.supplier_name}` : '',
    `Срок оплаты: ${new Intl.DateTimeFormat('ru-RU').format(new Date(`${payment.due_date}T00:00:00Z`))}`,
    `Остаток: ${formatMoney(balance, payment.currency)}`,
    timing,
  ].filter(Boolean).join('\n')
}

async function sendTelegram(chatId: string, text: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!response.ok) throw new Error(`Telegram: ${await response.text()}`)
}

async function sendEmail(email: string, subject: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('PAYMENT_REMINDER_FROM')
  if (!apiKey || !from) throw new Error('RESEND_API_KEY or PAYMENT_REMINDER_FROM is not configured')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject, text }),
  })
  if (!response.ok) throw new Error(`Email: ${await response.text()}`)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const body = await request.json().catch(() => ({}))
    const isTest = Boolean(body?.test)
    const authHeader = request.headers.get('Authorization') || ''
    const cronSecret = request.headers.get('x-cron-secret') || ''
    const expectedCronSecret = Deno.env.get('PAYMENT_CRON_SECRET') || ''

    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const { data } = await admin.auth.getUser(token)
      userId = data.user?.id || null
    }

    if (!userId && (!expectedCronSecret || cronSecret !== expectedCronSecret)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    let settingsQuery = admin.from('payment_notification_settings').select('*').eq('enabled', true)
    if (userId) settingsQuery = settingsQuery.eq('user_id', userId)
    const { data: settingsRows, error: settingsError } = await settingsQuery
    if (settingsError) throw settingsError

    const settings = (settingsRows || []) as Settings[]
    if (!settings.length) return json({ sent: 0, message: 'No enabled notification settings' })

    const { data: paymentRows, error: paymentError } = await admin
      .from('payments')
      .select('id,pi_number,request_number,supplier_name,amount,percent_of_order,currency,due_date')
      .not('due_date', 'is', null)
    if (paymentError) throw paymentError

    const payments = (paymentRows || []) as Payment[]
    let sent = 0
    const errors: string[] = []

    for (const setting of settings) {
      const candidates = isTest
        ? payments.slice(0, 1)
        : payments.filter(payment => {
            const balance = Number(payment.amount || 0) - Number(payment.amount || 0) * Number(payment.percent_of_order || 0) / 100
            const days = daysUntil(payment.due_date)
            return balance > 0 && (setting.reminder_days || [15, 7, 3, 0]).includes(days)
          })

      if (isTest && !candidates.length) {
        candidates.push({
          id: crypto.randomUUID(),
          pi_number: 'TEST-PI',
          request_number: 'TEST-PI',
          supplier_name: 'Тестовый поставщик',
          amount: 1000,
          percent_of_order: 60,
          currency: 'CNY',
          due_date: new Date().toISOString().slice(0, 10),
        })
      }

      for (const payment of candidates) {
        const days = isTest ? 0 : daysUntil(payment.due_date)
        const key = isTest ? `test-${new Date().toISOString()}` : reminderKey(days)
        const text = messageFor(payment, days)
        const subject = `Violet Ledger: PI ${payment.pi_number || payment.request_number}`
        const channels = setting.channel === 'both' ? ['email', 'telegram'] : [setting.channel]

        for (const channel of channels) {
          if (!isTest) {
            const { data: existing } = await admin
              .from('payment_notification_log')
              .select('id')
              .eq('payment_id', payment.id)
              .eq('user_id', setting.user_id)
              .eq('channel', channel)
              .eq('reminder_key', key)
              .maybeSingle()
            if (existing) continue
          }

          try {
            if (channel === 'telegram') await sendTelegram(setting.telegram_chat_id, text)
            else await sendEmail(setting.email, subject, text)
            if (!isTest) {
              await admin.from('payment_notification_log').insert({
                payment_id: payment.id,
                user_id: setting.user_id,
                channel,
                reminder_key: key,
              })
            }
            sent += 1
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error))
          }
        }
      }
    }

    return json({ sent, errors })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
