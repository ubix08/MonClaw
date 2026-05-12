import { useState } from "react"
import type { Message } from "../types"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

type MessageBubbleProps = {
  message: Message
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button className="copy-btn" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  if (message.role === "system") {
    return (
      <div className="message-system">
        <span>{message.content}</span>
      </div>
    )
  }

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === "user" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author">{message.role === "user" ? "You" : "MonClaw"}</span>
          <span className="message-time">{time}</span>
        </div>
        <div className="message-text">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "")
                const code = String(children).replace(/\n$/, "")
                if (match) {
                  return (
                    <div className="code-block">
                      <div className="code-header">
                        <span>{match[1]}</span>
                        <CopyButton code={code} />
                      </div>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                      >
                        {code}
                      </SyntaxHighlighter>
                    </div>
                  )
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {message.content}
          </Markdown>
        </div>
      </div>
    </div>
  )
}
