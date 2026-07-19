import { useCallback, useRef, useState } from 'react'

let rippleId = 0

export function useRipple() {
  const [ripples, setRipples] = useState([])
  const containerRef = useRef(null)

  const addRipple = useCallback((event) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const id = rippleId++
    setRipples((prev) => [...prev, { id, x, y, size }])
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 850)
  }, [])

  return { containerRef, ripples, addRipple }
}
