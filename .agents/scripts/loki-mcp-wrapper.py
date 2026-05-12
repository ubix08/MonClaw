#!/usr/bin/env python3
"""Wrapper that runs loki-mode MCP server with correct SDK imports."""

import sys
import os

BASE = "/root/.bun/install/global/node_modules/loki-mode"
VENV_SITE = "/tmp/loki-mcp-venv/lib/python3.12/site-packages"

sys.path.insert(0, BASE)
sys.path.insert(0, VENV_SITE)
os.chdir(BASE)

from mcp.server import mcp
mcp.run()
