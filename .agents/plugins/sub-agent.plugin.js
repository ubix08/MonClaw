import { tool } from "@opencode-ai/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"

const VALID_ROLES = ["plan", "code", "review", "research", "debug", "test", "loki"]

const ROLE_PROMPTS = {
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

function baseUrl() {
  return process.env.OPENCODE_SERVER_BASE_URL || "http://127.0.0.1:4096"
}

function modelConfig(role) {
  const roleKey = role ? role.toUpperCase() : ''
  const roleVar = roleKey ? process.env[`OPENCODE_SUBAGENT_MODEL_${roleKey}`] : undefined
  const raw = roleVar || process.env.OPENCODE_SUBAGENT_MODEL
  if (!raw) return undefined
  const [providerID, ...rest] = raw.split("/")
  if (!providerID || rest.length === 0) return undefined
  return { providerID, modelID: rest.join("/") }
}

function unwrap(value) {
  if (value && typeof value === "object" && "data" in value) {
    return value.data
  }
  return value
}

async function extractText(result) {
  const payload = unwrap(result)
  const directParts = payload.parts
  if (Array.isArray(directParts)) {
    const merged = directParts
      .map((p) => (p && typeof p === "object" && typeof p.text === "string" ? p.text : ""))
      .join("\n").trim()
    if (merged) return merged
  }
  const message = payload.message
  if (message && typeof message === "object") {
    const msgParts = message.parts
    if (Array.isArray(msgParts)) {
      const merged = msgParts
        .map((p) => (p && typeof p === "object" && typeof p.text === "string" ? p.text : ""))
        .join("\n").trim()
      if (merged) return merged
    }
  }
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim()
  return null
}

function toMessages(value) {
  const payload = unwrap(value)
  const data = payload.data
  return Array.isArray(data) ? data : []
}

async function pollReply(client, sessionID, timeoutMs = 120000) {
  const endAt = Date.now() + timeoutMs
  while (Date.now() < endAt) {
    try {
      const result = await client.session.messages({ path: { id: sessionID } })
      const messages = toMessages(result)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg?.info?.role !== "assistant") continue
        const parts = Array.isArray(msg.parts) ? msg.parts : []
        const text = parts
          .map((p) => (p?.type === "text" && typeof p.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("\n").trim()
        if (text.length > 0) return text
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  return null
}

export default async () => {
  const url = baseUrl()
  const client = createOpencodeClient({ baseUrl: url })

  return {
    tool: {
      spawn_sub_agent: tool({
        description: "Delegate a task to a specialized sub-agent. Use for complex multi-step work that benefits from parallel or focused execution.",
        args: {
          role: tool.schema
            .string()
            .describe("Sub-agent specialization: plan, code, review, research, debug, test, loki"),
          task: tool.schema.string().describe("The specific task for the sub-agent to complete"),
          context: tool.schema
            .string()
            .optional()
            .describe("Optional context from the main conversation (code snippets, requirements, etc.)"),
        },
        async execute(args) {
          const { role, task, context } = args
          if (!VALID_ROLES.includes(role)) return `Invalid sub-agent role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`
          const startedAt = Date.now()
          const model = modelConfig(role)

          const session = await client.session.create({
            body: { title: `sub:${role}:${Date.now()}` },
          })
          const sessionPayload = unwrap(session)
          const sessionID = typeof sessionPayload.id === "string" ? sessionPayload.id : null
          if (!sessionID) throw new Error("Failed to create sub-agent session")

          const systemPrompt = [
            ROLE_PROMPTS[role] || "",
            "",
            context ? `Context:\n${context}` : "",
            "Do NOT use markdown formatting. Output plain text only.",
          ].join("\n")

          try {
            await client.session.prompt({
              path: { id: sessionID },
              body: {
                noReply: false,
                system: systemPrompt,
                parts: [{ type: "text", text: task }],
                ...(model ? { model } : {}),
              },
            })

            const output = await pollReply(client, sessionID)
            const durationMs = Date.now() - startedAt

            if (output) {
              return [
                `[sub-agent:${role}] completed in ${durationMs}ms`,
                "",
                output,
              ].join("\n")
            }

            return `[sub-agent:${role}] finished but returned no parsable output (${durationMs}ms)`
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return `[sub-agent:${role}] failed: ${msg}`
          }
        },
      }),
    },
  }
}
