/**
 * context.ts — Unified context assembly for MonClaw agent
 *
 * Design principles:
 *  - Every token must earn its place. Nothing decorative.
 *  - Sections are conditional: only injected when they carry signal.
 *  - Ordered by decision-relevance: identity → state → tools → constraints.
 *  - No repeated facts between sections.
 *  - Hard character budgets per section prevent unbounded growth.
 */

import type { AutonomyTier } from "../identity/types"

// ─── Section budgets (characters, not tokens) ────────────────────────────────
const BUDGET = {
  memory: 1_200,
  mission: 600,
  recentContext: 1_200,
} as const

// ─── Raw inputs expected by the assembler ────────────────────────────────────
export type ContextInputs = {
  autonomyTier: AutonomyTier
  heartbeatIntervalMinutes: number
  memory?: string
  mission?: string
  recentContext?: string
  mode: "chat" | "heartbeat" | "work"
}

// ─── Autonomy tier → directive ────────────────────────────────────────────────
const TIER_DIRECTIVE: Record<AutonomyTier, string> = {
  autonomous:
    "T1: Execute fully. Deliver results. Notify user of outcomes.",
  stage_for_review:
    "T2: Complete the work, then stage for user approval. Do not deliver, merge, or deploy without explicit approval.",
  confirm:
    "T3: Present plan and await explicit user confirmation before writing any code or files.",
}

// ─── Mode-specific operational focus ─────────────────────────────────────────
const MODE_FOCUS: Record<ContextInputs["mode"], string> = {
  chat:
    "Respond to the user. If the request is complex (3+ steps), create a plan first. Prefer action over explanation.",
  heartbeat:
    "Execute playbook tasks autonomously. Return concise bullet findings. Flag bottlenecks. Call send_channel_message only if the user must act now.",
  work:
    "Execute the work cycle prompt autonomously. Use sub-agents when appropriate. Return structured output.",
}

// ─── Tool catalogue (static, no repetition across calls) ─────────────────────
const TOOLS_BLOCK = `TOOLS:
save_memory(fact)          — persist durable user fact to MEMORY.md
save_mission_progress(note)— record milestone advancement
install_skill(github_url)  — install skill under .agents/skills/
skill(name)                — load installed skill instructions
spawn_sub_agent(role,task) — delegate to: plan|code|review|research|debug|test|loki
send_channel_message(text) — push message to last active channel
loki_start|loki_plan|loki_review — loki-mode MCP tools for full SDLC builds`

// ─── Invariant behavioral rules (minimal, non-redundant) ─────────────────────
const BEHAVIORAL_RULES = `RULES:
- Plain text only. No markdown in replies (chat surface has no renderer).
- save_memory: one atomic fact per call, durable preferences only.
- Use spawn_sub_agent to fork child sessions for subtasks/phases. Each child session auto-tracks its own messages, diffs, and files.
- Use todowrite tool to manage task items (status, priority) within the current session.
- Stuck >2 attempts: pivot strategy, simplify scope, document what failed.
- loki-mode for full apps/services. Sub-agents for isolated tasks.
- After heartbeat summary injected: notify user only if action is needed.`

// ─── Budget-aware truncation ──────────────────────────────────────────────────
function truncate(text: string, maxChars: number, label: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  const cut = trimmed.slice(0, maxChars)
  const lastNewline = cut.lastIndexOf("\n")
  const boundary = lastNewline > maxChars * 0.7 ? lastNewline : maxChars
  return trimmed.slice(0, boundary) + `\n[...${label} truncated — read full file for details]`
}

// ─── Section builders ─────────────────────────────────────────────────────────

function identitySection(tier: AutonomyTier): string {
  return `IDENTITY: MonClaw — Autonomous AI Software Engineer
MISSION DRIVE: Build real software. Ship. Contribute to OSS. Grow career autonomously.
AUTONOMY: ${TIER_DIRECTIVE[tier]}`
}

function missionSection(raw: string): string {
  const trimmed = truncate(raw, BUDGET.mission, "MISSION")
  if (!trimmed) return ""
  return `MISSION STATE:\n${trimmed}`
}

function memorySection(raw: string): string {
  const trimmed = truncate(raw, BUDGET.memory, "MEMORY")
  if (!trimmed || trimmed === "# Memory") return ""
  return `MEMORY:\n${trimmed}`
}

function recentContextSection(raw: string): string {
  const trimmed = truncate(raw, BUDGET.recentContext, "CONTEXT")
  if (!trimmed) return ""
  return `RECENT CONTEXT:\n${trimmed}`
}

function heartbeatMeta(intervalMinutes: number): string {
  return `HEARTBEAT: runs every ${intervalMinutes}min in a separate session. Its summary is injected into main session.`
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export function assembleSystemPrompt(inputs: ContextInputs): string {
  const sections: string[] = []

  sections.push(identitySection(inputs.autonomyTier))
  sections.push(`FOCUS: ${MODE_FOCUS[inputs.mode]}`)

  if (inputs.mission) {
    const s = missionSection(inputs.mission)
    if (s) sections.push(s)
  }

  if (inputs.memory) {
    const s = memorySection(inputs.memory)
    if (s) sections.push(s)
  }

  if (inputs.recentContext) {
    const s = recentContextSection(inputs.recentContext)
    if (s) sections.push(s)
  }

  sections.push(TOOLS_BLOCK)
  sections.push(BEHAVIORAL_RULES)

  if (inputs.mode === "heartbeat") {
    sections.push(heartbeatMeta(inputs.heartbeatIntervalMinutes))
  }

  return sections.join("\n\n")
}

export function estimateTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4)
}
