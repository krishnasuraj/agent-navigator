# Agent Orchestrator

## What This Is

A web-based UI for orchestrating multiple headless coding agents (Claude Code, Codex CLI, Cursor CLI) across git worktrees. The user is a manager directing agents, not a doer. The UI reflects that shift.

This is the frontend only. No backend, no real agent spawning. All data lives in-memory with realistic mock data. The backend and agent integration come later.

## Tech Stack

- React (Vite)
- Tailwind CSS
- In-memory state (useState/useReducer, no database)
- No component library — custom components only

## Core Concepts

### Task

A task is a unit of work assigned to an agent. Every task has:

- `id` — unique identifier
- `title` — short human-readable name
- `description` — natural language description of what the agent should do
- `agent` — one of: `claude-code`, `codex`, `cursor`
- `status` — one of the six statuses below
- `branch` — the git branch / worktree name the agent works on
- `baseBranch` — the branch it was forked from (e.g. `main`)
- `createdAt` — timestamp
- `updatedAt` — timestamp of last status change
- `filesChanged` — number (populated when agent finishes)
- `tokenUsage` — number (mock estimate)
- `summary` — agent-generated explanation of what it did (populated on completion)
- `error` — error message (populated on failure)

### Statuses

Six columns in the kanban, six possible states:

1. **Backlog** — defined but not started
2. **Running** — agent is actively working
3. **Needs Guidance** — agent is blocked, needs human input (permission, clarification)
4. **Review** — agent finished, awaiting human review
5. **Merged** — human approved, merged to target branch
6. **Failed** — agent errored out

## Two Views

The app has two views of the same underlying task data, toggled via a tab/segmented control in the top bar.

### 1. Board View (Kanban)

The "god view." Six columns, one per status. Cards flow left to right through the pipeline. This is where the user gets spatial awareness of all work happening across agents and branches.

- Each column has a header with the status name and a count badge
- Cards are sorted within each column by `updatedAt` (most recent at top)
- Cards show: title, agent icon/label, branch name, and a subtle time indicator
- Running cards should feel alive — a subtle animation or pulse to indicate active work
- The board should feel clean and spacious, not cramped

### 2. Action Queue (List View)

The "inbox." A flat list filtered to only tasks needing human attention right now:

- Filtered to statuses: `needs-guidance`, `review`, `failed`
- Sorted by `createdAt` ascending (FIFO — oldest at top, process like a queue)
- Each item shows: title, agent, branch, status badge, time waiting
- Items are clickable/expandable but for v1 expansion is a placeholder — just show the task description and summary/error text
- When a task is acted on (approved, retried, dismissed), it leaves this list
- A badge count of this list appears in the top nav so the user always knows how many items need attention

## Top Bar

Minimal persistent navigation:

- Left: App name / logo ("Orchestrator" or whatever feels right)
- Center or left-adjacent: View toggle (Board | Queue) — Queue shows badge count
- Right: "New Task" button, repo name display (mock: `acme/webapp`)

## Task Creation

Triggered by the "New Task" button. Opens a modal or slide-over panel with:

- Task title (text input)
- Task description (textarea)
- Agent selector (three options: Claude Code, Codex, Cursor — shown as selectable cards with icons, not a dropdown)
- Base branch (dropdown, mock options: `main`, `develop`, `feature/auth`, `feature/payments`)
- Create button

On creation, the task goes into **Backlog** status. For the mock, include a "Start Agent" action on backlog cards that moves them to **Running**.

## Mock Data

Seed the app with 8-12 tasks spread across all six statuses so the board and queue feel populated on first load. Include variety in:

- Different agents assigned
- Different branch names
- Varying ages (some created minutes ago, some hours ago)
- Tasks in review should have a mock `summary` field
- Tasks that failed should have a mock `error` field
- Tasks needing guidance should have a mock reason (e.g. "Agent requests permission to delete `legacy/auth.js`")

## Design Direction

Dark mode only. Developer tool aesthetic — think Linear meets a terminal. Precise, not playful.

