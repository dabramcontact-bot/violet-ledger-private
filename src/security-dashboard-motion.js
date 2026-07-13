const SECTION_SELECTOR = '.security-premium-source'
const SHELL_SELECTOR = '.security-premium-shell'

let activeSection = null
let activeShell = null
let sectionObserver = null
let contentObserver = null
let mountFrame = 0
let sectionVisible = false
let liveTimer = 0

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function syncMotionState() {
  if (!activeSection) return
  const enabled = sectionVisible && !document.hidden && !reducedMotion.matches
  activeSection.classList.toggle('is-security-motion-active', enabled)
}

function pulseNumber(node) {
  if (!node || reducedMotion.matches || !sectionVisible) return
  node.classList.remove('security-number-updated')
  requestAnimationFrame(() => {
    if (!node.isConnected) return
    node.classList.add('security-number-updated')
    window.setTimeout(() => node.classList.remove('security-number-updated'), 620)
  })
}

function pulseLiveUpdate() {
  if (!activeShell || reducedMotion.matches || !sectionVisible) return
  window.clearTimeout(liveTimer)
  activeShell.classList.remove('security-live-update')
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!activeShell?.isConnected) return
    activeShell.classList.add('security-live-update')
    liveTimer = window.setTimeout(() => activeShell?.classList.remove('security-live-update'), 820)
  }))
}

function observeContent(shell) {
  contentObserver?.disconnect()
  contentObserver = new MutationObserver(records => {
    const numbers = new Set()
    let auditChanged = false

    records.forEach(record => {
      const target = record.target.nodeType === Node.TEXT_NODE
        ? record.target.parentElement
        : record.target
      const metric = target?.closest?.('[data-security-metric], [data-security-role]')
      if (metric) numbers.add(metric)

      if (target?.closest?.('.security-audit-list')) auditChanged = true
      record.addedNodes?.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return
        if (node.matches?.('.security-audit-item') || node.querySelector?.('.security-audit-item')) auditChanged = true
      })
    })

    numbers.forEach(pulseNumber)
    if (auditChanged) pulseLiveUpdate()
  })

  contentObserver.observe(shell, {
    subtree: true,
    childList: true,
    characterData: true,
  })
}

function disconnectCurrent() {
  sectionObserver?.disconnect()
  contentObserver?.disconnect()
  window.clearTimeout(liveTimer)
  if (activeSection) activeSection.classList.remove('is-security-motion-active')
  activeSection = null
  activeShell = null
  sectionVisible = false
}

function connect(section, shell) {
  disconnectCurrent()
  activeSection = section
  activeShell = shell
  shell.classList.add('security-motion-ready')

  if (reducedMotion.matches) shell.classList.add('has-security-entered')

  sectionObserver = new IntersectionObserver(([entry]) => {
    sectionVisible = Boolean(entry?.isIntersecting)
    if (sectionVisible) shell.classList.add('has-security-entered')
    syncMotionState()
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -8% 0px',
  })

  sectionObserver.observe(section)
  observeContent(shell)
}

function ensureConnected() {
  mountFrame = 0
  const section = document.querySelector(SECTION_SELECTOR)
  const shell = section?.querySelector(SHELL_SELECTOR)

  if (!section || !shell) {
    if (activeSection && !activeSection.isConnected) disconnectCurrent()
    return
  }

  if (activeSection === section && activeShell === shell && shell.isConnected) return
  connect(section, shell)
}

function scheduleConnect() {
  if (!mountFrame) mountFrame = requestAnimationFrame(ensureConnected)
}

function handleVisibility() {
  syncMotionState()
}

function handleMotionPreference() {
  if (reducedMotion.matches) activeShell?.classList.add('has-security-entered')
  syncMotionState()
}

document.addEventListener('visibilitychange', handleVisibility)
reducedMotion.addEventListener?.('change', handleMotionPreference)

scheduleConnect()
const root = document.getElementById('root') || document.body
new MutationObserver(scheduleConnect).observe(root, { childList: true, subtree: true })
