import { useRef, useCallback, useState } from "react"
import type { ConnectionStatus } from "../types"

type UseWebSocketOptions = {
  onMessage: (text: string) => void
  onError?: (error: string) => void
}

export function useWebSocket({ onMessage, onError }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${location.host}/ws`
    setStatus("connecting")

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setStatus("connected")

    ws.onclose = () => {
      setStatus("disconnected")
      wsRef.current = null
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      onError?.("Connection error. Retrying...")
    }

    ws.onmessage = (event) => {
      onMessage(event.data as string)
    }
  }, [onMessage, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    wsRef.current = null
    setStatus("disconnected")
  }, [])

  const send = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text)
      return true
    }
    return false
  }, [])

  return { connect, disconnect, send, status }
}
