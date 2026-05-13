/**
 * assistant.ts — AssistantCore refactored
 *
 * Key changes from original:
 *  1. System prompt built via assembleSystemPrompt(BehavioralState) — not inline string arrays.
 *  2. BTS (resolveBehavioralState) replaces the 4 scattered readAll() calls per request.
 *  3. recentContext built once per request; shared between BTS (bottleneck) and context assembler.
 *  4. Token estimate logged on every request for cost visibility.
 *  5. Policy object consulted for autonomy checks — no more regex on soul text at runtime.
 */

import { ensureDir, readText, writeText } from "../utils/fs"
import { basename, dirname, relativePath } from "../utils/path"
import { saveLastChannel } from "../utils/last-channel"
import type { Logger } from "pino"
import { MemoryStore } from "../memory/store"
import { SessionStore } from "./session-store"
import { MissionStore, SoulStore } from "../identity"
import { resolveBehavioralState, formatBottleneckAlert } from "./bts"
import { assembleSystemPrompt, estimateTokens } from "./context"
import {
  createOpencode,
  createOpencodeClient,
  apiSessionCreate,
  apiSessionPrompt,
  apiSessionMessages,
  apiSessionInject,
  unwrap,
} from "./opencode"
import type { OpencodeClient, SessionMessage } from "./opencode"

// ─── Types ────────────────────────────────────────────────────────────────────

type AssistantInput = {
  channel: "telegram" | "whatsapp" | "aou" | "system"
  userID: string
  text: string
}

type AssistantOptions = {
  model?: string
  serverUrl?: string
  hostname: string
  port: number
  heartbeatFile: string
  heartbeatIntervalMinutes: number
}

type OpencodeRuntime = {
  client: OpencodeClient
  close?: () => Promise<void> | void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildModelConfig(model?: string): { providerID: string; modelID: string } | undefined {
  if (!model) return undefined
  const [providerID, ...rest] = model.split("/")
  if (!providerID || rest.length === 0) return undefined
  return { providerID, modelID: rest.join("/") }
}

function extractTextFromMessage(msg: SessionMessage): string {
  return (msg.parts ?? [])
    .map((p) => (p?.type === "text" && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
}

function latestAssistantMessage(messages: SessionMessage[]): SessionMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.info?.role === "assistant") return messages[i]
  }
  return null
}

function assistantSignature(msg: SessionMessage | null): string {
  if (!msg) return ""
  return `${msg.info?.id ?? ""}::${extractTextFromMessage(msg)}`
}

/**
 * Builds a sliding window of recent session turns for context + bottleneck detection.
 * Strict token budget: maxChars = 1200 chars (~300 tokens).
 */
function buildRecentContext(messages: SessionMessage[], limit = 6, maxChars = 1200): string {
  const out: string[] = []
  let remaining = maxChars
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i--) {
    const msg = messages[i]
    const role = msg?.info?.role
    if (role !== "user" && role !== "assistant") continue
    const text = extractTextFromMessage(msg)
    if (!text) continue
    const snippet = `${role.toUpperCase()}: ${text}`
    if (snippet.length > remaining) continue
    out.push(snippet)
    remaining -= snippet.length + 1
  }
  return out.reverse().join("\n")
}

async function extractPromptText(result: unknown): Promise<string> {
  const payload = unwrap<Record<string, unknown>>(result)
  const directParts = payload.parts
  if (directParts && typeof directParts === "object" && Symbol.asyncIterator in directParts) {
    const chunks: string[] = []
    for await (const part of directParts as AsyncIterable<Record<string, unknown>>) {
      if (typeof part.text === "string" && part.text.length > 0) chunks.push(part.text)
    }
    const merged = chunks.join("").trim()
    if (merged) return merged
  }
  if (Array.isArray(directParts)) {
    const merged = directParts
      .map((p) => (p && typeof (p as Record<string, unknown>).text === "string" ? (p as { text: string }).text : ""))
      .join("\n").trim()
    if (merged) return merged
  }
  const message = payload.message
  if (message && typeof message === "object") {
    const msgParts = (message as { parts?: unknown }).parts
    if (Array.isArray(msgParts)) {
      const merged = msgParts
        .map((p) => (p && typeof (p as Record<string, unknown>).text === "string" ? (p as { text: string }).text : ""))
        .join("\n").trim()
      if (merged) return merged
    }
  }
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim()
  return ""
}

// ─── Runtime factory ──────────────────────────────────────────────────────────

async function createRuntime(opts: AssistantOptions): Promise<OpencodeRuntime> {
  if (opts.serverUrl) {
    return { client: createOpencodeClient({ baseUrl: opts.serverUrl }) }
  }
  const fallbackUrl = `http://${opts.hostname}:${opts.port}`
  try {
    const runtime = await createOpencode({
      hostname: opts.hostname,
      port: opts.port,
      ...(opts.model ? { config: { model: opts.model } } : {}),
    })
    return { client: runtime.client, close: () => runtime.server.close() }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("port") || msg.includes("EADDRINUSE")) {
      return { client: createOpencodeClient({ baseUrl: fallbackUrl }) }
    }
    throw error
  }
}

