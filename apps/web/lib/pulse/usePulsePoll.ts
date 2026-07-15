'use client'
import { useEffect, useRef } from 'react'

// Jittered polling against a /state endpoint. Sends If-None-Match so unchanged state costs a 304
// with no body; pauses when the tab is hidden; backs off on 429/5xx. The caller merges the payload
// into its store (which must protect any in-flight optimistic local change — see applyServer).
export function usePulsePoll<T>(path: string, onData: (data: T) => void) {
  const onDataRef = useRef(onData)
  useEffect(() => { onDataRef.current = onData }, [onData])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let etag: string | null = null
    let failures = 0

    const jitter = () => 4000 + Math.random() * 3000 // 4–7s
    const backoff = () => Math.min(60_000, jitter() * 2 ** Math.min(failures, 4))
    const schedule = (ms: number) => { if (!stopped) timer = setTimeout(tick, ms) }

    async function tick() {
      if (stopped) return
      if (typeof document !== 'undefined' && document.hidden) { schedule(jitter()); return }
      try {
        const res = await fetch(path, {
          cache: 'no-store',
          headers: etag ? { 'if-none-match': etag } : {},
        })
        if (res.status === 304) { failures = 0; schedule(jitter()); return }
        if (res.status === 429 || res.status >= 500) { failures++; schedule(backoff()); return }
        if (res.ok) {
          const tag = res.headers.get('etag')
          if (tag) etag = tag
          onDataRef.current((await res.json()) as T)
          failures = 0
          schedule(jitter())
          return
        }
        // 404 / 4xx other than 429 — the object is gone; stop polling.
      } catch {
        failures++
        schedule(backoff())
      }
    }

    const onVisible = () => {
      if (!document.hidden) { if (timer) clearTimeout(timer); schedule(0) }
    }

    schedule(jitter())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [path])
}
