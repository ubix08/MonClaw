import { tool } from "@opencode-ai/plugin"

const SEP = "/"
const missionFile = joinPath(Bun.cwd, ".data", "workspace", "MISSION.md")

function joinPath(...parts) {
  return parts
    .filter((part) => part !== "")
    .map((part, index) => {
      if (index === 0) return part.replace(/\/+$/g, "")
      return part.replace(/^\/+/g, "").replace(/\/+$/g, "")
    })
    .filter(Boolean)
    .join(SEP)
}

function dirname(input) {
  const idx = input.lastIndexOf(SEP)
  if (idx <= 0) return "."
  return input.slice(0, idx)
}

async function run(cmd) {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" })
  await proc.exited
}

async function ensureMissionFile() {
  await run(["mkdir", "-p", dirname(missionFile)])
  try {
    await Bun.file(missionFile).text()
  } catch {
    const defaultMission = [
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
    await Bun.write(missionFile, defaultMission)
  }
}

export default async () => {
  return {
    tool: {
      save_mission_progress: tool({
        description: "Update MISSION.md with a progress note or milestone update. Call this when you complete work toward your mission.",
        args: {
          note: tool.schema
            .string()
            .describe(
              "A short description of the progress made, milestone completed, or mission state change",
            ),
        },
        async execute(args) {
          const note = args.note.trim()
          if (!note) return "Skipped: empty mission note."

          await ensureMissionFile()
          const existing = await Bun.file(missionFile).text()
          const timestamp = new Date().toISOString().split("T")[0]
          await Bun.write(
            missionFile,
            `${existing}- (${timestamp}) ${note}\n`,
          )
          return "Mission progress updated."
        },
      }),
    },
  }
}
