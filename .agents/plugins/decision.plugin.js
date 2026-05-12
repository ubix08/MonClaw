import { tool } from "@opencode-ai/plugin"

const SEP = "/"
const workspaceDir = [Bun.cwd, ".data", "workspace"].join(SEP)

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

function nowStamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 16)
}

async function run(cmd) {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" })
  await proc.exited
}

async function getActivePlanDir() {
  const pointer = joinPath(workspaceDir, "plans", ".active")
  try {
    return (await Bun.file(pointer).text()).trim()
  } catch {
    return null
  }
}

export default async () => {
  return {
    tool: {
      log_decision: tool({
        description: "Log a quality gate decision to the active plan's decisions.md file. Records gate name, result (proceed/reject/revise), score, and rationale.",
        args: {
          gate: tool.schema.string().describe("Gate name, e.g., code-review, security, test-coverage"),
          result: tool.schema.string().describe("Decision result: proceed, reject, or revise"),
          score: tool.schema.number().optional().describe("Quality score 0-100"),
          rationale: tool.schema.string().describe("Reasoning behind the decision"),
          decision: tool.schema.string().optional().describe("Optional key decision description for the decisions log"),
        },
        async execute(args) {
          const { gate, result, score, rationale, decision } = args
          if (!gate || !result || !rationale) return "Gate, result, and rationale are required."

          const activeDir = await getActivePlanDir()
          if (!activeDir) return "No active plan found. Create a plan first."

          const decisionsFile = joinPath(workspaceDir, "plans", activeDir, "decisions.md")
          let content = ""
          try {
            content = await Bun.file(decisionsFile).text()
          } catch {
            return `Decisions file not found at ${decisionsFile}.`
          }

          const ts = nowStamp()
          const scoreStr = score != null ? String(score) : "-"
          const gateRow = `| ${ts} | ${gate} | ${result} | ${scoreStr} | ${rationale} |`

          const keyDecisionsIdx = content.indexOf("## Key Decisions")
          if (keyDecisionsIdx === -1) {
            content += `\n${gateRow}\n`
          } else {
            content = content.slice(0, keyDecisionsIdx) + gateRow + "\n\n" + content.slice(keyDecisionsIdx)
          }

          if (decision) {
            const decisionIdx = content.indexOf("## Key Decisions")
            if (decisionIdx !== -1) {
              const sepStart = content.indexOf("|---", decisionIdx)
              if (sepStart !== -1) {
                const afterSep = content.indexOf("\n", sepStart)
                if (afterSep !== -1) {
                  const decisionRow = `| ${ts} | ${decision} | ${rationale} | - |`
                  content = content.slice(0, afterSep + 1) + decisionRow + "\n" + content.slice(afterSep + 1)
                }
              }
            }
          }

          await run(["mkdir", "-p", dirname(decisionsFile)])
          await Bun.write(decisionsFile, content)
          return `Logged gate outcome: ${gate} → ${result} (score: ${scoreStr})`
        },
      }),
    },
  }
}
