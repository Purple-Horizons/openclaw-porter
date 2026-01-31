# OpenClaw Porter

Export and import OpenClaw/Clawdbot AI agents with full context.

[![Tests](https://github.com/Purple-Horizons/openclaw-porter/actions/workflows/test.yml/badge.svg)](https://github.com/Purple-Horizons/openclaw-porter/actions)

## The Problem

Setting up an AI agent isn't just copying files. An agent's "soul" lives across multiple interconnected files:
- Identity files (SOUL.md, IDENTITY.md, USER.md)
- Tool configs (TOOLS.md, mcporter.json)
- Skills and their assets
- Memory seeds and context

Currently, sharing an agent means manually zipping files and hoping the recipient figures out the structure. There's no standard format, no validation, no versioning.

## The Solution

```bash
# Initialize manifest in your agent workspace
openclaw-porter init

# Export to a portable package
openclaw-porter export

# Import someone else's agent
openclaw-porter import github:user/openclaw-agent-aria@v1.0.0
```

## Installation

**npm package coming soon:**

```bash
npm install -g @purple-horizons/openclaw-porter
```

**Until then, install from source:**

```bash
git clone https://github.com/Purple-Horizons/openclaw-porter
cd openclaw-porter
npm install
npm run build
npm link  # Makes 'openclaw-porter' available globally
```

## Quick Start

### Export Your Agent

```bash
cd ~/my-agent-workspace
openclaw-porter init
openclaw-porter validate
openclaw-porter export
```

This creates a `dist/agent-name-1.0.0.tar.gz` ready to share.

### Import an Agent

```bash
openclaw-porter import ./agent.tar.gz

# Or from GitHub (coming soon)
openclaw-porter import github:user/openclaw-agent-name
```

## Manifest Format

Create a `porter.yaml` in your agent workspace:

```yaml
name: my-agent
version: 1.0.0
description: A helpful AI assistant
author: yourname

engine:
  clawdbot: ">=1.0.0"

context:
  soul: SOUL.md
  identity: IDENTITY.md
  tools: TOOLS.md

skills:
  bundled:
    - path: skills/my-skill
  external:
    - name: fal-ai
    - name: firecrawl

env:
  required:
    - OPENAI_API_KEY
  optional:
    - ELEVENLABS_API_KEY

assets:
  - avatars/

tags:
  - assistant
  - productivity
```

## Commands

### `openclaw-porter init [path]`

Initialize a `porter.yaml` manifest by scanning your workspace.

```bash
openclaw-porter init
openclaw-porter init ./my-agent --name my-agent --description "My AI assistant"
```

### `openclaw-porter validate [path]`

Validate your manifest and check for issues.

```bash
openclaw-porter validate
```

Checks:
- ✅ Required fields present
- ✅ Context files exist
- ✅ No secrets detected
- ✅ Valid paths (no traversal attacks)

### `openclaw-porter export [path]`

Package your agent for distribution.

```bash
openclaw-porter export
openclaw-porter export --output ./releases
openclaw-porter export --dry-run  # Preview without creating archive
```

### `openclaw-porter import <source>`

Import an agent from a package.

```bash
openclaw-porter import ./agent.tar.gz
openclaw-porter import ./extracted-agent-dir
openclaw-porter import --target ./my-agents
```

## Security

OpenClaw Porter is designed with security in mind:

- **Never exports secrets** — Only env var names, never values
- **Pre-export scanning** — Detects potential API keys/tokens
- **USER.md excluded** — User-specific info stays private
- **Path validation** — Prevents directory traversal attacks

## Naming Convention

For GitHub distribution, use:
```
openclaw-agent-<name>
```

Example: `openclaw-agent-aria`, `openclaw-agent-research-assistant`

## Roadmap

- [x] Core export/import
- [x] Manifest validation
- [x] Secret detection
- [x] USER.md.template generation
- [ ] npm publish
- [ ] GitHub integration (`github:user/repo` syntax)
- [ ] Version pinning (`@v1.2.0`)
- [ ] ClawdHub integration
- [ ] Multi-agent crew exports

## Development

```bash
git clone https://github.com/Purple-Horizons/openclaw-porter
cd openclaw-porter
npm install
npm run build
npm test
```

## License

MIT © [Purple Horizons](https://purplehorizons.io)
