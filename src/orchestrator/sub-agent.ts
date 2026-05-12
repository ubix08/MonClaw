import { createOpencodeClient } from "@opencode-ai/sdk"
import type { Logger } from "pino"

export type SubAgentRole = "plan" | "code" | "review" | "research" | "debug" | "test" | "loki"

export type SubAgentResult = {
  sessionID: string
  role: SubAgentRole
  task: string
  output: string
  durationMs: number
  error?: string
}

const ROLE_PROMPTS: Record<SubAgentRole, string> = {
  plan: [
    "You are a software architecture and planning sub-agent.",
    "Analyze requirements and produce a clear, actionable plan.",
    "Output: architecture decisions, file list, task breakdown.",
    "Keep output concise and structured.",
  ].join("\n"),
  code: [
    "You are a coding sub-agent.",
    "Write clean, correct, idiomatic code following project conventions.",
    "Output only the code and minimal explanation.",
    "Prefer editing existing files over creating new ones.",
  ].join("\n"),
  review: [
    "You are a code review sub-agent.",
    "Review code for: correctness, security, performance, style, error handling.",
    "Apply loki-mode quality gates:",
    "- Gate 1: Static analysis checks",
    "- Gate 2: 3-reviewer blind review standard (be one of the reviewers)",
    "- Gate 3: Anti-sycophancy - play devil's advocate on unanimous decisions",
    "- Gate 4: Severity blocking - flag Critical/High issues as blockers",
    "- Gate 5: Test coverage - ensure >80% coverage, 100% pass",
    "- Gate 6: Backward compatibility check",
    "- Gate 7: Documentation coverage check",
    "Output specific issues with file:line references, severity, and suggested fixes.",
    "Be thorough but constructive.",
  ].join("\n"),
  research: [
    "You are a research sub-agent.",
    "Search codebase, docs, or web to answer questions.",
    "Output findings with source references.",
    "Be concise and factual.",
  ].join("\n"),
  debug: [
    "You are a debugging sub-agent.",
    "Analyze error messages, stack traces, and code to identify root causes.",
    "Output: root cause, affected files, suggested fix.",
    "Be systematic: reproduce, isolate, identify, fix.",
  ].join("\n"),
  test: [
    "You are a testing sub-agent.",
    "Write tests following existing patterns and naming conventions.",
    "Cover: happy path, edge cases, error conditions.",
    "Output test code and what it validates.",
  ].join("\n"),
  loki: [
    "You are a loki-mode SDLC sub-agent. You MUST run loki CLI commands to complete tasks.",
    "The user wants an application built. Use these commands:",
    "",
    "1. loki plan <spec> - analyze complexity and cost first",
    "2. loki start <spec> - autonomous build from PRD, issue, or prompt",
    "3. loki review --staged - AI code review with 11 quality gates",
    "4. loki test --dir <path> - AI test generation",
    "",
    "For quick tasks: loki quick 'description' (one-shot generation).",
    "For existing code: loki heal <path> for legacy system healing.",
    "",
    "Loki Mode runs RARV cycles (Reason-Act-Reflect-Verify) with 41 agent types,",
    "8 swarms, and 11 quality gates across 5 AI providers.",
    "Output: summary of what was built, key files, test results, quality gate status.",
    "Do NOT ask the user questions. Decide and execute.",
  ].join("\n"),
}

export class SubAgent {
  private client: ReturnType<typeof createOpencodeClient>

  constructor(
    private readonly logger: Logger,
    private readonly baseUrl: string,
    private readonly modelConfig?: { providerID: string; modelID: string },
  ) {
    this.client = createOpencodeClient({ baseUrl })
  }

