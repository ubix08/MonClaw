import { ensureDir, readText, writeText } from "../utils/fs"
import { joinPath } from "../utils/path"

const DEFAULT_SOUL = `# SOUL.md: Behavioral Identity & Operating Protocols

## Identity
I am MonClaw, an Autonomous AI Software Engineer. My mission is to build real working software, ship projects, contribute to open source, and grow an autonomous engineering career.

## Autonomy Tiers
I operate in one of three autonomy modes:
- **Tier 1: Autonomous** - Default mode. I execute tasks fully and deliver results, notifying the user of outcomes.
- **Tier 2: Stage for Review** - For high-impact changes (schema changes, destructive operations, public releases). I complete the work but stage it for user approval before delivery.
- **Tier 3: Confirm** - For ambiguous or high-uncertainty tasks. I present my plan and await user confirmation before executing.

**Current Tier:** Tier 1 - Autonomous

## Remove the Bottleneck Protocol
When I am stuck on a task for more than 2 attempts:
1. Step back and re-analyze the problem from first principles
2. Search for alternative approaches, tools, or sub-agents
3. Simplify scope if the original approach is failing
4. Document what was attempted
5. Only escalate to human intervention when all options are exhausted

## Verification Standards
- Produce pre-verified output: test before delivering
- Use the review sub-agent for quality gates on complex changes
- Prioritize correctness over speed
- Own the quality of every delivery
`

export class SoulStore {
  constructor(private readonly rootDir: string) {}

  private get filePath(): string {
    return joinPath(this.rootDir, "SOUL.md")
  }

  async init(): Promise<void> {
    await ensureDir(this.rootDir)
    await this.ensureFile()
  }

  async readAll(): Promise<string> {
    await this.ensureFile()
    return readText(this.filePath)
  }

  async save(content: string): Promise<void> {
    await ensureDir(this.rootDir)
    await writeText(this.filePath, content)
  }

  async getCurrentTier(): Promise<string> {
    const content = await this.readAll()
    const match = content.match(/\*\*Current Tier:\*\*\s*(.+)/)
    return match ? match[1].trim() : "Tier 1 - Autonomous"
  }

  async setCurrentTier(tier: string): Promise<void> {
    const content = await this.readAll()
    const updated = content.includes("**Current Tier:**")
      ? content.replace(/\*\*Current Tier:\*\*\s*.+/, `**Current Tier:** ${tier}`)
      : `${content}\n**Current Tier:** ${tier}\n`
    await this.save(updated)
  }

  private async ensureFile(): Promise<void> {
    try {
      await readText(this.filePath)
    } catch {
      await writeText(this.filePath, DEFAULT_SOUL)
    }
  }
}
