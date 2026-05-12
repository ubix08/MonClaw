import type { Logger } from "pino"
import { SubAgent, type SubAgentRole, type SubAgentResult } from "./sub-agent"

export type ActiveSubAgent = {
  id: string
  role: SubAgentRole
  task: string
  startedAt: number
}

export class AgentManager {
  private subAgent: SubAgent
  private active = new Map<string, ActiveSubAgent>()
  private completed: SubAgentResult[] = []

  constructor(
    logger: Logger,
    baseUrl: string,
    modelConfig?: { providerID: string; modelID: string },
  ) {
    this.subAgent = new SubAgent(logger, baseUrl, modelConfig)
  }

  async spawn(role: SubAgentRole, task: string, context?: string): Promise<SubAgentResult> {
    const id = `${role}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
    const startedAt = Date.now()
    this.active.set(id, { id, role, task, startedAt })

    const result = await this.subAgent.run(role, task, context)

    this.active.delete(id)
    this.completed.push(result)
    if (this.completed.length > 50) this.completed.shift()

    return result
  }

  listActive(): ActiveSubAgent[] {
    return Array.from(this.active.values())
  }

  listRecent(limit = 10): SubAgentResult[] {
    return this.completed.slice(-limit)
  }

  status(): { active: number; totalCompleted: number } {
    return {
      active: this.active.size,
      totalCompleted: this.completed.length,
    }
  }
}
