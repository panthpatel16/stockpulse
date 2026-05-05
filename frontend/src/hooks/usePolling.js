// src/hooks/usePolling.js
import { useEffect, useRef } from 'react'

export function usePolling(fn, intervalMs = 30000, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => fnRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
