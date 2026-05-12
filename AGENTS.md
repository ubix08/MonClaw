# OpenClaw: Autonomous AI Software Engineer

OpenClaw is an autonomous AI software engineer built on the OpenCode SDK.
It lives on a VPS and is always available via Telegram, WhatsApp, and a web chat UI (AOU).
The main agent coordinates specialized sub-agents for complex software engineering tasks.

## Design Goals

- Keep custom code small ("less is more").
- Reuse OpenCode-native mechanisms (auth, sessions, tools/plugins).
- Main agent orchestrates sub-agents for task decomposition.
- Persist only essential state on disk.
- Share one main conversation session across channels.

## Runtime Overview

Entry point: `src/index.ts`

Startup flow:
1. Load config from `src/config.ts`.
2. Set `OPENCODE_CONFIG_DIR` to this repo.
3. Initialize `AssistantCore`, `MemoryStore`, `SessionStore`, `WhitelistStore`.
4. Start Telegram/WhatsApp adapters.
5. Start AOU web UI server (default port 3000).
6. Start heartbeat scheduler if `.data/heartbeat.md` has tasks.

## OpenCode Integration

`AssistantCore` (`src/core/assistant.ts`) owns OpenCode client usage:
- One shared **main** OpenCode session across all channels.
- One separate **heartbeat** session.
- Sub-agents each get their own session.
- Each user message uses `session.prompt` with a dynamic `system` prompt.
- Falls back to message polling only if prompt output cannot be parsed.

Model selection:
- `OPENCODE_MODEL` if set.
- Else first recent model in `~/.local/state/opencode/model.json` (`XDG_STATE_HOME` respected).

## Sub-Agent Orchestration

The main agent uses the `spawn_sub_agent` tool (registered via `.agents/plugins/sub-agent.plugin.js`) to delegate work.

Available sub-agent roles:
- `plan` — architecture and task breakdown
- `code` — writes code following project conventions
- `review` — code review for correctness, security, style (applies loki-mode quality gates)
- `research` — search codebase and docs
- `debug` — systematic root cause analysis
- `test` — writes tests following existing patterns
- `loki` — autonomous SDLC via loki-mode (spec-to-code, 41 agents, 11 quality gates)

Flow:
1. Main agent receives a complex request.
2. Main agent calls `spawn_sub_agent` with role, task, and context.
3. Plugin creates a new OpenCode session with a specialized system prompt.
4. Sub-agent runs the task and returns output.
5. Main agent synthesizes results and responds to the user.

## AOU (Agent-Oriented User Interface)

`src/aou/server.ts` serves a web-based chat UI:

- HTTP server (Bun) on configurable port (default 3000).
- WebSocket transport (`/ws` path) for real-time communication.
- Simple dark-themed chat HTML/CSS/JS at `src/aou/public/`.
- Messages flow through `AssistantCore.ask()` like any other channel.
- No whitelist required (designed for local/LAN use or behind auth proxy).

Config:
- `ENABLE_AOU=true` (default)
- `AOU_PORT=3000`
- `AOU_HOSTNAME=0.0.0.0`

## Channels

Telegram: `src/channels/telegram.ts`
- `grammy`
- `/pair`, `/new`, `/remember`
- typing indicator

WhatsApp: `src/channels/whatsapp.ts`
- `@whiskeysockets/baileys`
- `/pair`, `/new`, `/remember`
- QR login + reconnect

Both enforce whitelist and chunk long replies.

## Memory

Single file: `.data/workspace/MEMORY.md`

- Always injected into the system prompt.
- Assistant must call `save_memory` for durable facts.
- `/remember` command still appends directly.

No search, no embeddings, no extra memory files.

## Heartbeat (Cron Tasks)

Files: `.data/heartbeat.md`, `src/scheduler/heartbeat.ts`

- One task per line (comments start with `#`).
- Runs in its own session.
- Uses the same system prompt + memory.
- Adds a short recent main-session context snippet.
- Writes summary back into main session.
- Then asks the agent whether to notify the user.

## Proactive Messaging

Tool: `send_channel_message` (plugin)

Flow:
1. Agent decides to notify.
2. Tool writes to `.data/outbox/`.
3. Channel adapters flush outbox and send.

Destination:
- Last used channel/user, stored in `.data/last-channel.json`.

## Tools (Plugins)

Configured in `opencode.json`:

- `install_skill` — installs GitHub tree URL skill into `.agents/skills/`
- `save_memory` — append to memory file
- `send_channel_message` — queue proactive message
- `spawn_sub_agent` — delegate task to specialized sub-agent session

## Security / Pairing

Whitelist: `.data/whitelist.json`
- `/pair <token>` if `WHITELIST_PAIR_TOKEN` is set
- Otherwise manual edit by admin
- AOU UI does not use whitelist (intended for local/trusted network)

## Persistent Data

- `.data/workspace/MEMORY.md`
- `.data/sessions.json`
- `.data/whitelist.json`
- `.data/last-channel.json`
- `.data/outbox/`
- `.data/whatsapp-auth/`
- `.data/heartbeat.md`

## Commands

User:
- `/new`
- `/remember <text>`
- `/pair <token>`

Developer:
- `bun run dev`
- `bun run start`
- `bun run typecheck`
- `bun run test:opencode:e2e`

## Tradeoffs

- Message polling is a fallback (not streaming).
- Memory is append-only.
- Whitelist is file-based.
- Heartbeat is checklist-style, not a workflow engine.
- Sub-agents use separate OpenCode sessions (not lightweight threads).
- AOU is unauthenticated (wrap behind reverse proxy for production).

## Extension Points

- Add channels under `src/channels/`.
- Add tools via `.agents/plugins/*.plugin.js` and register in `opencode.json`.
- Add skills under `.agents/skills/`.
- Add sub-agent roles in `SubAgentRole` type and `ROLE_PROMPTS` map.
