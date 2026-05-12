import { useState, useRef, useEffect, type KeyboardEvent } from "react"

type InputBarProps = {
  onSend: (text: string) => void
  disabled: boolean
  placeholder?: string
}

export function InputBar({ onSend, disabled, placeholder = "Message MonClaw..." }: InputBarProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = () => {
    const text = input.trim()
    if (!text || disabled) return
    onSend(text)
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
      />
      <button className="send-btn" onClick={handleSend} disabled={disabled || !input.trim()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  )
}
