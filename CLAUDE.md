# Terminal-First Claude Code Orchestrator

## What This Is

An Electron desktop app for monitoring and managing multiple interactive Claude Code sessions across git worktrees. The terminal is the primary interaction surface — users run `claude` directly in embedded terminals. The kanban board and issues list are monitoring dashboards that auto-detect agent state by observing terminal output.

## Tech Stack

- **Electron** — desktop shell (main + renderer processes)
- **React 19** (Vite via electron-vite) — renderer UI
- **Tailwind CSS v4** — styling (no `tailwind.config.js` — uses `@theme` in CSS)
- **node-pty** — native PTY spawning for shell processes (main process)
- **xterm.js** — full read-write terminal emulator (renderer)
- **IPC** (contextBridge) — communication between main and renderer
- In-memory state (main process, no database)
- No component library — custom components only

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Electron Main Process                               │
│                                                      │
│  taskStore.js ─── terminalManager.js ─── node-pty    │
│       │                │                   │         │
│       │          stateDetector.js           │ PTY per │
│       │          (ANSI strip +             │ task    │
│       │           pattern match)           │         │
│       └──── IPC (contextBridge) ───────────┘         │
│                      │                               │
├──────────────────────┤───────────────────────────────┤
│  Preload Script      │                               │
│  electronAPI bridge  │                               │
├──────────────────────┤───────────────────────────────┤
│  Renderer Process (React)                            │
│                                                      │
│  App.jsx ─── ResizableSplit                          │
│     │          ├── BoardView / QueueView (left)      │
│     │          └── TerminalPanel (right, xterm.js)   │
│     └── TaskModal                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Main process owns all task state (in-memory)
- Renderer is a thin client that receives state via IPC
- Each task = one shell PTY in an isolated git worktree
- User types `claude` in the terminal themselves — full interactive experience
- Raw PTY output streams bidirectionally: main ↔ renderer
- State detector eavesdrops on output (ANSI-stripped pattern matching) to update kanban

## Terminal-First Interaction Model

The terminal is the primary control surface. The user interacts with Claude Code exactly as they would in any terminal — typing prompts, approving permissions (y/n), answering questions, running follow-up commands. The app just provides:

1. **Isolation** — each task gets its own git worktree
2. **Monitoring** — kanban board auto-detects agent state from terminal output
3. **Multiplexing** — manage multiple concurrent Claude sessions

## Heuristic State Detection

The state detector (`stateDetector.js`) strips ANSI escape codes and pattern-matches on terminal output to classify task state. This is best-effort — the terminal always works regardless of detection accuracy.

| Pattern | Detected State |
|---------|---------------|
| Tool execution symbols + tool names | `in-progress` |
| Claude startup banner (`╭─`) | `in-progress` |
| Permission prompt ("Allow...? (y/n)") | `input-required` |
| Claude idle prompt (`❯` or `>`) | `input-required` |
| Result text ("Task complete", "Done") | `completed` |
| Shell prompt (`$`, `%`, `#`) + 4s silence | `idle` |

Known limitations: custom shell prompts may not match; Claude Code version changes could break patterns. Detection errs toward preserving current state rather than false transitions.

## Core Concepts

### Task

A task is a named terminal session in an isolated git worktree. Every task has:

- `id` — unique identifier
- `title` — short human-readable name
- `status` — one of four statuses (auto-detected from terminal output)
- `branch` — the git branch / worktree name (`feat/<slug>`)
- `baseBranch` — the branch it was forked from
- `worktreePath` — absolute path to the worktree directory
- `createdAt` / `updatedAt` — timestamps

### Statuses

Four columns in the kanban, four possible states:

1. **Idle** — shell is running but no Claude session active
2. **In Progress** — Claude Code is actively working
3. **Input Required** — Claude Code is waiting for user interaction (permission, question, or idle prompt)
4. **Completed** — Claude session finished its task

Status transitions are automatic (driven by state detector), not manual.

## Two Views + Terminal Panel

### 1. Board View (Kanban)
Four columns, one per status. Cards show title, branch, status dot, time-ago. Clicking any card opens its terminal in the right panel.

### 2. Issues View (List)
Filtered to `input-required` only. FIFO ordering. Clicking opens terminal panel.

### 3. Terminal Panel
Right side of a resizable split. Full interactive xterm.js terminal — user types directly. Minimal header with status dot, title, branch, close button.

## Layout

Resizable split: kanban/issues on left, terminal on right. Draggable divider. Default 55/45 split. Min widths enforced (380px left, 300px right).

## File Structure

