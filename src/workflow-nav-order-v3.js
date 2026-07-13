const order = ['Обзор', 'Запросы', 'Логистика', 'Платежи', 'Аналитика', 'Журнал', 'Доступ']
let frame = 0

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function reorderNavigation() {
  frame = 0
  const nav = document.querySelector('aside nav')
  if (!nav) return

  const current = [...nav.querySelectorAll(':scope > button')]
  const desired = current.map((button, originalIndex) => {
    const text = normalize(button.textContent)
    const rank = order.findIndex(label => text.includes(label))
    return { button, originalIndex, rank: rank < 0 ? order.length + originalIndex : rank }
  }).sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex).map(item => item.button)

  const orderChanged = desired.some((button, index) => current[index] !== button)
  if (orderChanged) nav.replaceChildren(...desired)

  desired.forEach((button, index) => {
    const marker = button.querySelector('.nav-index')
    const next = String(index + 1).padStart(2, '0')
    if (marker && marker.textContent !== next) marker.textContent = next
  })
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(reorderNavigation)
}

schedule()
new MutationObserver(schedule).observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
