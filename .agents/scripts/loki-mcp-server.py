#!/usr/bin/env python3
"""Standalone MCP server exposing loki-mode CLI capabilities via fastmcp SDK."""

import os
import sys
import json
import subprocess

VENV_SITE = "/tmp/loki-mcp-venv/lib/python3.12/site-packages"
sys.path.insert(0, VENV_SITE)

from fastmcp import FastMCP

LOKI_BIN = os.path.expanduser("~/.bun/bin/loki")
os.environ["PATH"] = f"{os.path.expanduser('~/.bun/bin')}:{os.environ.get('PATH', '')}"

mcp = FastMCP("loki-mode")

@mcp.tool()
def loki_start(spec: str = "", provider: str = "claude") -> str:
    """Run loki start to build from a spec (PRD, GitHub issue, OpenAPI, etc).
    Args:
        spec: Path to spec file, GitHub issue ref (owner/repo#123), or URL
        provider: AI provider (claude, codex, gemini, cline, aider)
    """
    cmd = [LOKI_BIN, "start"]
    if spec:
        cmd.extend(["--provider", provider, spec])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return result.stdout or result.stderr

@mcp.tool()
def loki_plan(spec: str = "") -> str:
    """Run pre-execution analysis on a spec.
    Args:
        spec: Path to spec file or issue ref
    """
    cmd = [LOKI_BIN, "plan"]
    if spec:
        cmd.append(spec)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.stdout or result.stderr

@mcp.tool()
def loki_review(target: str = "--staged") -> str:
    """Run AI-powered code review.
    Args:
        target: --staged for staged changes, --diff for unstaged diff, or file path
    """
    cmd = [LOKI_BIN, "review", target]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.stdout or result.stderr

@mcp.tool()
def loki_test(target: str = "") -> str:
    """Run AI test generation.
    Args:
        target: --file <path>, --dir <path>, or --changed
    """
    cmd = [LOKI_BIN, "test"]
    if target:
        cmd.append(target)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.stdout or result.stderr

@mcp.tool()
def loki_status() -> str:
    """Show current loki-mode status."""
    result = subprocess.run([LOKI_BIN, "status"], capture_output=True, text=True, timeout=30)
    return result.stdout or result.stderr

@mcp.tool()
def loki_doctor() -> str:
    """Check environment and dependencies."""
    result = subprocess.run([LOKI_BIN, "doctor"], capture_output=True, text=True, timeout=30)
    return result.stdout or result.stderr

@mcp.tool()
def loki_quick(prompt: str) -> str:
    """Quick one-shot code generation from a brief description.
    Args:
        prompt: Brief description of what to build
    """
    cmd = [LOKI_BIN, "quick", prompt]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return result.stdout or result.stderr

@mcp.tool()
def loki_heal(path: str, phase: str = "") -> str:
    """Legacy system healing.
    Args:
        path: Path to legacy codebase
        phase: Healing phase (archaeology, stabilize, isolate, modernize, validate)
    """
    cmd = [LOKI_BIN, "heal", path]
    if phase:
        cmd.extend(["--phase", phase])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return result.stdout or result.stderr
