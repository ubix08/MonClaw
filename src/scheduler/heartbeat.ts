import type { Logger } from "pino"
import { AssistantCore } from "../core/assistant"

export type HeartbeatHandle = { stop: () => void }

export function startHeartbeat(intervalMinutes: number, assistant: AssistantCore, logger: Logger): HeartbeatHandle {
  const ms = Math.max(1, intervalMinutes) * 60_000
  if (!Number.isFinite(ms) || ms <= 0) {
    logger.warn({ intervalMinutes }, "invalid heartbeat interval, skipping")
    return { stop: () => {} }
  }

  let running = false
  let stopped = false
  const run = async () => {
    if (running || stopped) return
    running = true
    const startedAt = Date.now()
    try {
      logger.info("heartbeat run started")
      const result = await assistant.runHeartbeatTasks()
      logger.info({ result, durationMs: Date.now() - startedAt }, "heartbeat run completed")
    } catch (error) {
      logger.error({ error, durationMs: Date.now() - startedAt }, "heartbeat run failed")
    } finally {
      running = false
    }
  }

  void run()
  const intervalHandle = setInterval(() => {
    void run()
  }, ms)

  logger.info({ intervalMinutes }, "heartbeat scheduler started")

  return {
    stop: () => {
      stopped = true
      clearInterval(intervalHandle)
    },
  }
}
