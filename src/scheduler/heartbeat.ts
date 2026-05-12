import type { Logger } from "pino"
import type { AssistantCore } from "../core/assistant"
import { readText, ensureDir } from "../utils/fs"
import { dirname } from "../utils/path"

export type HeartbeatHandle = { stop: () => void }

export function startHeartbeat(
  intervalMinutes: number,
  assistant: AssistantCore,
  playbookFile: string,
  logger: Logger,
): HeartbeatHandle {
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

    try {
      await ensureDir(dirname(playbookFile))
      let playbook: string
      try {
        playbook = await readText(playbookFile)
      } catch {
        logger.debug("heartbeat: no playbook.md found, skipping")
        return
      }

      const trimmed = playbook.trim()
      if (!trimmed) {
        logger.debug("heartbeat: playbook.md is empty, skipping")
        return
      }

      logger.info("heartbeat: starting work cycle")
      const startedAt = Date.now()
      const result = await assistant.runWorkCycle({
        prompt: `Follow your playbook:\n\n${trimmed}`,
        timeoutSeconds: 1800,
      })
      logger.info(
        { success: result.success, durationMs: Date.now() - startedAt },
        "heartbeat: work cycle complete",
      )
    } catch (error) {
      logger.error({ error }, "heartbeat failed")
    } finally {
      running = false
    }
  }

  void run()
  const intervalHandle = setInterval(() => void run(), ms)
  logger.info({ intervalMinutes, playbookFile }, "heartbeat started")

  return {
    stop: () => {
      stopped = true
      clearInterval(intervalHandle)
    },
  }
}
