# Nexus MCP Integration Roadmap

## Vision

Nexus as Claude's persistent memory layer, working across all platforms (Claude Code, Desktop, Web, Mobile). Claude autonomously reads from and writes to nexus to maintain evolving understanding of the user — emotional state, priorities, goals, work patterns, and more.

Nexus is not a user-facing tool. It's infrastructure for Claude's memory. The user rarely interacts with it directly — Claude decides when and how to use it based on conversation context.

## MCP Tool Surface

| Tool | Purpose | Parameters |
|------|---------|------------|
| `init` | Create nexus from a prompt (one-time, guarded) | `prompt`, `model?` |
| `learn` | Feed an observation into nexus | `content`, `scope?` |
| `ask` | Query nexus understanding | `query`, `scope?` |
| `status` | Inspect current state — dimensions, richness | — |

- `scope` is optional on `learn` and `ask` for targeting specific dimensions/learners
- `status` returns available scopes so Claude knows what's targetable
- `init` is guarded: rejects if nexus is already initialized

## Architecture

```
Claude (any platform)
  │
  │  MCP (Streamable HTTP)
  │
  ▼
Nexus Server (Hono)
  ├── /mcp          ← MCP Streamable HTTP transport
  ├── /brain/*      ← existing REST API (for web UI)
  ├── /ui/*         ← existing monitoring UI
  └── /data/nexus.json  ← persisted state
```

Single Hono server. MCP transport mounted alongside existing REST API. Both talk to the same Brain instance.

## Persistence

Minimal state to persist per nexus instance:

- **understanding** (string per learner) — the accumulated knowledge
- **evolution** (array per learner) — audit trail of how understanding changed
- **governance** (object per learner) — activation score, health metrics
- **prompt** — the original nexus prompt
- **buffer** (optional) — pending observations not yet synthesized

Everything else (model config, system prompts, identities) is re-provided on startup or reconstructed via init.

Format: single JSON file. Read on startup, write after mutations.

## Phases

### Phase 1: Local MCP Server (current focus)

**Goal:** Nexus works as an MCP server on localhost, connectable from Claude Code and Claude Desktop.

- [ ] Add `@modelcontextprotocol/sdk` dependency
- [ ] Mount `StreamableHTTPServerTransport` on `/mcp` in the existing Hono server
- [ ] Implement 4 MCP tools: `init`, `learn`, `ask`, `status`
  - `learn` wraps `brain.inject()`
  - `ask` wraps `brain.ask()`
  - `status` wraps the existing status endpoint
  - `init` creates and initializes a Brain (guarded against re-init)
- [ ] Connect from Claude Desktop (remote server → `http://localhost:3210/mcp`)
- [ ] Connect from Claude Code (MCP server config → `http://localhost:3210/mcp`)
- [ ] No auth (localhost only, not exposed to internet)

### Phase 2: Persistence

**Goal:** Nexus state survives server restarts.

- [ ] Define `PersistedNexus` schema (brain prompt + per-learner state)
- [ ] Implement `save()` — serialize to `/data/nexus.json`
- [ ] Implement `load()` — reconstruct Brain + learners from JSON on startup
- [ ] Hook save into event system (after `learner:synthesized`, `learner:understanding:updated`)
- [ ] Add `restore` flag to `init` tool — if persisted state exists, restore instead of re-creating
- [ ] Brain class may need a `restore(state)` method or a factory function

### Phase 3: Cloud Deployment

**Goal:** Nexus reachable from Claude Web and Mobile. Per-person instances.

- [ ] Dockerize the server
- [ ] Cloud Run setup with `min-instances=1` (no cold starts)
- [ ] GCS bucket for state persistence (replace local JSON file)
  - Load from GCS on startup
  - Save to GCS on mutations
- [ ] OAuth client credentials flow
  - `/token` endpoint validates static client_id + client_secret (set as Cloud Run env vars)
  - Returns bearer token for subsequent MCP requests
- [ ] Auto-HTTPS via Cloud Run `.run.app` domain

### Phase 4: Team Rollout

**Goal:** Each team member has their own nexus.

- [ ] Per-person Cloud Run services (same container image, different service names)
- [ ] Deployment script/automation (`deploy.sh <user-name>`)
- [ ] Each service has its own GCS state file and OAuth credentials
- [ ] SKILL.md / system prompt instructions defining when and how Claude should use nexus
  - Observation behavior (selective vs liberal, what's worth learning)
  - Query behavior (when to check nexus, how to use context)
- [ ] Optional: upgrade to Google Workspace OAuth for smoother team onboarding

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Streamable HTTP | Works across all Claude clients. SSE being deprecated. |
| Auth (local) | None | Localhost only, no exposure. |
| Auth (deployed) | OAuth client credentials | Simplest real auth. Claude's connector supports it. |
| Persistence | JSON file | State is small, JSON-shaped, single writer. No DB needed. |
| Multi-tenancy | Per-person instances | Avoids multi-tenant code. Isolation by default. |
| Deployment | Cloud Run + GCS | Managed, no VM ops, credits available. |
| Naming | `learn`/`ask` | Clean, matches nexus metaphor. |
