'use client'
import { useEffect, useRef } from 'react'

export function ViewBeacon({ token, page }: { token: string; page: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/views', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, page }),
    }).catch(() => {})
  }, [token, page])
  return null
}
