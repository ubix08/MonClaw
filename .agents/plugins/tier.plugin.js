import { tool } from "@opencode-ai/plugin"

const workspaceDir = [Bun.cwd, ".data", "workspace"].join("/")
const soulFile = workspaceDir + "/SOUL.md"

function joinPath(...parts) {
  return parts
    .filter((part) => part !== "")
    .map((part, index) => {
      if (index === 0) return part.replace(/\/+$/g, "")
      return part.replace(/^\/+/g, "").replace(/\/+$/g, "")
    })
    .filter(Boolean)
    .join("/")
}

function dirname(input) {
  const idx = input.lastIndexOf("/")
  if (idx <= 0) return "."
  return input.slice(0, idx)
}

async function run(cmd) {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" })
  await proc.exited
}

async function ensureSoulFile() {
  await run(["mkdir", "-p", dirname(soulFile)])
  try {
    await Bun.file(soulFile).text()
  } catch {
    const defaultContent = [
      "# SOUL.md: Behavioral Identity & Operating Protocols",
      "",
      "## Identity",
      "I am MonClaw, an Autonomous AI Software Engineer.",
      "",
      "## Autonomy Tiers",
      "I operate in one of three autonomy modes:",
      '- **Tier 1: Autonomous** - Default mode. I execute tasks fully and deliver results, notifying the user of outcomes.',
      '- **Tier 2: Stage for Review** - For high-impact changes.',
      '- **Tier 3: Confirm** - For ambiguous tasks. Present plan, await confirmation.',
      "**Current Tier:** Tier 1 - Autonomous",
    ].join("\n")
    await Bun.write(soulFile, defaultContent)
  }
}

export default async () => {
  return {
    tool: {
      set_autonomy_tier: tool({
        description: "Set the current autonomy tier in SOUL.md. Use Tier 1 for autonomous execution, Tier 2 for staging work for review, Tier 3 for confirming plans before execution.",
        args: {
          tier: tool.schema
            .string()
            .describe("Autonomy tier: 'Tier 1 - Autonomous', 'Tier 2 - Stage for Review', or 'Tier 3 - Confirm'"),
          reason: tool.schema.string().describe("Why this tier is appropriate for the current task"),
        },
        async execute(args) {
          const { tier, reason } = args
          const validTiers = ["Tier 1 - Autonomous", "Tier 2 - Stage for Review", "Tier 3 - Confirm"]
          if (!validTiers.includes(tier)) {
            return `Invalid tier. Must be one of: ${validTiers.join(", ")}`
          }

          await ensureSoulFile()
          let content = await Bun.file(soulFile).text()

          if (content.includes("**Current Tier:**")) {
            content = content.replace(/\*\*Current Tier:\*\*\s*.+/, `**Current Tier:** ${tier}`)
          } else {
            content += `\n**Current Tier:** ${tier}\n`
          }

          await Bun.write(soulFile, content)
          return `Autonomy tier set to: ${tier}. Reason: ${reason}`
        },
      }),
    },
  }
}
