export type PersonalityTrait = {
  name: string
  description: string
}

export type IdentityProfile = {
  name: string
  title: string
  personality: PersonalityTrait[]
  values: string[]
  communicationStyle: string
}

export type MilestoneStatus = "pending" | "in_progress" | "completed"

export type Milestone = {
  id: string
  description: string
  status: MilestoneStatus
  completedAt?: string
}

export type MissionState = {
  statement: string
  careerStage: string
  milestones: Milestone[]
  startedAt: string
}