// ─── AssistantCore ────────────────────────────────────────────────────────────

export class AssistantCore {
  private runtime?: OpencodeRuntime
  private client?: OpencodeClient
  private readonly modelConfig?: { providerID: string; modelID: string }

  constructor(
    private readonly logger: Logger,
    private readonly memory: MemoryStore,
    private readonly mission: MissionStore,
    private readonly soul: SoulStore,
    private readonly sessions: SessionStore,
    private readonly opts: AssistantOptions,
  ) {
    this.modelConfig = buildModelConfig(opts.model)
  }

  async init(): Promise<void> {
    await this.setupRuntime()
    await Promise.all([
      this.memory.init(),
      this.mission.init(),
      this.soul.init(),
      this.sessions.init(),
    ])
  }

  // ─── Public: chat ───────────────────────────────────────────────────────────

  async ask(input: AssistantInput): Promise<string> {
    const startedAt = Date.now()
    const client = this.ensureClient()
    const sessionID = await this.getOrCreateMainSession()

    if (input.channel === "telegram" || input.channel === "whatsapp") {
      await saveLastChannel(input.channel, input.userID)
    }

    const recentContext = await this.loadRecentContext(sessionID)

    const state = await resolveBehavioralState({
      soul: this.soul,
      mission: this.mission,
      memory: this.memory,
      recentContext,
    })

    const systemPrompt = assembleSystemPrompt({
      autonomyTier: state.autonomyTier,
      heartbeatIntervalMinutes: this.opts.heartbeatIntervalMinutes,
      memory: state.memoryText,
      mission: state.missionText,
      recentContext: recentContext || undefined,
      mode: "chat",
    })

    this.logger.info({
      channel: input.channel,
      userID: input.userID,
      sessionID,
      promptTokens: estimateTokens(systemPrompt),
      bottleneck: state.bottleneck.detected,
      tier: state.autonomyTier,
    }, "assistant request started")

    const beforeSig = await this.captureAssistantSig(sessionID)

    let response: unknown
    try {
      response = await apiSessionPrompt(client, {
        path: { id: sessionID },
        body: {
          noReply: false,
          system: systemPrompt,
          parts: [{ type: "text", text: input.text }],
          ...(this.modelConfig ? { model: this.modelConfig } : {}),
        },
      })
    } catch (error) {
      this.logger.error({ error, sessionID }, "prompt call failed")
      throw error
    }

    const answer = await this.resolveReply(response, sessionID, beforeSig)

    this.logger.info({
      channel: input.channel,
      sessionID,
      durationMs: Date.now() - startedAt,
      answerLength: answer.length,
    }, "assistant request completed")

    return answer
  }

  // ─── Public: heartbeat work cycle ──────────────────────────────────────────

  async runWorkCycle(opts: {
    prompt: string
    timeoutSeconds?: number
  }): Promise<{ success: boolean; output: string; error?: string; durationMs: number }> {
    const startedAt = Date.now()
    const sessionID = await this.getOrCreateWorkSession()
    const client = this.ensureClient()
    const timeout = (opts.timeoutSeconds ?? 1800) * 1000

    const recentContext = await this.loadRecentContext(sessionID)
    const state = await resolveBehavioralState({
      soul: this.soul,
      mission: this.mission,
      memory: this.memory,
      recentContext,
    })

    const promptText = state.bottleneck.detected
      ? `${opts.prompt}\n\n${formatBottleneckAlert(state.bottleneck)}`
      : opts.prompt

    const systemPrompt = assembleSystemPrompt({
      autonomyTier: state.autonomyTier,
      heartbeatIntervalMinutes: this.opts.heartbeatIntervalMinutes,
      memory: state.memoryText,
      mission: state.missionText,
      recentContext: recentContext || undefined,
      mode: "work",
    })

    this.logger.info({
      sessionID,
      promptTokens: estimateTokens(systemPrompt),
      bottleneck: state.bottleneck.detected,
    }, "work cycle started")

    const result = await Promise.race([
      (async (): Promise<{ success: boolean; output: string; error?: string }> => {
        try {
          const response = await apiSessionPrompt(client, {
            path: { id: sessionID },
            body: {
              noReply: false,
              system: systemPrompt,
              parts: [{ type: "text", text: promptText }],
              ...(this.modelConfig ? { model: this.modelConfig } : {}),
            },
          })
          const text = await extractPromptText(response)
          if (!text) return { success: false, output: "", error: "no model response" }
          return { success: true, output: text }
        } catch (e) {
          return { success: false, output: "", error: e instanceof Error ? e.message : String(e) }
        }
      })(),
      new Promise<{ success: false; output: ""; error: string }>((resolve) =>
        setTimeout(
          () => resolve({ success: false, output: "", error: `timeout after ${opts.timeoutSeconds ?? 1800}s` }),
          timeout,
        ),
      ),
    ])

    return { ...result, durationMs: Date.now() - startedAt }
  }

  // ─── Public: memory / session management ───────────────────────────────────

  async remember(note: string, source: string): Promise<void> {
    await this.memory.append(note, source)
  }

