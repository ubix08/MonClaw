/**
 * bts.ts — Behavioral Thinking System for MonClaw
 *
 * Resolves the full behavioral state of the agent in one parallel I/O round.
 * Returns a typed BehavioralState that the context assembler consumes.
 *
 * Design principles:
 *  - State is explicit and typed, not inferred from markdown regex.
 *  - Autonomy tier drives concrete policy, not decorative text.
 *  - Bottleneck detection is a first-class state, not a prompt hint.
 *  - BTS reads from stores; it never writes to them.
 */

import type { AutonomyTier } from "../identity/types"
import type { SoulStore } from "../identity/soul"
import type { MissionStore } from "../identity/mission"
import type { MemoryStore } from "../memory/store"

// ─── Core types ───────────────────────────────────────────────────────────────

export type BottleneckState =
  | { detected: false }
  | { detected: true; pattern: string; attemptCount: number }

export type BehavioralState = {
  autonomyTier: AutonomyTier
  missionText: string
  nextMilestone: string | null
  memoryText: string
  bottleneck: BottleneckState
  policy: ActionPolicy
}

export type ActionPolicy = {
  canExecuteDirectly: boolean
  mustStageForReview: boolean
  mustConfirmBeforeAction: boolean
  shouldPivot: boolean
  pivotSuggestion: string | null
}

// ─── Tier resolution ──────────────────────────────────────────────────────────

function parseAutonomyTier(soulText: string): AutonomyTier {
  const match = soulText.match(/\*\*Current Tier:\*\*\s*Tier\s*(\d)/i)
  if (!match) return "autonomous"
  switch (match[1]) {
    case "2": return "stage_for_review"
    case "3": return "confirm"
    default:  return "autonomous"
  }
}

// ─── Mission parsing ──────────────────────────────────────────────────────────

function extractNextMilestone(missionText: string): string | null {
  const lines = missionText.split("\n")
  for (const line of lines) {
    const match = line.match(/^-\s*\[ \]\s*(.+)/)
    if (match) return match[1].trim()
  }
  return null
}

// ─── Bottleneck detection ─────────────────────────────────────────────────────

function detectBottleneck(recentContext: string): BottleneckState {
  if (!recentContext) return { detected: false }

  const lines = recentContext
    .split("\n")
    .map((l) => l.toLowerCase().trim())
    .filter((l) => l.length > 10)

  const seen = new Map<string, number>()
  for (const line of lines) {
    const key = line.slice(0, 60)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  let maxCount = 0
  let topPattern = ""
  for (const [key, count] of seen) {
    if (count > maxCount) {
      maxCount = count
      topPattern = key
    }
  }

  if (maxCount >= 2) {
    return { detected: true, pattern: topPattern, attemptCount: maxCount }
  }

  return { detected: false }
}

// ─── Policy resolution ────────────────────────────────────────────────────────

function resolvePolicy(tier: AutonomyTier, bottleneck: BottleneckState): ActionPolicy {
  const shouldPivot = bottleneck.detected && bottleneck.attemptCount >= 2

  let pivotSuggestion: string | null = null
  if (shouldPivot && bottleneck.detected) {
    pivotSuggestion =
      `Pattern "${bottleneck.pattern}" failed ${bottleneck.attemptCount}x. ` +
      `Pivot: simplify scope, try alternative approach, or escalate to user.`
  }

  return {
    canExecuteDirectly:      tier === "autonomous",
    mustStageForReview:      tier === "stage_for_review",
    mustConfirmBeforeAction: tier === "confirm",
    shouldPivot,
    pivotSuggestion,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type BTSOptions = {
  soul: SoulStore
  mission: MissionStore
  memory: MemoryStore
  recentContext?: string
}

export async function resolveBehavioralState(opts: BTSOptions): Promise<BehavioralState> {
  const [soulText, missionText, memoryText] = await Promise.all([
    opts.soul.readAll(),
    opts.mission.readAll(),
    opts.memory.readAll(),
  ])

  const autonomyTier = parseAutonomyTier(soulText)
  const nextMilestone = extractNextMilestone(missionText)
  const bottleneck = detectBottleneck(opts.recentContext ?? "")
  const policy = resolvePolicy(autonomyTier, bottleneck)

  return {
    autonomyTier,
    missionText,
    nextMilestone,
    memoryText,
    bottleneck,
    policy,
  }
}

export function formatBottleneckAlert(b: BottleneckState): string {
  if (!b.detected) return ""
  return [
    `BOTTLENECK DETECTED (${b.attemptCount} occurrences): "${b.pattern}"`,
    "Apply Remove-the-Bottleneck Protocol:",
    "1. Re-analyze from first principles",
    "2. Try an alternative tool, sub-agent, or approach",
    "3. Simplify scope",
    "4. Document what was attempted",
    "5. Escalate to user only when all options are exhausted",
  ].join("\n")
}
