# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (includes backend API via middleware)
npm run build    # Production build to /dist
npm run preview  # Preview production build

VAULTDOCK_STACKS_DIR=~/my-stacks npm run dev  # Custom stacks directory (default: ~/stacks)
```

No test runner or linter is configured.

## Architecture

Vaultdock is a retro CRT-styled Docker management dashboard. It's a React 19 SPA with **no separate backend** — all API endpoints run as Vite middleware in `vite.config.js`.

### Data flow

```
React Components → Custom Hooks (polling) → fetch(/api/*) → Vite Middleware → execSync(docker CLI) → Docker Engine
```

### Backend (`vite.config.js`)

All API logic lives in a single Vite plugin (`systemInfoPlugin`). It shells out to Docker CLI via `execSync` — there is no Docker SDK.

Key endpoints:
- `GET /api/stacks` — compose projects + containers + live CPU/mem (combines `docker compose ls`, `docker ps`, `docker stats`)
- `GET /api/container/:id/inspect` — env, mounts, networks, restart policy
- `GET /api/container/:id/logs` — timestamped logs with level detection
- `POST /api/container/:id/exec` — real `docker exec` with blocked-command safety list
- `POST /api/container/:id/action` — restart/stop/start/remove
- `GET /api/events` — docker events from last 5 minutes
- `POST /api/stack/:name/action` — compose-level up/down/restart/stop (managed stacks only)
- `GET /api/system-info`, `/api/system-stats`, `/api/docker-stats` — host metrics

Container IDs in URL params are short hex IDs (12 chars from `docker ps`).

#### Managed vs Unmanaged Stacks

- **Managed** = subdirectory in `STACKS_DIR` (`VAULTDOCK_STACKS_DIR` env var, default `~/stacks`) with a compose file → shows action buttons, appears even when not running (status `created`)
- **Unmanaged** = external compose projects detected by `docker compose ls` → read-only, no action buttons
- **Standalone** = containers not in any compose project, grouped under "standalone"
- Sorting: managed first, then unmanaged alphabetically, standalone last

### Frontend

**State orchestration** happens in `DashboardLayout.jsx` — it owns all top-level state (selected container, active tab, boot sequence, expanded stacks, confirm modals) and passes data down.

**Hooks** (in `src/hooks/`):
- `useDockerStacks(3000)` — polls `/api/stacks`, returns `{ stacks, containers, refresh }`
- `useContainerDetail(id)` — fetches inspect on container selection
- `useContainerLogs(id?, 5000)` — aggregated events (no id) or single container logs
- `useSystemStats(3000)` — CPU, memory, core counts
- `useSystemInfo()` — one-time fetch of hostname, OS, Docker version

**AI Agent** (`generateAnalysis()` in DashboardLayout) auto-diagnoses non-running containers from live data. No LLM call — it's template-based analysis from container state.

### CSS

CSS Modules (`.module.css` per component) + global variables in `src/styles/global.css`. The theme is a green-on-black CRT terminal with monospace font (Share Tech Mono). Color semantics: green=#00ff41 (ok), red=#ff3333 (error), orange=#ffaa00 (warn), muted green=#007a22 (labels/borders).

Dynamic state colors are applied via inline styles; structural styles use CSS Modules.

## Key conventions

- Functional components only, React hooks throughout (no classes)
- Zero external UI libraries — all components are custom (modals, terminal, progress bars, CRT overlay)
- Container actions require confirmation via `ConfirmModal` before hitting the API
- `ShellTerminal` sends real `docker exec` commands (not simulated)
- Blocked dangerous commands in `BLOCKED_COMMANDS` regex array (vite.config.js)
- Env vars from `docker inspect` are filtered to remove system vars (PATH, HOSTNAME, HOME, etc.)
- Boot screen plays once on load with staggered stage timers
- Stack actions require confirmation via `ConfirmModal` (same as container actions)
- Only managed non-stopped stacks auto-expand on load
- `scanManagedStacks()` returns `Map<name, composePath>`; `stackAction()` uses `execFileSync` with 60s timeout
