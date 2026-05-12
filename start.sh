#!/bin/bash
export PATH="/root/.bun/bin:/root/.opencode/bin:$PATH"
cd /root/MonClaw
exec /usr/bin/bun run src/index.ts
