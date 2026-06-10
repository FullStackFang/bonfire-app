// Session-local mutations on the mock world — so the demo isn't watch-only.
// You (the founder playing it) get the real verbs: pulse here, stake an
// ember, tap "coming". Same throwaway pattern as liveSim: real Supabase
// writes replace this in week 3; the UI surfaces it drives don't change.

import { useSyncExternalStore } from "react";
import type { Ember, Pulse } from "./mockV2";
import { selfId } from "./mockV2";

/** Spec §5 — scarcity keeps each ember a genuine "I'd stake a Thursday on this." */
export const EMBER_WEEKLY_CAP = 2;

export interface MapActionsState {
  /** Your live pulse, if any. One at a time — you're one body. */
  myPulse: Pulse | null;
  /** Embers you've staked this session (counts against the weekly cap). */
  droppedEmbers: Ember[];
  /** Pulse ids you've tapped "coming" on. */
  joinedPulseIds: string[];
}

let state: MapActionsState = {
  myPulse: null,
  droppedEmbers: [],
  joinedPulseIds: [],
};

const listeners = new Set<() => void>();

function emit(next: Partial<MapActionsState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function startPulse(
  venue: { name: string; lng: number; lat: number },
  note: string,
) {
  if (state.myPulse) return;
  emit({
    myPulse: {
      id: "p-you",
      memberId: selfId,
      venueName: venue.name,
      lng: venue.lng,
      lat: venue.lat,
      note: note.trim() || "here for the next hour",
      minutesLeft: 90,
      comingIds: [],
    },
  });
}

export function dropEmber(
  venue: { name: string; lng: number; lat: number },
  note: string,
): boolean {
  if (state.droppedEmbers.length >= EMBER_WEEKLY_CAP) return false;
  emit({
    droppedEmbers: [
      ...state.droppedEmbers,
      {
        id: `e-you-${state.droppedEmbers.length + 1}`,
        venueName: venue.name,
        lng: venue.lng,
        lat: venue.lat,
        note: note.trim() || "trust me on this one",
        droppedById: selfId,
        fadesLabel: "fades in 4 weeks",
      },
    ],
  });
  return true;
}

export function joinPulse(pulseId: string) {
  if (state.joinedPulseIds.includes(pulseId)) return;
  emit({ joinedPulseIds: [...state.joinedPulseIds, pulseId] });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => state;

export function useMapActions(): MapActionsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
