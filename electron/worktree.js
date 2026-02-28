import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Git worktree management.
 *
 * Each task gets its own worktree: an isolated copy of the repo on a
 * dedicated branch. This lets multiple agents work in parallel without
 * stepping on each other's files.
 *
 * Layout:
 *   .worktrees/
 *     feat-add-auth/          <- worktree for task "Add auth"
 *     fix-payment-race/       <- worktree for task "Fix payment race"
 */

const WORKTREE_DIR = '.worktrees'

/** Resolve the git repo root (works from any subdirectory). */
function repoRoot() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()
}

/**
 * Create a worktree for a task.
 * - Creates branch `task.branch` off `task.baseBranch`
 * - Returns the absolute path to the worktree directory
 *
 * If the worktree already exists (e.g. retry after failure), returns the
 * existing path without recreating it.
 */
export function createWorktree(task) {
  const root = repoRoot()
  const worktreePath = path.join(root, WORKTREE_DIR, task.branch.replace(/\//g, '-'))

  if (existsSync(worktreePath)) {
    return worktreePath
  }

  // Ensure the base branch ref exists locally
  try {
    execSync(`git rev-parse --verify ${task.baseBranch}`, {
      cwd: root,
      stdio: 'pipe',
    })
  } catch {
    // If baseBranch doesn't exist locally, try fetching it
    try {
      execSync(`git fetch origin ${task.baseBranch}`, {
        cwd: root,
        stdio: 'pipe',
      })
    } catch {
      // Fall back to HEAD if the branch can't be found
      console.warn(`Base branch "${task.baseBranch}" not found, using HEAD`)
    }
  }

  // Create the worktree with a new branch based on baseBranch
  const branchName = task.branch
  const base = task.baseBranch

  try {
    execSync(
      `git worktree add -b "${branchName}" "${worktreePath}" "${base}"`,
      { cwd: root, stdio: 'pipe' }
    )
  } catch (err) {
    // Branch might already exist (from a previous run that wasn't cleaned up)
    // Try checking out the existing branch into the worktree
    try {
      execSync(
        `git worktree add "${worktreePath}" "${branchName}"`,
        { cwd: root, stdio: 'pipe' }
      )
    } catch (err2) {
      throw new Error(
        `Failed to create worktree for branch "${branchName}": ${err2.message}`
      )
    }
  }

  return worktreePath
}

/**
 * Remove a worktree. Safe to call even if it doesn't exist.
 */
export function removeWorktree(task) {
  const root = repoRoot()
  const worktreePath = path.join(root, WORKTREE_DIR, task.branch.replace(/\//g, '-'))

  if (!existsSync(worktreePath)) return

  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: root,
      stdio: 'pipe',
    })
  } catch (err) {
    console.warn(`Failed to remove worktree at ${worktreePath}: ${err.message}`)
  }
}

/**
 * Get the worktree path for a task (without creating it).
 * Returns null if it doesn't exist.
 */
export function getWorktreePath(task) {
  const root = repoRoot()
  const worktreePath = path.join(root, WORKTREE_DIR, task.branch.replace(/\//g, '-'))
  return existsSync(worktreePath) ? worktreePath : null
}
