import { CreateForm } from './CreateForm.client'
import { BrandRow } from '../ui.client'

export const dynamic = 'force-dynamic'

export default function NewPulsePage() {
  return (
    <main className="mx-auto min-h-full w-full max-w-md px-4 pt-4 pb-8">
      <BrandRow />
      <h1 className="bp-title mt-3 mb-1">Start something</h1>
      <p className="bp-sub mb-6">
        A <b style={{ color: 'var(--coal)', fontWeight: 600 }}>board</b> is a place your people keep showing up.
        A <b style={{ color: 'var(--coal)', fontWeight: 600 }}>pulse</b> is one thing happening now. Drop either into a chat.
      </p>
      <CreateForm />
    </main>
  )
}
