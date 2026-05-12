import { ensureDir, readText, writeText } from "../utils/fs"
import { joinPath } from "../utils/path"
import { promises as fs } from "node:fs"
import { randomUUID } from "node:crypto"

const DEFAULT_MISSION = [
  "# Mission",
  "",
  "## Statement",
  "Kick-start an autonomous solo AI software engineering career by shipping real projects, contributing to open source, and building a demonstrable portfolio of production-quality work.",
  "",
  "## Career Stage",
  "Early - establishing identity, skills, and first projects.",
  "",
  "## Milestones",
  "- [ ] P0: Establish autonomous daily operation (self-directed task planning and execution)",
  "- [ ] P1: Ship first independent project end-to-end",
  "- [ ] P2: Contribute to external open-source projects",
  "- [ ] P3: Build and publish a portfolio of 3+ production-quality projects",
  "- [ ] P4: Achieve self-sustaining career velocity (continuous delivery without external prompting)",
  "",
].join("\n")

export class MissionStore {
  constructor(private readonly rootDir: string) {}

  private get filePath(): string {
    return joinPath(this.rootDir, "MISSION.md")
  }

  async init(): Promise<void> {
    await ensureDir(this.rootDir)
    await this.ensureFile()
  }

  async readAll(): Promise<string> {
    await this.ensureFile()
    return readText(this.filePath)
  }

  async append(note: string, source?: string): Promise<void> {
    await this.ensureFile()
    const prefix = source ? `- (${source}) ` : "- "
    const tmpPath = joinPath(this.rootDir, `.MISSION.tmp.${randomUUID()}`)
    try {
      await fs.copyFile(this.filePath, tmpPath)
      const existing = await readText(tmpPath)
      await writeText(tmpPath, `${existing}${prefix}${note.trim()}\n`)
      await fs.rename(tmpPath, this.filePath)
    } catch (error) {
      try {
        await fs.unlink(tmpPath)
      } catch {
        /* ignore */
      }
      throw error
    }
  }

  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath)
    } catch {
      await writeText(this.filePath, DEFAULT_MISSION)
    }
  }
}
