export type MessageRole = "user" | "assistant" | "system"

export type Message = {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected"
