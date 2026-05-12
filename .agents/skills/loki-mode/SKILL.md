name: loki-mode
description: Multi-agent autonomous SDLC framework. Spec to deployed app. Invoke when the task involves building a full app from a PRD, generating production code, running quality gates, or orchestrating multi-agent code generation.

# Loki Mode Integration Skill

This skill integrates loki-mode (v7.5.17) — an autonomous multi-agent SDLC framework — into OpenCode/OpenClaw.

## Overview

Loki Mode transforms specs (PRD, GitHub issue, OpenAPI/JSON/YAML, one-line brief) into production-ready code via RARV cycles (Reason-Act-Reflect-Verify) with 41 agent types across 8 swarms and 11 quality gates.

## Available Commands

| Command | Description |
|---------|-------------|
| `loki start ./prd.md` | Build from a Markdown PRD |
| `loki start owner/repo#123` | Build from a GitHub issue |
| `loki start ./openapi.yaml` | Build from an OpenAPI spec |
| `loki quick "build a landing page"` | Quick one-shot generation |
| `loki plan ./prd.md` | Pre-execution analysis |
| `loki review --staged` | AI code review |
| `loki test --dir src/` | AI test generation |
| `loki doctor` | Environment check |
| `loki heal <path>` | Legacy system healing |
| `loki web` | Launch Purple Lab web UI |
| `loki dashboard` | Open web dashboard |
| `loki status` | Show current status |
| `loki memory <cmd>` | Memory operations |

## Multi-Provider Support

Loki supports Claude Code (full), Codex CLI, Gemini CLI, Cline, Aider. Provider selection:
```bash
loki start --provider claude ./prd.md
loki start --provider codex ./prd.md
LOKI_PROVIDER=gemini loki start ./prd.md
```

## Quality Gates (11 Gates)

1. Static analysis (CodeQL, ESLint)
2. 3-reviewer parallel blind review
3. Anti-sycophancy checks
4. Severity blocking (Critical/High/Medium = BLOCK)
5. Test coverage (>80% unit, 100% pass)
6. Backward compatibility
7. Documentation coverage
8. Security scan
9. Performance benchmarks
10. Dependency audit
11. License compliance

## Usage from OpenClaw

When asked to build an application:
1. Use `loki plan` first to analyze complexity and cost
2. Use `loki start` for autonomous generation
3. Use `loki review` on the output
4. Use `loki test` for additional test coverage

## MCP Integration

Loki's MCP server exposes 15 tools including ChromaDB code search, task queue management, and memory retrieval. It runs via the `loki-mode` MCP server configured in opencode.json.

## References

- Repo: https://github.com/asklokesh/loki-mode
- Docs: https://github.com/asklokesh/loki-mode/wiki
- Website: https://www.autonomi.dev
