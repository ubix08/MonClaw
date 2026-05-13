/**
 * opencode.ts — Typed wrappers for the OpenCode SDK
 *
 * The SDK's generated types are complex (generic options, response unwrapping).
 * This module provides simple typed boundaries for the subset of API calls
 * that MonClaw uses. All SDK casting is contained here.
 *
 * If the SDK contract changes, fix types in ONE file.
 */

import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk"
import type { OpencodeClient as SDKClient } from "@opencode-ai/sdk"

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type OpencodeClient = SDKClient
export { createOpencode, createOpencodeClient }

// ─── Unwrap helper ───────────────────────────────────────────────────────────

export function unwrap<T>(value: unknown): T {
  if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
    return (value as { data: T }).data
  }
  return value as T
}

// ─── Session API ──────────────────────────────────────────────────────────────

export type SessionInfo = { id: string; title?: string }

export async function apiSessionCreate(
  client: OpencodeClient,
  opts: { body: { title: string; parentID?: string } },
): Promise<SessionInfo> {
  const response = await client.session.create({
    body: opts.body,
  } as never)
  return unwrap(response)
}

export type MessageInfo = { id?: string; role?: string }
export type MessagePart = { type?: string; text?: string }
export type SessionMessage = { info: MessageInfo; parts: MessagePart[] }

export async function apiSessionMessages(
  client: OpencodeClient,
  opts: { path: { id: string } },
): Promise<SessionMessage[]> {
  const response = await client.session.messages({
    path: opts.path,
  } as never)
  return unwrap(response)
}

export type PromptBody = {
  system?: string
  parts: Array<{ type: "text"; text: string }>
  noReply?: boolean
  model?: { providerID: string; modelID: string }
}

export type PromptResponse = {
  info: MessageInfo
  parts: MessagePart[]
}

export async function apiSessionPrompt(
  client: OpencodeClient,
  opts: { path: { id: string }; body: PromptBody },
): Promise<PromptResponse> {
  const response = await client.session.prompt({
    path: opts.path,
    body: opts.body,
  } as never)
  return unwrap(response)
}

/**
 * Inject a no-reply message into a session (no model turn consumed).
 */
export async function apiSessionInject(
  client: OpencodeClient,
  opts: { path: { id: string }; text: string },
): Promise<void> {
  await client.session.prompt({
    path: opts.path,
    body: {
      noReply: true,
      parts: [{ type: "text" as const, text: opts.text }],
    },
  } as never)
}

// ─── Provider API ─────────────────────────────────────────────────────────────

export type ProviderListResult = {
  connected?: string[]
  default?: unknown
}

export async function apiProviderList(client: OpencodeClient): Promise<ProviderListResult> {
  const response = await client.provider.list({} as never)
  return unwrap(response)
}

// ─── Config API ───────────────────────────────────────────────────────────────

export type ConfigGetResult = {
  model?: string
  [key: string]: unknown
}

export async function apiConfigGet(client: OpencodeClient): Promise<ConfigGetResult> {
  const response = await client.config.get({} as never)
  return unwrap(response)
}

// ─── Session tree & todo API (SDK-native task management) ────────────────────

export type Todo = {
  content: string
  status: string
  priority: string
  id: string
}

export type SessionDetail = {
  id: string
  title: string
  parentID?: string
  summary?: {
    additions: number
    deletions: number
    files: number
  }
}

export async function apiSessionFork(
  client: OpencodeClient,
  opts: { path: { id: string }; body?: { messageID?: string } },
): Promise<SessionDetail> {
  const response = await client.session.fork({
    path: opts.path,
    body: opts.body,
  } as never)
  return unwrap(response)
}

export async function apiSessionChildren(
  client: OpencodeClient,
  opts: { path: { id: string } },
): Promise<SessionDetail[]> {
  const response = await client.session.children({
    path: opts.path,
  } as never)
  return unwrap(response)
}

export async function apiSessionTodo(
  client: OpencodeClient,
  opts: { path: { id: string } },
): Promise<Todo[]> {
  const response = await client.session.todo({
    path: opts.path,
  } as never)
  return unwrap(response)
}

export async function apiSessionUpdate(
  client: OpencodeClient,
  opts: { path: { id: string }; body?: { title?: string } },
): Promise<SessionDetail> {
  const response = await client.session.update({
    path: opts.path,
    body: opts.body,
  } as never)
  return unwrap(response)
}

// ─── Project API ──────────────────────────────────────────────────────────────

export type ProjectInfo = {
  id: string
  worktree: string
}

export async function apiProjectCurrent(
  client: OpencodeClient,
): Promise<ProjectInfo> {
  const response = await client.project.current({} as never)
  return unwrap(response)
}

export async function apiProjectList(
  client: OpencodeClient,
): Promise<ProjectInfo[]> {
  const response = await client.project.list({} as never)
  return unwrap(response)
}

// ─── Session status API ───────────────────────────────────────────────────────

export async function apiSessionStatus(
  client: OpencodeClient,
): Promise<Record<string, unknown>> {
  const response = await client.session.status({} as never)
  return unwrap(response)
}
