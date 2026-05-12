import { ensureDir, readText, writeText } from "../utils/fs"
import { joinPath } from "../utils/path"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"

export class MemoryStore {
  constructor(private readonly rootDir: string) {}

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
      await writeText(tmpPath, `${existing}${prefix}${note.trim()}\n`)
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
