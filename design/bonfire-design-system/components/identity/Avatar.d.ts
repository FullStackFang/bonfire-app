import React from "react";

export interface AvatarProps {
  /** Letter-pair fallback shown when no photo. */
  initials?: string;
  /** Accent hex. Omit to derive deterministically from initials. */
  color?: string;
  /** Photo URL — photo-first per brand; initials are the fallback. */
  src?: string;
  /** xs 24 · sm 32 · md 40 · lg 48 · xl 64 · hero 96. */
  size?: number;
  /** Live "here" state — adds the breathing spark halo. */
  live?: boolean;
  /** Ring color (e.g. ember for "you"). */
  ring?: string | null;
}

/**
 * Circular avatar, photo-first with letter-pair fallback.
 * @startingPoint section="Identity" subtitle="Avatar with live halo" viewport="240x120"
 */
export function Avatar(props: AvatarProps): JSX.Element;

/** Deterministic accent color for a seed string. */
export function avatarColorFor(seed: string): string;