- Dark background, muted surfaces, sharp accent colors for status indicators
- Monospace font for branch names, code references, timestamps
- Sans-serif for titles and descriptions
- Status colors should be distinct and meaningful (e.g. blue for running, amber for needs guidance, green for merged, red for failed)
- Cards should have subtle depth — slight border or shadow, not flat
- Running cards get a special treatment: a subtle animated border, glow, or pulse
- Generous spacing — the board should breathe
- Transitions when cards move between columns or items leave the action queue

## Interactions (v1)

Keep interactions simple for now. No drag-and-drop. Status changes happen via buttons on the cards:

- **Backlog** → click "Start" → moves to **Running**
- **Running** → automatic (mock: no user action needed, but include a "Stop" button)
- **Needs Guidance** → click "Approve" or "Dismiss" → moves back to **Running**
- **Review** → click "Approve & Merge" or "Request Changes" → moves to **Merged** or back to **Running**
- **Failed** → click "Retry" or "Dismiss" → moves to **Running** or **Backlog**
- **Merged** → terminal state, no actions

## File Structure

```
src/
  components/
    TopBar.jsx
    BoardView.jsx
    QueueView.jsx
    TaskCard.jsx        — card used in both views (adapts to context)
    TaskModal.jsx       — create new task modal
    StatusBadge.jsx     — colored badge for status
    AgentIcon.jsx       — icon/label for each agent type
  data/
    mockTasks.js        — seed data
  hooks/
    useTasks.js         — in-memory task state + actions (add, updateStatus, etc.)
  App.jsx
  main.jsx
  index.css             — tailwind imports + any global styles
```

## Implementation Status (v1 — Complete)

All components below are built and working. The app builds and runs via `npm run dev`.

### Tech Details

- **Vite 7** with `@vitejs/plugin-react`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (no `tailwind.config.js` — uses `@theme` in CSS)
- Fonts: **Inter** (sans) + **JetBrains Mono** (mono) loaded via Google Fonts in `index.html`

### Custom Theme Tokens (defined in `src/index.css` via `@theme`)

Surfaces: `surface-0` (darkest) through `surface-3`. Borders: `border`, `border-bright`. Text: `text-primary`, `text-secondary`, `text-muted`. Status colors: `status-backlog` (gray), `status-running` (blue), `status-guidance` (amber), `status-review` (purple), `status-merged` (green), `status-failed` (red). Use these token names in Tailwind classes (e.g. `bg-surface-2`, `text-status-running`).

### What's Built

- **TopBar** — sticky header with "Orchestrator" branding, Board/Queue segmented toggle (queue shows badge count), "+ New Task" button, mock repo label `acme/webapp`
- **BoardView** — 6-column kanban with horizontal scroll, count badges, cards sorted by `updatedAt` desc
- **QueueView** — filtered list (needs-guidance, review, failed), FIFO sort, click-to-expand cards showing description/summary/error/guidanceReason, empty state message
- **TaskCard** — shared between both views, adapts via `variant` prop ("board" | "queue"). Running cards have animated glow border. Action buttons per status handle all transitions
- **TaskModal** — modal overlay with title, description, 3 agent selector cards (icons: ◈ ◉ ▸), base branch dropdown, auto-generates branch slug from title
- **StatusBadge** — colored pills, running badge has animated dot
- **AgentIcon** — icon + label for claude-code (orange ◈), codex (green ◉), cursor (blue ▸)
- **useTasks hook** — `useReducer` with `ADD_TASK` and `UPDATE_STATUS` actions, exposes `tasks`, `addTask`, `updateStatus`, `queueCount`
- **mockTasks** — 10 seed tasks across all 6 statuses with varied agents, branches, timestamps, summaries, errors, and guidance reasons

### Status Transition Map (implemented in TaskCard)

```
backlog       → Start           → running
running       → Stop            → backlog
needs-guidance→ Approve         → running
needs-guidance→ Dismiss         → backlog
review        → Approve & Merge → merged
review        → Request Changes → running
failed        → Retry           → running
failed        → Dismiss         → backlog
merged        → (terminal, no actions)
```

### Running the App

```bash
npm install
npm run dev
```

## What We Are NOT Building Yet

- Backend / API server
- Real agent spawning or subprocess management
- Git worktree creation
- WebSocket connections
- Diff viewer
- Integrated terminal
- Persistent storage / database
- Drag and drop on the kanban
- Authentication
- Multi-repo support
