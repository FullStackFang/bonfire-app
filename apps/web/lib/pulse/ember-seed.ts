// Pure, client-safe (no db import — the afterglow view composes the seed in the browser).

/** Intent line for the next plan, pre-seeded from a mutual ember: "again: tennis with Dana and
 *  Priya". Feeds the normal plan-creation flow — nothing is sent to anyone (design D6). */
export function emberSeedIntent(intentSnapshot: string, coTappers: string[]): string {
  const names = coTappers.filter(Boolean)
  const withWho =
    names.length === 0 ? ''
    : names.length === 1 ? ` with ${names[0]}`
    : ` with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `again: ${intentSnapshot}${withWho}`.slice(0, 500)
}
