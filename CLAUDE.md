# Claude Code Orchestrator

## Vision

A desktop app for managing multiple Claude Code agents working in parallel across git worktrees. The key insight: **don't fight the terminal, and don't reinvent state detection**. Claude Code already writes structured JSONL session logs to disk. We watch those for state instead of parsing terminal output or running headless agents.

The architecture is: **real terminal (xterm.js + node-pty) for UX** + **JSONL session file watcher for state** + **a sidebar that surfaces what needs your attention**.

**No headless sessions.** Every agent is a real interactive terminal. The user types `claude` themselves, or we inject a command via PTY write. Claude's full interactive UI — spinners, permission prompts, colors — is always present.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process                                  │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ PTY Manager │  │ JSONL Watcher│  │ Worktree Mgr  │  │
│  │ (node-pty)  │  │ (chokidar)   │  │ (git worktree)│  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────┘  │
│         │                │                              │
│         │  IPC Bridge    │  IPC Bridge                  │
├─────────┼────────────────┼──────────────────────────────┤
│  Electron Renderer Process (React)                      │
│                                                         │
│  ┌────────────────┐  ┌──────────────────────────────┐   │
│  │ Sidebar        │  │ Terminal Panel               │   │
│  │ (session list) │  │ (xterm.js per session)       │   │
│  └────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Shell | Electron (electron-vite 5, Vite 7) | `electron.vite.config.js` (dot-separated) |
| Frontend | React 19 + Tailwind CSS v4 | `@theme` in CSS, no config file |
| Terminal | xterm.js + @xterm/addon-fit + @xterm/addon-serialize + @xterm/addon-web-links | Renderer process |
| PTY | node-pty | Main process, needs `electron-rebuild` |
| File watching | chokidar | For JSONL session files |
| IPC | contextBridge + ipcRenderer/ipcMain | Standard Electron pattern |
| State | In-memory in main process | No database |
| Fonts | Inter (UI) + JetBrains Mono (terminal) | Google Fonts in index.html |

No component library — custom components only.

---

## State Detection: JSONL Session Files

### File Location

JSONL files are at:
```
~/.claude/projects/<encoded-path>/<session-uuid>.jsonl
```

**Critical:** Files are directly in the project dir — **NOT in a `sessions/` subdirectory**.

The encoded path replaces both `/` and `_` with `-`. Regex: `/[/_]/g`.
```
/Users/me/my_project → -Users-me-my-project
```

### State Derivation

State is derived from the **last meaningful JSONL event** (skipping noise: `file-history-snapshot`, `progress`, `queue-operation`) + time since last write:

| Signal | Derived State |
|--------|---------------|
| Last event has `tool_use`, file still changing | **Working** |
| Last event has `tool_use`, file quiet 5s+ | **Needs Input** (permission prompt) |
| Last event is assistant text, file quiet 5s+ | **Idle** |
| Last event is `tool_result` or user prompt | **Working** |
| `result` event in JSONL | **Done** |
| Shell prompt returns in PTY | **Done** (Ctrl+C fallback) |

Only `user`, `assistant`, `system`, `result` are meaningful types. Walk backward from the end to find the last meaningful event.

### Hybrid PTY + JSONL Detection

JSONL alone can't detect everything. The PTY Manager also scans terminal output:

