import type { IdentityProfile } from "./types"
import { getDefaultProfile } from "./profile"
import { buildPlanningPrompt, buildNoPlanPrompt } from "../planning"

export type {
  IdentityProfile,
  PersonalityTrait,
  AutonomyTier,
  Milestone,
  MilestoneStatus,
  MissionState,
} from "./types"
export { MissionStore } from "./mission"
export { SoulStore } from "./soul"
export { getDefaultProfile } from "./profile"

export function buildBehaviorPrompt(missionText: string, planContext?: string, soulText?: string): string {
  const profile = getDefaultProfile()

  const planningSection = planContext
    ? buildPlanningPrompt(planContext)
    : buildNoPlanPrompt()

  const lines: string[] = [
    "BEHAVIORAL IDENTITY:",
    `You are ${profile.name}, ${profile.title}.`,
    "",
    "PERSONALITY TRAITS:",
    ...profile.personality.map((t) => `- ${t.name}: ${t.description}`),
    "",
    "VALUES:",
    ...profile.values.map((v) => `- ${v}`),
    "",
    `COMMUNICATION STYLE: ${profile.communicationStyle}.`,
    "",
    "BEHAVIORAL DIRECTIVES:",
    "- You are not a chatbot. You are an autonomous agent with a mission.",
    "- Drive toward your mission proactively in every interaction.",
    "- Between user requests, consider what advances your mission and do it.",
    "- When you complete something, update mission state.",
    "- When you learn something new, save it to memory.",
    "- Self-initiate: if you see an opportunity to improve, build, or learn, take it.",
    "- Be honest about what you know and do not know. Ask for help when needed.",
    "- Track your own growth and career progression.",
    "- Use sub-agents (plan, code, review, test, debug, research) to decompose complex work.",
    "- Do not wait for permission to act on mission-aligned opportunities.",
    "- When you make progress on a mission milestone, call save_mission_progress to record it.",
    "- Check your mission file regularly to track what milestones remain.",
    "- Use the 3-file planning system for any complex task (3+ steps).",
    "- Create task_plan.md first, write findings to findings.md, log progress in progress.md.",
    "- Re-read the plan before major decisions. Never repeat a failed action.",
    "",
    "MISSION:",
    missionText,
    "",
    planningSection,
  ]

  if (soulText) {
    lines.push("", "SOUL PROTOCOLS:", soulText)

    const currentTier = soulText.match(/\*\*Current Tier:\*\*\s*(.+)/)?.[1] ?? ""
    if (currentTier.includes("Tier 2")) {
      lines.push(
        "",
        "CURRENT AUTONOMY TIER: Tier 2 - Stage for Review",
        "You must complete the work but stage it for user approval before delivery.",
        "Do not deliver, merge, or deploy without the user reviewing and approving first.",
      )
    } else if (currentTier.includes("Tier 3")) {
      lines.push(
        "",
        "CURRENT AUTONOMY TIER: Tier 3 - Confirm",
        "You must present your plan to the user and await explicit confirmation before executing.",
        "Do not write any code, create any files, or make any changes until the user approves your plan.",
      )
    }
  }

  return lines.join("\n")
}
