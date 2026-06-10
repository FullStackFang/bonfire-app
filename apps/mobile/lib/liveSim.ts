// Anchor-night simulation — a scripted ~20s playback of the core loop so the
// product's liveness can be felt (and demoed) before real users exist.
// Drives the same UI surfaces real data will: arrivals at tonight's venue,
// ignition at 3+ co-present check-ins, pulse joins, the fire climbing to
// roaring. Throwaway by design: real check-ins replace it in week 3.

import { useSyncExternalStore } from "react";
import type { FireState } from "./mockV2";

export interface SimState {
  running: boolean;
  done: boolean;
  /** Member ids checked in at tonight's anchor venue, in arrival order. */
  arrivals: string[];
  /** True once 3+ are co-present — the ember venue ignites. */
  ignited: boolean;
  /** Epoch ms of ignition, for the fog-hole bloom animation. */
  ignitedAt: number | null;
  /** Override for the group fire state; null = use the mock default. */
  fireState: FireState | null;
  /** Extra joiner ids on the active pulse. */
  pulseJoins: string[];
}

const initial: SimState = {
  running: false,
  done: false,
  arrivals: [],
  ignited: false,
  ignitedAt: null,
  fireState: null,
  pulseJoins: [],
};

let state: SimState = initial;
const listeners = new Set<() => void>();
let timers: ReturnType<typeof setTimeout>[] = [];

function emit(next: Partial<SimState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

// Arrival order at Le Fanfare. Theo is absent — he's holding the pulse table
// at Devoción; June already said she's coming to him.
const ARRIVALS = ["maya", "felix", "noor", "priya", "omar", "iris", "rosa", "dev", "jonah"];

export function startAnchorNight() {
  if (state.running) return;
  resetSim();
  emit({ running: true });

  let t = 0;
  const at = (delay: number, fn: () => void) => {
    t += delay;
    timers.push(setTimeout(fn, t));
  };

  ARRIVALS.forEach((id, i) => {
    // Irregular, human gaps: 0.9–3.1s, deterministic per index.
    at(i === 0 ? 1200 : 900 + ((i * 977) % 2200), () => {
      const arrivals = [...state.arrivals, id];
      emit({
        arrivals,
        ...(!state.ignited && arrivals.length >= 3
          ? { ignited: true, ignitedAt: Date.now() }
          : {}),
        ...(arrivals.length >= 8 ? { fireState: "roaring" as FireState } : {}),
      });
    });
  });

  // Midweek spontaneity keeps working during the anchor: Ada joins Theo's pulse.
  at(1600, () => emit({ pulseJoins: [...state.pulseJoins, "ada"] }));
  at(2200, () => emit({ running: false, done: true }));
}

export function resetSim() {
  timers.forEach(clearTimeout);
  timers = [];
  state = initial;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => state;

export function useLiveSim(): SimState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