  async startNewMainSession(reason = "manual"): Promise<string> {
    const sessionID = await this.createSession(`main:${reason}`)
    await this.sessions.setMainSessionID(sessionID)
    this.logger.info({ sessionID, reason }, "new main session created")
    return sessionID
  }

  async heartbeatTaskStatus(): Promise<{ file: string; taskCount: number; empty: boolean }> {
    const file = this.opts.heartbeatFile
    const tasks = await this.loadHeartbeatTasks()
    return {
      file: relativePath(Bun.cwd, file) || basename(file),
      taskCount: tasks.length,
      empty: tasks.length === 0,
    }
  }

  async close(): Promise<void> {
    if (typeof this.runtime?.close === "function") {
      await this.runtime.close()
    }
  }

  // ─── Private: runtime setup ─────────────────────────────────────────────────

  private async setupRuntime(): Promise<void> {
    if (this.client) return
    this.runtime = await createRuntime(this.opts)
    this.client = this.runtime.client
    if (!this.runtime.close) {
      this.logger.warn("Using external OpenCode server (no local server spawned)")
    }
    const baseUrl = this.opts.serverUrl || `http://${this.opts.hostname}:${this.opts.port}`
    process.env.OPENCODE_SERVER_BASE_URL = baseUrl
    if (this.opts.model) {
      process.env.OPENCODE_SUBAGENT_MODEL = this.opts.model
    }
  }

  private ensureClient(): OpencodeClient {
    if (!this.client) throw new Error("AssistantCore not initialized. Call init() first.")
    return this.client
  }

  // ─── Private: session management ────────────────────────────────────────────

  private async createSession(key: string): Promise<string> {
    const client = this.ensureClient()
    const info = await apiSessionCreate(client, { body: { title: `chat:${key}` } })
    const id = info.id
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Failed to create session: missing id")
    }
    this.logger.info({ key, sessionID: id }, "session created")
    return id
  }

  private async getOrCreateMainSession(): Promise<string> {
    return this.sessions.getMainSessionID() ?? this.createSession("main").then(async (id) => {
      await this.sessions.setMainSessionID(id)
      return id
    })
  }

  private async getOrCreateHeartbeatSession(): Promise<string> {
    return this.sessions.getHeartbeatSessionID() ?? this.createSession("heartbeat").then(async (id) => {
      await this.sessions.setHeartbeatSessionID(id)
      return id
    })
  }

  private async getOrCreateWorkSession(): Promise<string> {
    return this.sessions.getWorkSessionID() ?? this.createSession("work").then(async (id) => {
      await this.sessions.setWorkSessionID(id)
      return id
    })
  }

  // ─── Private: context helpers ────────────────────────────────────────────────

  private async loadRecentContext(sessionID: string): Promise<string> {
    try {
      const messages = await apiSessionMessages(this.ensureClient(), { path: { id: sessionID } })
      return buildRecentContext(messages)
    } catch (error) {
      this.logger.warn({ error, sessionID }, "failed to load recent context")
      return ""
    }
  }

  private async captureAssistantSig(sessionID: string): Promise<string> {
    try {
      const messages = await apiSessionMessages(this.ensureClient(), { path: { id: sessionID } })
      return assistantSignature(latestAssistantMessage(messages))
    } catch {
      return ""
    }
  }

  // ─── Private: reply resolution ───────────────────────────────────────────────

  private async resolveReply(
    response: unknown,
    sessionID: string,
    beforeSig: string,
  ): Promise<string> {
    const parsed = await extractPromptText(response)
    if (parsed) return parsed

    this.logger.warn({ sessionID }, "direct parse failed; polling for reply")
    const polled = await this.waitForAssistantReply(sessionID, beforeSig)
    if (polled) return polled

    this.logger.error({ sessionID }, "no reply received — check provider auth and model config")
    return "No reply received from model. Check OpenCode provider authentication and model configuration."
  }

  private async waitForAssistantReply(sessionID: string, beforeSig: string): Promise<string | null> {
    const endAt = Date.now() + 60_000
    const intervalMs = 700
    let pollCount = 0
    while (Date.now() < endAt) {
      pollCount++
      try {
        const messages = await apiSessionMessages(this.ensureClient(), { path: { id: sessionID } })
        const latest = latestAssistantMessage(messages)
        const sig = assistantSignature(latest)
        if (latest && sig !== beforeSig) {
          const text = extractTextFromMessage(latest)
          if (text) return text
        }
      } catch (error) {
        this.logger.warn({ error, sessionID, pollCount }, "poll attempt failed")
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    this.logger.warn({ sessionID }, "reply polling timed out")
    return null
  }

  // ─── Private: heartbeat file ─────────────────────────────────────────────────

  private async loadHeartbeatTasks(): Promise<string[]> {
    const file = this.opts.heartbeatFile
    await ensureDir(dirname(file))
    let content: string
    try {
      content = await readText(file)
    } catch {
      await writeText(file, "")
      return []
    }
    return content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .map((l) => l.replace(/^[-*]\s+/, ""))
      .filter(Boolean)
  }
}
