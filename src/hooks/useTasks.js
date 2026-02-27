import { useReducer, useMemo, useCallback } from 'react'
import { mockTasks } from '../data/mockTasks'

function taskReducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK':
      return [...state, action.payload]
    case 'UPDATE_STATUS': {
      return state.map((task) =>
        task.id === action.payload.id
          ? { ...task, status: action.payload.status, updatedAt: Date.now() }
          : task
      )
    }
    default:
      return state
  }
}

let nextId = 11

export function useTasks() {
  const [tasks, dispatch] = useReducer(taskReducer, mockTasks)

  const addTask = useCallback(({ title, description, agent, baseBranch }) => {
    const id = String(nextId++)
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    const branch = `feat/${slug}`

    dispatch({
      type: 'ADD_TASK',
      payload: {
        id,
        title,
        description,
        agent,
        status: 'backlog',
        branch,
        baseBranch,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        filesChanged: 0,
        tokenUsage: 0,
        summary: null,
        error: null,
      },
    })
  }, [])

  const updateStatus = useCallback((id, status) => {
    dispatch({ type: 'UPDATE_STATUS', payload: { id, status } })
  }, [])

  const queueCount = useMemo(
    () =>
      tasks.filter((t) =>
        ['needs-guidance', 'review', 'failed'].includes(t.status)
      ).length,
    [tasks]
  )

  return { tasks, addTask, updateStatus, queueCount }
}
