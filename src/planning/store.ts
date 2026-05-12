import { ensureDir, readText, writeText, listFiles } from "../utils/fs"
import { joinPath, basename } from "../utils/path"
import { promises as fs } from "node:fs"
import { TASK_PLAN_TEMPLATE, FINDINGS_TEMPLATE, PROGRESS_TEMPLATE } from "./templates"
import type { PlanSummary } from "./types"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function todayStamp(): string {
  return new Date().toISOString().split("T")[0]
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

export class PlanStore {
  private activePlanDir: string | null = null

  constructor(private readonly rootDir: string) {}

  private get plansDir(): string {
    return joinPath(this.rootDir, "plans")
  }

  private get activePointer(): string {
    return joinPath(this.plansDir, ".active")
  }

  async init(): Promise<void> {
    await ensureDir(this.plansDir)
    await this.loadActivePointer()
  }

  async createPlan(title: string, goal: string): Promise<string> {
    const slug = slugify(title)
    const stamp = todayStamp()
    const dirName = `${stamp}-${slug}`
    const planDir = joinPath(this.plansDir, dirName)

    await ensureDir(planDir)

    const taskPlan = TASK_PLAN_TEMPLATE
      .replace("{{TITLE}}", title)
      .replace("{{GOAL}}", goal)

    const findings = FINDINGS_TEMPLATE

    const progress = PROGRESS_TEMPLATE
      .replace("{{DATE}}", todayStamp())
      .replace("{{TIMESTAMP}}", nowStamp())

    await writeText(joinPath(planDir, "task_plan.md"), taskPlan)
    await writeText(joinPath(planDir, "findings.md"), findings)
    await writeText(joinPath(planDir, "progress.md"), progress)

    await this.setActivePlan(dirName)

    return dirName
  }

  async setActivePlan(dirName: string): Promise<void> {
    const planDir = joinPath(this.plansDir, dirName)
    try {
      await fs.access(planDir)
    } catch {
      throw new Error(`Plan directory not found: ${planDir}`)
    }
    this.activePlanDir = dirName
    await writeText(this.activePointer, dirName)
  }

  async getActivePlanDir(): Promise<string | null> {
    if (this.activePlanDir) return this.activePlanDir
    await this.loadActivePointer()
    return this.activePlanDir
  }

  async getActivePlanContext(): Promise<string> {
    const dir = await this.getActivePlanDir()
    if (!dir) return ""

    const planDir = joinPath(this.plansDir, dir)

    const taskPlan = await this.tryRead(joinPath(planDir, "task_plan.md"))
    const findings = await this.tryRead(joinPath(planDir, "findings.md"))
    const progress = await this.tryRead(joinPath(planDir, "progress.md"))

    const parts: string[] = []
    if (taskPlan) parts.push(`---BEGIN PLAN---\n${taskPlan}\n---END PLAN---`)
    if (findings) parts.push(`---BEGIN FINDINGS---\n${findings}\n---END FINDINGS---`)
    if (progress) parts.push(`---BEGIN PROGRESS---\n${progress}\n---END PROGRESS---`)

    return parts.join("\n\n")
  }

  async listPlans(): Promise<PlanSummary[]> {
    const entries = await listFiles(this.plansDir)
    const planDirs = entries.filter((e) => e !== ".active")

    const summaries: PlanSummary[] = []
    for (const dir of planDirs) {
      const planDir = joinPath(this.plansDir, dir)
      try {
        const stat = await fs.stat(planDir)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      const taskPlan = await this.tryRead(joinPath(planDir, "task_plan.md"))
      if (!taskPlan) continue

      const title = this.extractTitle(taskPlan)
      const goal = this.extractGoal(taskPlan)
      const currentPhase = this.extractCurrentPhase(taskPlan)
      const { total, completed } = this.countPhases(taskPlan)

      summaries.push({
        dirName: dir,
        title,
        goal,
        currentPhase,
        totalPhases: total,
        completedPhases: completed,
        status: dir === this.activePlanDir ? "active" : "idle",
      })
    }

    return summaries.sort((a, b) => b.dirName.localeCompare(a.dirName))
  }

  async planExists(): Promise<boolean> {
    const dir = await this.getActivePlanDir()
    if (!dir) return false
    const planDir = joinPath(this.plansDir, dir)
    try {
      await fs.access(joinPath(planDir, "task_plan.md"))
      return true
    } catch {
      return false
    }
  }

  private async loadActivePointer(): Promise<void> {
    try {
      const content = await readText(this.activePointer)
      const dir = content.trim()
      if (dir) {
        const planDir = joinPath(this.plansDir, dir)
        try {
          await fs.access(planDir)
          this.activePlanDir = dir
        } catch {
          this.activePlanDir = null
        }
      }
    } catch {
      this.activePlanDir = null
    }
  }

  private async tryRead(filePath: string): Promise<string | null> {
    try {
      return await readText(filePath)
    } catch {
      return null
    }
  }

  private extractTitle(content: string): string {
    const match = content.match(/^# Task Plan:\s*(.+)$/m)
    return match ? match[1].trim() : "Untitled"
  }

  private extractGoal(content: string): string {
    const match = content.match(/^## Goal\s*\n(.+)$/m)
    return match ? match[1].trim() : ""
  }

  private extractCurrentPhase(content: string): string {
    const match = content.match(/^## Current Phase\s*\n(.+)$/m)
    return match ? match[1].trim() : "Unknown"
  }

  private countPhases(content: string): { total: number; completed: number } {
    const phaseMatches = content.match(/^### Phase \d+:/gm)
    const total = phaseMatches ? phaseMatches.length : 0
    const completedMatches = content.match(/\*\*Status:\*\*\s*complete/g)
    const completed = completedMatches ? completedMatches.length : 0
    return { total, completed }
  }
}