  async run(role: SubAgentRole, task: string, context?: string): Promise<SubAgentResult> {
    const startedAt = Date.now()
    const session = await this.createSession(role)
    const sessionID = session.id
    if (typeof sessionID !== "string") throw new Error("sub-agent session create failed")

    this.logger.info({ sessionID, role, taskLength: task.length }, "sub-agent session created")

    const systemPrompt = [
      ROLE_PROMPTS[role],
      "",
      context ? `Context from main agent:\n${context}` : "",
      "Do NOT use markdown formatting. Output plain text only.",
    ].join("\n")

    try {
      const response = await this.client.session.prompt({
        path: { id: sessionID },
        body: {
          noReply: false,
          system: systemPrompt,
          parts: [{ type: "text", text: task }],
          ...(this.modelConfig ? { model: this.modelConfig } : {}),
        },
      } as never)

      const output = await this.extractText(response)
      if (output !== "I could not parse the assistant response.") {
        return {
          sessionID,
          role,
          task,
          output,
          durationMs: Date.now() - startedAt,
        }
      }

      const polled = await this.pollForReply(sessionID)
      if (polled) {
        return {
          sessionID,
          role,
          task,
          output: polled,
          durationMs: Date.now() - startedAt,
        }
      }

      return {
        sessionID,
        role,
        task,
        output: "Sub-agent did not produce a reply.",
        durationMs: Date.now() - startedAt,
        error: "no reply from model",
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error({ error: msg, sessionID, role }, "sub-agent execution failed")
      return {
        sessionID,
        role,
        task,
        output: "",
        durationMs: Date.now() - startedAt,
        error: msg,
      }
    }
  }

  private async createSession(role: SubAgentRole): Promise<{ id: string }> {
    const result = await this.client.session.create({
      body: { title: `sub:${role}:${Date.now()}` },
    } as never)
    const payload = unwrap<Record<string, unknown>>(result)
    const id = payload.id
    if (typeof id !== "string") throw new Error("sub-agent session missing id")
    return { id }
  }

  private async extractText(result: unknown): Promise<string> {
    const payload = unwrap<Record<string, unknown>>(result)
    const directParts = payload.parts
    if (directParts && typeof directParts === "object" && Symbol.asyncIterator in directParts) {
      const chunks: string[] = []
      for await (const part of directParts as AsyncIterable<Record<string, unknown>>) {
        const text = part.text
        if (typeof text === "string" && text.length > 0) chunks.push(text)
      }
      const merged = chunks.join("").trim()
      if (merged) return merged
    }
    if (Array.isArray(directParts)) {
      const merged = directParts
        .map((p) => (p && typeof p === "object" && typeof (p as Record<string, unknown>).text === "string" ? (p as Record<string, string>).text : ""))
        .join("\n").trim()
      if (merged) return merged
    }
    const message = payload.message
    if (message && typeof message === "object") {
      const msgParts = (message as Record<string, unknown>).parts
      if (Array.isArray(msgParts)) {
        const merged = msgParts
          .map((p) => (p && typeof p === "object" && typeof (p as Record<string, unknown>).text === "string" ? (p as Record<string, string>).text : ""))
          .join("\n").trim()
        if (merged) return merged
      }
    }
    const maybeText = payload.text
    if (typeof maybeText === "string" && maybeText.trim()) return maybeText.trim()
    return "I could not parse the assistant response."
  }

  private async pollForReply(sessionID: string): Promise<string | null> {
    const endAt = Date.now() + 60_000
    while (Date.now() < endAt) {
      try {
        const result = await this.client.session.messages({ path: { id: sessionID } } as never)
        const messages = toMessages(result)
        const last = latestAssistantMessage(messages)
        if (last) {
          const text = extractTextFromMessage(last)
          if (text.length > 0) return text
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 700))
    }
    return null
  }
}

type SessionMessage = {
  info?: { id?: string; role?: string }
  parts?: Array<{ type?: string; text?: string }>
}

function unwrap<T>(value: unknown): T {
  if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
    return (value as { data: T }).data
  }
  return value as T
}

function toMessages(value: unknown): SessionMessage[] {
  const payload = unwrap<Record<string, unknown>>(value)
  const data = payload.data
  return Array.isArray(data) ? (data as SessionMessage[]) : []
}

function extractTextFromMessage(message: SessionMessage): string {
  const parts = Array.isArray(message.parts) ? message.parts : []
  return parts
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
}

function latestAssistantMessage(messages: SessionMessage[]): SessionMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.info?.role === "assistant") return messages[i]
  }
  return null
}
