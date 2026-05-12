const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`

const messagesEl = document.getElementById('messages')
const inputEl = document.getElementById('input')
const sendEl = document.getElementById('send')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')

let ws = null
let pending = false

function setStatus(state) {
  statusDot.className = 'dot ' + state
  statusText.textContent = state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting...' : 'disconnected'
}

function addMessage(role, text) {
  const el = document.createElement('div')
  el.className = 'msg ' + role
  el.textContent = text
  const ts = document.createElement('div')
  ts.className = 'timestamp'
  ts.textContent = new Date().toLocaleTimeString()
  el.appendChild(ts)
  messagesEl.appendChild(el)
  el.scrollIntoView({ behavior: 'smooth' })
  return el
}

function removeThinking() {
  const last = messagesEl.lastElementChild
  if (last && last.classList.contains('thinking')) last.remove()
}

function connect() {
  setStatus('connecting')
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    setStatus('connected')
    inputEl.disabled = false
    sendEl.disabled = false
    inputEl.focus()
  }

  ws.onclose = () => {
    setStatus('disconnected')
    inputEl.disabled = true
    sendEl.disabled = true
    pending = false
    setTimeout(connect, 3000)
  }

  ws.onerror = () => {
    ws.close()
  }

  ws.onmessage = (event) => {
    removeThinking()
    pending = false
    addMessage('assistant', event.data)
    inputEl.disabled = false
    sendEl.disabled = false
    inputEl.focus()
  }
}

function send() {
  const text = inputEl.value.trim()
  if (!text || pending) return
  pending = true
  addMessage('user', text)
  inputEl.value = ''
  inputEl.style.height = 'auto'
  inputEl.disabled = true
  sendEl.disabled = true
  addMessage('thinking', 'Thinking...')
  ws.send(text)
}

sendEl.addEventListener('click', send)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
})
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto'
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px'
})

connect()
