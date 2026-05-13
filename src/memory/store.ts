import { ensureDir, readText, writeText } from "../utils/fs"
import { joinPath } from "../utils/path"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"

export class MemoryStore {
  private readonly maxEntries: number

  constructor(private readonly rootDir: string, maxEntries = 100) {
    this.maxEntries = maxEntries
  }

  private get filePath(): string {
    return joinPath(this.rootDir, "MEMORY.md")
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
    const tmpPath = joinPath(this.rootDir, `.MEMORY.tmp.${randomUUID()}`)
    try {
      await fs.copyFile(this.filePath, tmpPath)
      const existing = await readText(tmpPath)
      const lines = existing.split("\n")
      const header = lines[0]?.startsWith("#") ? lines[0] : "# Memory"
      const entries = lines.filter((l) => l.startsWith("- "))
      entries.push(`${prefix}${note.trim()}`)
      const pruned = entries.slice(-this.maxEntries)
      await writeText(tmpPath, `${header}\n${pruned.join("\n")}\n`)
      await fs.rename(tmpPath, this.filePath)
    } catch (error) {
      try { await fs.unlink(tmpPath) } catch { /* ignore */ }
      throw error
    }
  }

  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath)
    } catch {
      await writeText(this.filePath, "# Memory\n")
    }
  }
}