```
electron/
  main.js               — Electron entry, window creation, module init
  preload.js            — contextBridge exposing electronAPI
  taskStore.js          — In-memory task state with change listeners
  terminalManager.js    — Shell PTY spawning + lifecycle management
  stateDetector.js      — ANSI strip + pattern match → status updates
  worktree.js           — Git worktree create/remove per task
  ipc.js                — IPC handler registration
src/
  components/
    TopBar.jsx          — App header, view toggle, queue badge, new task button
    BoardView.jsx       — 4-column kanban
    QueueView.jsx       — Input-required filtered list
    TaskCard.jsx        — Clickable card (no action buttons)
    TaskModal.jsx       — Create task: title + base branch
    TerminalPanel.jsx   — Full interactive xterm.js terminal
    ResizableSplit.jsx  — Draggable split layout
  hooks/
    useTasks.js         — IPC-driven task state
    useTerminal.js      — xterm.js instance + bidirectional IPC
  App.jsx
  main.jsx
  index.css             — tailwind + xterm.css imports + theme tokens
```

## Build System

- **electron-vite 5** — Vite-based build for Electron (main, preload, renderer)
- Config file: `electron.vite.config.js` (NOTE: dot-separated, not hyphen)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- Fonts: **Inter** (sans) + **JetBrains Mono** (mono) loaded via Google Fonts in `index.html`
- `node-pty` is externalized in rollup config (native module, can't bundle)
- Build output: `out/main/`, `out/preload/`, `out/renderer/`

### Running the App

```bash
npm install
npm run dev     # electron-vite dev — opens Electron window with hot reload
npm run build   # electron-vite build — production build to out/
```

### Custom Theme Tokens (defined in `src/index.css` via `@theme`)

Surfaces: `surface-0` (darkest) through `surface-3`. Borders: `border`, `border-bright`. Text: `text-primary`, `text-secondary`, `text-muted`. Status colors: `status-idle` (gray), `status-running` (blue), `status-guidance` (amber), `status-merged` (green). Use these token names in Tailwind classes (e.g. `bg-surface-2`, `text-status-running`).

## IPC Protocol

**Main → Renderer (events):**
| Channel | When |
|---------|------|
| `task:created` | New task added |
| `task:updated` | Any task field changes |
| `task:deleted` | Task removed |
| `terminal:data:<taskId>` | Raw PTY output for a specific task |

**Renderer → Main (invoke):**
| Channel | Args |
|---------|------|
| `tasks:getAll` | — |
| `tasks:create` | `{ title, baseBranch }` |
| `tasks:delete` | `taskId` |
| `terminal:start` | `taskId` |

**Renderer → Main (fire-and-forget):**
| Channel | Args |
|---------|------|
| `terminal:input` | `taskId, data` (keystrokes) |
| `terminal:resize` | `{ taskId, cols, rows }` |

## Design Direction

Dark mode only. Developer tool aesthetic — think Linear meets a terminal. Precise, not playful.

- Dark background (`surface-0`: #0a0a0f), muted surfaces, sharp accent colors for status
- Monospace font for branch names, code references, timestamps
- Sans-serif for titles and descriptions
- In-progress cards get animated border glow
- Terminal panel matches app background seamlessly
- Generous spacing — the board should breathe

## What We Are NOT Building Yet

- Git worktree cleanup on task delete
- Persistent storage / database
- Drag and drop on the kanban
- Multi-repo support
- Electron packaging / distribution
- Dynamic branch list in task creation modal
- Terminal output buffering/replay for late-connecting renderers
- Manual status override (user corrects auto-detected state)

## Migration History

### v1: Frontend Only
Pure React+Vite frontend with mock data.

### v2: WebSocket Backend
Node.js + Express server with WebSocket. Used `@anthropic-ai/claude-agent-sdk`.

### v3: Electron + Headless Agents
Electron app with `claude -p --output-format stream-json`. Structured event parsing. Read-only terminals.

### v4: Terminal-First (current)
Full interactive terminals. User runs `claude` directly. Heuristic state detection via ANSI-stripped pattern matching. Resizable split layout. No structured event parsing — the terminal is the truth.

**Key learnings from previous versions:**
- `electron-vite` 5.x supports Vite 7 (3.x only supports up to Vite 6)
- Config file must be named `electron.vite.config.js` (dot-separated)
- `node-pty` must be externalized in rollup config since it's a native module
- Preload scripts are built as `.mjs` by default — reference `preload.mjs` in BrowserWindow config
- `pointer-events: none` on panels during resize drag is essential to prevent xterm.js canvas from stealing mouse events
