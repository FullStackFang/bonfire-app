// Shared OG card for the pulse unfurl. Deliberately FLAT — a single radial gradient plus text,
// no raster images — so the PNG stays well under a few-hundred-KB ceiling (WhatsApp silently drops
// oversized thumbnails). Content is centered so it survives a center-square crop. next/og escapes
// text (no injection), and callers pass ONLY creator-set fields (never participant notes).
export function pulseCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        backgroundImage:
          'radial-gradient(circle at 50% 8%, rgba(245,158,11,0.40), rgba(10,10,10,0) 55%)',
        padding: '80px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, letterSpacing: 14, color: '#f59e0b', fontWeight: 700, marginBottom: 44 }}>
        BONFIRE
      </div>
      <div style={{ display: 'flex', fontSize: 88, color: '#fafafa', fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 42, color: '#a3a3a3', marginTop: 36 }}>
        {subtitle}
      </div>
    </div>
  )
}
