// Violet Ledger — resilient Supabase network layer.
// Loaded before the React application so short connection drops do not immediately break saves.

(() => {
  if (window.__VL_RESILIENT_FETCH__) return
  window.__VL_RESILIENT_FETCH__ = true

  const nativeFetch = window.fetch.bind(window)
  const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'PATCH', 'PUT', 'DELETE'])
  const RETRYABLE_STATUSES = new Set([502, 503, 504])
  const RETRY_DELAYS = [500, 1250]
  let toastTimer = 0
  let toastNode = null

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms))

  function requestUrl(input) {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.href
    return input?.url || ''
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase()
  }

  function isSupabaseRequest(url) {
    try {
      const parsed = new URL(url, window.location.href)
      return parsed.hostname.endsWith('.supabase.co')
        && (/^\/(rest|auth)\/v1\//.test(parsed.pathname) || parsed.pathname === '/rest/v1/')
    } catch {
      return false
    }
  }

  function isNetworkError(error) {
    const message = String(error?.message || error || '')
    return error?.name !== 'AbortError'
      && (error instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(message))
  }

  function ensureToast() {
    if (toastNode?.isConnected) return toastNode

    const style = document.createElement('style')
    style.dataset.vlNetworkStyle = 'true'
    style.textContent = `
      .vl-network-toast{position:fixed;top:18px;right:18px;z-index:12000;width:min(360px,calc(100vw - 36px));padding:14px 16px;display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(69,53,101,.12);border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 18px 50px rgba(35,27,52,.18);color:#302641;font:13px/1.42 Inter,system-ui,sans-serif;opacity:0;transform:translateY(-8px);pointer-events:none;transition:opacity .18s ease,transform .18s ease;backdrop-filter:blur(14px)}
      .vl-network-toast.is-visible{opacity:1;transform:translateY(0)}
      .vl-network-toast__mark{width:10px;height:10px;margin-top:4px;flex:0 0 10px;border-radius:50%;background:#8c76d2;box-shadow:0 0 0 5px rgba(140,118,210,.12)}
      .vl-network-toast.is-success .vl-network-toast__mark{background:#4e9a78;box-shadow:0 0 0 5px rgba(78,154,120,.12)}
      .vl-network-toast.is-error .vl-network-toast__mark{background:#c45d69;box-shadow:0 0 0 5px rgba(196,93,105,.12)}
      .vl-network-toast strong{display:block;font-size:12px;font-weight:700}
      .vl-network-toast span{display:block;margin-top:2px;color:#766e7d;font-size:11px}
      @media(max-width:640px){.vl-network-toast{top:10px;right:10px;width:calc(100vw - 20px)}}
    `
    if (!document.querySelector('style[data-vl-network-style]')) document.head.append(style)

    toastNode = document.createElement('div')
    toastNode.className = 'vl-network-toast'
    toastNode.innerHTML = '<i class="vl-network-toast__mark"></i><div><strong></strong><span></span></div>'
    document.body.append(toastNode)
    return toastNode
  }

  function showToast(state, title, message, timeout = 0) {
    const node = ensureToast()
    window.clearTimeout(toastTimer)
    node.classList.remove('is-success', 'is-error')
    if (state) node.classList.add(`is-${state}`)
    node.querySelector('strong').textContent = title
    node.querySelector('span').textContent = message
    requestAnimationFrame(() => node.classList.add('is-visible'))
    if (timeout) {
      toastTimer = window.setTimeout(() => node.classList.remove('is-visible'), timeout)
    }
  }

  function waitForOnline(timeoutMs = 12000) {
    if (navigator.onLine !== false) return Promise.resolve(true)
    return new Promise(resolve => {
      let finished = false
      const finish = value => {
        if (finished) return
        finished = true
        window.removeEventListener('online', onOnline)
        window.clearTimeout(timer)
        resolve(value)
      }
      const onOnline = () => finish(true)
      const timer = window.setTimeout(() => finish(false), timeoutMs)
      window.addEventListener('online', onOnline, { once: true })
    })
  }

  window.fetch = async function resilientFetch(input, init) {
    const url = requestUrl(input)
    if (!isSupabaseRequest(url)) return nativeFetch(input, init)

    const method = requestMethod(input, init)
    const canRetry = RETRYABLE_METHODS.has(method)
    const attempts = canRetry ? RETRY_DELAYS.length + 1 : 1
    let lastError = null
    let retried = false

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (navigator.onLine === false) {
        showToast('', 'Нет подключения', 'Ждём восстановления интернета. Заполненные данные не потеряны.')
        const online = await waitForOnline()
        if (!online) {
          throw new Error('Нет подключения к интернету. Запрос не сохранён, но заполненные данные остались в форме.')
        }
      }

      try {
        const requestInput = input instanceof Request ? input.clone() : input
        const response = await nativeFetch(requestInput, init)

        if (canRetry && RETRYABLE_STATUSES.has(response.status) && attempt < attempts - 1) {
          retried = true
          showToast('', 'Сервер временно недоступен', `Повторяем запрос ${attempt + 2} из ${attempts}…`)
          await sleep(RETRY_DELAYS[attempt])
          continue
        }

        if (retried) showToast('success', 'Связь восстановлена', 'Запрос успешно отправлен на сервер.', 2600)
        return response
      } catch (error) {
        if (!isNetworkError(error)) throw error
        lastError = error

        if (!canRetry || attempt >= attempts - 1) break
        retried = true
        showToast('', 'Связь с сервером прервана', `Повторяем сохранение ${attempt + 2} из ${attempts}…`)
        await sleep(RETRY_DELAYS[attempt])
      }
    }

    showToast('error', 'Не удалось сохранить', 'Сервер недоступен. Данные формы не потеряны — повторите сохранение через несколько секунд.', 5000)
    const message = navigator.onLine === false
      ? 'Нет подключения к интернету. Запрос не сохранён, но заполненные данные остались в форме.'
      : 'Не удалось связаться с сервером. Заполненные данные не потеряны. Подождите несколько секунд и нажмите «Сохранить» ещё раз.'
    const error = new Error(message)
    error.cause = lastError
    throw error
  }

  window.addEventListener('offline', () => {
    showToast('', 'Нет подключения', 'Сохранение временно недоступно. Данные в открытой форме останутся на месте.')
  })

  window.addEventListener('online', () => {
    showToast('success', 'Интернет восстановлен', 'Можно повторить сохранение.', 2600)
  })
})()