- **Thinking spinners:** `/\*\s+[A-Z][a-z]+[.…]/` — matches all Claude thinking formats (`* Orbiting…`). Overrides idle to "Working."
- **Permission prompts:** `Allow\s+Deny`, `❯\s*(Allow|Yes)`, etc. Sets "Needs Input" immediately without waiting for stale timer.
- **Shell prompt return:** `/(?:^|\n)\s*(?:.*[$%❯>#])\s*$/` — detects Claude exiting to shell. Triggers session end (handles Ctrl+C which doesn't write a `result` event).

Rolling 4KB output buffer, ANSI-stripped before matching. Debounce: 3s thinking, 2s permissions, 3s shell return.

### Session File Tracking

Snapshot-based with `Map<filePath, fileSize>`:

1. Before shell spawn, snapshot all `.jsonl` files across all project dirs with sizes
2. **Never lock on `add` events** — Claude creates throwaway files on startup that aren't the real session file
3. **Lock on `change` events** — when a file grows past its snapshot size, that's the real session (new or resumed)
4. Session ends: `result` event OR shell prompt return → unlock, re-snapshot
5. Only two signals end a session: `result` event or shell prompt return. Do NOT use a timeout/stale timer to end sessions — the user might just be reading a long response.

### JSONL Event Schema

```typescript
interface SessionEvent {
  type: 'user' | 'assistant' | 'system' | 'result';
  message: {
    role: 'user' | 'assistant' | 'system';
    content: ContentBlock[] | string;
    usage?: { input_tokens: number; output_tokens: number; ... };
  };
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  timestamp: string;  // ISO-8601
  gitBranch?: string;
  cwd?: string;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; content: any }
  | { type: 'thinking'; thinking: string }
```

Tool names: `Read`, `Write`, `Bash`, `Task`, `WebSearch`.

---

## IPC Protocol

**Main → Renderer:**
| Channel | Payload |
|---------|---------|
| `pty:data` | `(sessionId, data)` — raw PTY output |
| `pty:exit` | `(sessionId, { exitCode, signal })` |
| `jsonl:state` | `(sessionId, { state, summary })` — derived state |
| `jsonl:event` | `(sessionId, { timestamp, icon, label, detail })` — log entry |
| `jsonl:session-started` | `(sessionId)` — Claude session detected |
| `jsonl:session-ended` | `(sessionId)` — Claude session ended |

**Renderer → Main (fire-and-forget):**
| Channel | Payload |
|---------|---------|
| `pty:write` | `(sessionId, data)` — keyboard input |
| `pty:resize` | `(sessionId, cols, rows)` |

**Renderer → Main (invoke):**
| Channel | Payload |
|---------|---------|
| `session:spawn` | `(sessionId, { cwd? })` |

---

## File Structure

```
electron/
  main.js               — Electron entry, window creation, IPC wiring, env scrubbing
  preload.js            — contextBridge exposing electronAPI
  ptyManager.js         — PTY lifecycle + output scanning (thinking, permissions, shell return)
  jsonlWatcher.js       — Global JSONL watching, state derivation, session lifecycle
src/
  components/
    TerminalPanel.jsx   — xterm.js terminal with FitAddon + WebLinksAddon
    StateLog.jsx        — Sidebar: state badge + scrolling event log
    ResizableSplit.jsx  — Draggable split layout
  App.jsx               — Auto-spawns shell, tracks claudeActive state
  main.jsx
  index.css             — Tailwind imports + theme tokens + xterm styles
```

---

## Build & Run

```bash
npm install
npm run rebuild       # electron-rebuild for node-pty
npm run dev           # electron-vite dev — hot reload for renderer only
npm run build         # production build to out/
```

**node-pty rebuild on macOS** — if CLT headers not found:
```bash
CXXFLAGS="-I$(xcrun --show-sdk-path)/usr/include/c++/v1 -isysroot $(xcrun --show-sdk-path)" npx electron-rebuild -f -w node-pty
```

**Main process changes** (`electron/`) require restarting `npm run dev`. Renderer changes (`src/`) hot-reload.

### Theme Tokens (`src/index.css` via `@theme`)

Surfaces: `surface-0` (darkest) through `surface-3`. Borders: `border`, `border-bright`. Text: `text-primary`, `text-secondary`, `text-muted`. Status: `status-idle` (gray), `status-running` (blue), `status-guidance` (amber), `status-merged` (green).

---

## Design Direction

Dark mode only. Developer tool aesthetic — Linear meets a terminal. Precise, not playful.

- Dark background (`surface-0`: #0a0a0f), muted surfaces, sharp accent colors for status
- Monospace font for branch names, code references, timestamps, terminal content
- Sans-serif for titles and labels

---

## Staged Build Plan

### Stage 1: Single Terminal + JSONL PoC ✅ Complete

Single window: sidebar (30%) + terminal (70%). Auto-spawns a login shell. User starts Claude themselves. JSONL watcher watches `~/.claude/projects/` globally, picks up any session regardless of directory. Sidebar shows state badge + event log, clears when Claude exits, re-activates on new or resumed session.

**What we validated:**
- chokidar reliably fires on macOS (FSEvents), sub-100ms latency
- State transitions appear within 1-2 seconds
- Working / idle / needs-input are distinguishable
- Terminal works perfectly — full interactive Claude UI
- Session lifecycle (start → exit → resume) works end-to-end

---

### Stage 2: Multi-Session Support

**Goal:** Run multiple Claude Code sessions simultaneously, each in its own PTY + JSONL watcher. Switch between them in the UI.

**What to build:**

- **Session list in sidebar.** Replace the single state badge with a list of sessions. Each entry: session name/cwd, state badge, last event summary. Click to switch which terminal is shown.
- **Multiple PTYs in main process.** ptyManager already supports multiple sessions via its `sessions` Map. The main process just needs to support spawning more than one.
- **Multiple JSONL watchers.** Each session gets its own watcher instance. Already supported.
- **Background PTY buffering.** When a session isn't the active tab, its PTY output still flows. Use xterm.js `SerializeAddon` to serialize terminal state when switching away, restore when switching back. This keeps full scroll history per session.
- **"New Session" button.** Spawns a new login shell PTY + JSONL watcher pair. No worktree yet (that's Stage 3) — just a new shell in the same or a chosen directory.
- **Session naming.** Name sessions by their cwd basename, or let the user name them.

**Session lifecycle:**
```
User clicks "New Session" →
  Main: spawn PTY (login shell), start JSONL watcher →
  Renderer: add entry to session list, switch to it

User clicks different session in list →
  Renderer: SerializeAddon.serialize() current xterm, store buffer
  Renderer: hide current terminal, show/restore new one

Claude exits (shell return or result event) →
  JSONL watcher unlocks, sends session-ended →
  Renderer: update session badge to "Done", keep entry in list
```

**What to validate:**
- 3-5 simultaneous PTYs — no perf issues?
- Switching feels instant, no flicker, scroll history preserved?
- Independent JSONL watchers don't interfere?

---

### Stage 3: Worktree Integration + Session Spawning

**Goal:** Proper git worktree lifecycle. Spawn a new agent on a branch with one click.

**What to build:**

- **"New Agent" flow.** User provides a branch name. App runs `git worktree add .worktrees/<name> -b <branch>` in the project root, spawns a PTY shell in that directory. Optionally auto-types an initial prompt via PTY write.
- **Worktree-aware session list.** Show branch name alongside session state. Replace simple session names with branch + state + elapsed time.
- **Cleanup.** When a session is done, offer to run `git worktree remove`. Handle dirty worktrees gracefully.
- **Initial prompt injection.** Optionally write a starting prompt to the PTY after Claude launches. E.g. "Implement X based on issue #123. Open a PR when done."

**Known gotcha:** Vite watches `.worktrees/`. When Claude edits files in a worktree, Vite triggers a page reload destroying renderer state. Already fixed: `electron.vite.config.js` ignores `.worktrees/**`.

**Open question:** When Claude runs inside a worktree (`.worktrees/feat-auth/`), does the JSONL path use the worktree path or the main repo path? Needs testing before Stage 3.

---

### Stage 4: Orchestration Layer

**Goal:** The app actively helps manage agents, not just display them.

**What to build:**

- **Attention zones.** Group sessions by what needs human attention: "Needs Input" (top), "Working" (middle), "Done" (bottom).
- **Desktop notifications.** Fire when a session transitions to "Needs Input" or "Error."
- **Cross-session file conflict detection.** Watch `git status` across worktrees, surface a warning if two agents are editing the same file.
- **CI integration (stretch).** Poll GitHub Actions for each branch. Show CI status alongside session state. Route CI failure logs back to the agent via PTY write.

---

### Stage 5: Polish + Advanced Features

- **Search.** Full-text search across JSONL transcripts.
- **Cost tracking.** JSONL includes token usage per turn — sum and display per-session cost.
- **Session replay.** Load a completed JSONL and replay the event timeline.
- **Claude Code hooks.** Register PreToolUse/PostToolUse/Stop hooks that write to a named pipe. Gives sub-second tool-level events before JSONL is written.
- **MCP `requestGuidance` server.** Small MCP server exposing a `requestGuidance(question)` tool. When Claude calls it, show the question in the UI with a text input. User's answer is returned as the tool result. Cleanly solves the guidance/input problem.

---

## Critical Gotchas

### Claude nesting detection
The `claude` binary hangs silently when spawned inside another Claude session. Env vars: `CLAUDECODE`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_CODE_ENTRYPOINT`. Fix: `main.js` scrubs all `CLAUDE*` env vars at startup. `ptyManager.js` uses `getCleanEnv()`.

### JSONL path encoding
Both `/` AND `_` replaced with `-`. Regex: `/[/_]/g`. Getting this wrong = watching the wrong directory and never finding sessions.

### JSONL files not in sessions/ subdirectory
Despite what you might expect, files are directly in `~/.claude/projects/<encoded-path>/`, not `sessions/`.

### Never lock on chokidar `add` events
Claude creates throwaway `.jsonl` files on startup that aren't the real session. Lock only on `change` events when the file grows past its snapshot size.

### Ctrl+C exit doesn't write a result event
Must detect shell prompt return via PTY output scanning. `notifyShellReturn()` in jsonlWatcher handles this.

### Resumed sessions write to existing files
`claude --resume <id>` writes to the existing JSONL file. Snapshot stores sizes so `change` events on existing files can be detected as resumes (read from byte 0 to load full history).

### Never use a stale timer to end sessions
A long response or extended thinking means no JSONL writes for a long time. Don't interpret silence as "Claude exited." Only shell prompt return or `result` event ends a session.

### Vite watches worktree files
Ignore `.worktrees/**` in `electron.vite.config.js` `server.watch.ignored`.

### Electron main process doesn't inherit shell env
`findClaudeBinary()` checks `~/.local/bin/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`, then `which claude`.

### node-pty rebuild on macOS
If `fatal error: 'functional' file not found`:
```bash
CXXFLAGS="-I$(xcrun --show-sdk-path)/usr/include/c++/v1 -isysroot $(xcrun --show-sdk-path)" npx electron-rebuild -f -w node-pty
```

---

## Stage 1 Implementation Log

### What We Built

Single window: login shell spawned automatically, user types `claude`. JSONL watcher watches `~/.claude/projects/` globally (not tied to a specific project dir). Sidebar shows state badge + event log, wipes on exit, re-activates on new or resumed session.

### Key Implementation Decisions

1. **Watch globally, not per-project.** Initial impl watched the app's own project dir. When user `cd`'d to a different project, sessions were missed. Fix: watch all of `~/.claude/projects/` with `depth: 1`.

2. **Lock on `change`, not `add`.** First impl locked on `add` (new file detected). Claude creates a throwaway file on startup before writing the real session file — we'd lock onto the wrong file and miss all events. Fix: record new files on `add` with size 0, lock only when a file starts actively growing via `change`.

3. **Snapshot as `Map<path, size>`, not `Set<path>`.** Needed to detect resumed sessions (existing file growing) vs new sessions. Size comparison is the signal.

4. **Shell prompt return detection for Ctrl+C.** `result` event isn't written on Ctrl+C. Added PTY output scanning: when shell prompt appears after Claude was running, immediately end the session.

5. **Clear buffer on Claude start.** When re-detecting Claude after exit, clear the output buffer so stale shell prompts don't immediately trigger a false shell-return detection.

6. **Meaningful event types only.** Events like `file-history-snapshot`, `progress`, `queue-operation` are noise. `deriveState()` walks backward to find the last `user`/`assistant`/`system`/`result` event.

7. **Thinking spinner detection.** Single regex `/\*\s+[A-Z][a-z]+[.…]/` matches all Claude thinking formats. Enumerating individual words doesn't work (too many, new ones added). Tracking all PTY activity doesn't work (cursor blink = false positive).

8. **Separate `ptySessionId` from `claudeActive`.** Terminal (`ptySessionId`) persists across session boundaries. Sidebar tracking (`claudeActive`) only active when JSONL watcher has locked onto a session.

### Bugs Encountered

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Status always "Idle" | Noise events (`file-history-snapshot` etc.) were the "last event" | Walk backward to find last meaningful event |
| Watcher watching wrong dir | Watched app's own project dir, not the user's current project | Watch all of `~/.claude/projects/` globally |
| Locked onto wrong file on resume | `add` event fired for throwaway file before real session file | Lock only on `change` |
| Sidebar not clearing on Ctrl+C | No `result` event written | Shell prompt return detection in ptyManager |
| Sidebar clearing while reading | Stale timer (30s) ending sessions | Remove timeout-based session end entirely |
| Resume not loading history | Watcher only looked for new files | Detect existing file growing past snapshot size |
| False shell-return on resume | Stale shell prompt in buffer triggered detection immediately after resume | Clear buffer when Claude start detected |
| Terminal blank after spawn screen removed | `setPtySessionId()` call removed accidentally | Separate `ptySessionId` (always set) from `claudeActive` |
