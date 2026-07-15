import React from "react";

export type PresenceStatus = "around" | "pool" | "asleep" | "out";
export type SparkStatus = "in" | "otw" | "here" | "out";

export interface StatusPillProps {
  /** Presence (around/pool/asleep/out) or spark participation (in/otw/here/out). */
  status?: PresenceStatus | SparkStatus;
  /** Override the default label text. */
  label?: string;
  /** Mono timestamp appended after a dot ("4m"). */
  time?: string;
  /** Freeform trailing context ("8m", "at the bar"). */
  where?: string;
  small?: boolean;
  style?: React.CSSProperties;
}

/**
 * A person's live, self-reported status. "here" breathes; "otw" gets an arrow.
 * @startingPoint section="Pulse" subtitle="Live status pills" viewport="360x120"
 */
export function StatusPill(props: StatusPillProps): JSX.Element;
