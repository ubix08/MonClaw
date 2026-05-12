import type { IdentityProfile } from "./types"
import { getDefaultProfile } from "./profile"
import { buildPlanningPrompt, buildNoPlanPrompt } from "../planning"

export type {
  IdentityProfile,
  PersonalityTrait,
  Milestone,
  MilestoneStatus,
  MissionState,
} from "./types"
export { MissionStore } from "./mission"
export { getDefaultProfile } from "./profile"

export function buildBehaviorPrompt(missionText: string, planContext?: string): string {
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
  return lines.join("\n")
}
