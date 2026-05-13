import { useState, useEffect, useRef, useCallback } from "react"
import { MessageBubble } from "./MessageBubble"
import { InputBar } from "./InputBar"
import { useWebSocket } from "../hooks/useWebSocket"
import type { Message, ConnectionStatus } from "../types"

function generateId(): string {
  return `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

function ThinkingIndicator() {
  return (
    <div className="message assistant">
      <div className="message-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author">MonClaw</span>
        </div>
        <div className="thinking-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  )
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: generateId(), role: "system", content: text, timestamp: Date.now() }])
  }, [])

  const { connect, disconnect, send, status: wsStatus } = useWebSocket({
    onMessage: useCallback((text: string) => {
      setIsThinking(false)
      setMessages((prev) => [...prev, { id: generateId(), role: "assistant", content: text, timestamp: Date.now() }])
    }, []),
    onError: useCallback((error: string) => {
      addSystemMessage(error)
    }, [addSystemMessage]),
  })

  useEffect(() => {
    setStatus(wsStatus)
  }, [wsStatus])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isThinking])

  const handleSend = (text: string) => {
    const ok = send(text)
    if (!ok) {
      addSystemMessage("Not connected. Waiting for reconnect...")
      return
    }
    setMessages((prev) => [...prev, { id: generateId(), role: "user", content: text, timestamp: Date.now() }])
    setIsThinking(true)
  }

  return (
    <div className="chat-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">🐾</span>
            <span className="logo-text">MonClaw</span>
          </div>
        </div>
        <div className="sidebar-status">
          <span className={`status-dot ${status}`} />
          <span className="status-text">
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting..." : "Disconnected"}
          </span>
        </div>
        <div className="sidebar-info">
          <p>Autonomous AI Software Engineer</p>
          <p className="sidebar-sub">Always running · 24/7</p>
        </div>
      </aside>
      <main className="main">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">🐾</div>
              <h2>Hello, I'm MonClaw</h2>
              <p>Autonomous AI Software Engineer — I help plan, code, review, test, debug, and research.</p>
              <p className="welcome-hint">Send a message to get started.</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isThinking && <ThinkingIndicator />}
          <div ref={bottomRef} />
        </div>
        <InputBar onSend={handleSend} disabled={status !== "connected"} />
      </main>
    </div>
  )
}
