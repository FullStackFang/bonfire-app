'use client'
import { useRef, useState } from 'react'

// Render a self-contained HTML review verbatim, sandboxed from the app. srcDoc frames are
// same-origin, so we can read the loaded document height and grow the frame to fit — the poster
// scrolls with the page, not inside a nested scrollbar.
export function ReviewFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(2400)

  function fit() {
    try {
      const doc = ref.current?.contentDocument
      if (doc) setHeight(doc.documentElement.scrollHeight + 4)
    } catch {
      /* cross-origin read shouldn't happen for srcDoc; keep the fallback height */
    }
  }

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      onLoad={fit}
      style={{ width: '100%', height, minHeight: 600, border: 0, display: 'block', background: '#f2ede7' }}
    />
  )
}
