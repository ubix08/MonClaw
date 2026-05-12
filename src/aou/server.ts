import type { Logger } from "pino"
import type { AssistantCore } from "../core/assistant"
import { resolvePath } from "../utils/path"

export type AouOptions = {
  port: number
  hostname: string
  assistant: AssistantCore
  logger: Logger
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
}

function mimeType(path: string): string {
  const ext = path.match(/\.(\w+)$/)?.[0]
  return ext ? MIME_TYPES[ext] ?? "application/octet-stream" : "text/html"
}

export function startAouServer(opts: AouOptions): { stop: () => void; url: string } {
  const publicDir = resolvePath(Bun.cwd, "src/aou/public")

  const handler = {
    open(ws: any) {
      ws.data = { userID: `aou:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` }
      opts.logger.info({ userID: ws.data.userID }, "aou websocket opened")
    },
    async message(ws: any, raw: string | Buffer) {
      const text = typeof raw === "string" ? raw.trim() : ""
      if (!text) return
      try {
        const answer = await opts.assistant.ask({
          channel: "aou",
          userID: ws.data.userID,
          text,
        })
        ws.send(answer)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        opts.logger.error({ error: msg }, "aou message handling failed")
        ws.send(`Error: ${msg}`)
      }
    },
    close(ws: any) {
      opts.logger.info({ userID: ws.data.userID }, "aou websocket closed")
    },
  }

  const server = Bun.serve({
    hostname: opts.hostname,
    port: opts.port,
    fetch(req: Request, srv: any) {
      const url = new URL(req.url)

      if (url.pathname === "/ws") {
        return srv.upgrade(req) ? undefined : new Response("WebSocket upgrade failed", { status: 400 })
      }
      if (url.pathname === "/health") {
        return new Response("ok", { headers: { "Content-Type": "text/plain" } })
      }

      let filePath = url.pathname === "/" ? "/index.html" : url.pathname
      const file = Bun.file(publicDir + filePath)
      return new Response(file, {
        headers: { "Content-Type": mimeType(filePath) },
      })
    },
    websocket: handler,
  })

  opts.logger.info({ hostname: opts.hostname, port: server.port }, "aou server started")
  return {
    stop: () => server.stop(true),
    url: `http://${opts.hostname}:${server.port}`,
  }
}
