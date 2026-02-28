import { useState, useRef, useCallback, useEffect } from 'react'

export default function ResizableSplit({
  left,
  right,
  defaultRatio = 0.55,
  minLeftPx = 380,
  minRightPx = 300,
}) {
  const [ratio, setRatio] = useState(defaultRatio)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    function onMouseMove(e) {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const totalWidth = rect.width
      const newLeftPx = e.clientX - rect.left
      const clampedLeft = Math.max(minLeftPx, Math.min(newLeftPx, totalWidth - minRightPx))
      setRatio(clampedLeft / totalWidth)
    }

    function onMouseUp() {
      setDragging(false)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, minLeftPx, minRightPx])

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      <div
        style={{ width: `${ratio * 100}%`, pointerEvents: dragging ? 'none' : 'auto' }}
        className="flex flex-col h-full min-h-0 overflow-hidden"
      >
        {left}
      </div>

      <div
        onMouseDown={onMouseDown}
        className={`w-1 shrink-0 cursor-col-resize transition-colors select-none ${
          dragging ? 'bg-border-bright' : 'bg-border hover:bg-border-bright'
        }`}
        style={{ touchAction: 'none' }}
      />

      <div
        style={{ width: `${(1 - ratio) * 100}%`, pointerEvents: dragging ? 'none' : 'auto' }}
        className="flex flex-col h-full min-h-0 overflow-hidden"
      >
        {right}
      </div>
    </div>
  )
}
