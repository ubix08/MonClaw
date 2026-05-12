export type PhaseStatus = "pending" | "in_progress" | "complete"

export type PlanPhase = {
  name: string
  tasks: string[]
  status: PhaseStatus
}

export type PlanMeta = {
  title: string
  goal: string
  createdAt: string
  updatedAt: string
}

export type PlanState = {
  meta: PlanMeta
  currentPhase: number
  phases: PlanPhase[]
  errors: Array<{ error: string; attempt: number; resolution: string }>
}

export type PlanSummary = {
  dirName: string
  title: string
  goal: string
  currentPhase: string
  totalPhases: number
  completedPhases: number
  status: "active" | "idle"
}

export type DecisionEntry = {
  timestamp: string
  gate?: string
  decision: string
  rationale: string
  outcome?: string
  score?: number
}
