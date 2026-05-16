import { useEffect, useState } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "bonfire:last-location";

type Coords = { lat: number; lng: number };

export interface ResolvedLocation {
  coords: Coords;
  // True when coords came from a real source (cache, OS last-known, or live
  // GPS). False when we fell back because permission was denied or the read
  // timed out. Callers use this to decide whether `coords` is safe to fly to.
  isReal: boolean;
}

// Reads the user's location with crisp launch behaviour: AsyncStorage cache
// → OS last-known fix → live GPS, with a `fallback` resolution if any of
// those fail. The returned object is null only while the hook is still
// initialising on first mount.
export function useUserLocation(
  fallback: Coords,
  opts: { timeoutMs?: number } = {},
): ResolvedLocation | null {
  const { timeoutMs = 1500 } = opts;
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setReal = (coords: Coords) => {
      setResolved((prev) => (cancelled || prev?.isReal ? prev : { coords, isReal: true }));
    };
    const setFallback = () => {
      setResolved((prev) => (cancelled || prev ? prev : { coords: fallback, isReal: false }));
    };

    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Coords;
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setReal(parsed);
          }
        } catch {
          // ignore corrupt cache
        }
      })
      .catch(() => {});

    const timeout = setTimeout(setFallback, timeoutMs);

    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          perm = await Location.requestForegroundPermissionsAsync();
        }
        if (!perm.granted) {
          setFallback();
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setReal({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const live = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setReal(live);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(live)).catch(() => {});
      } catch {
        setFallback();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fallback.lat, fallback.lng, timeoutMs]);

  return resolved;
}
