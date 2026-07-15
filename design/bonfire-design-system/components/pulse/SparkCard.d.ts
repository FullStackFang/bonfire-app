import React from "react";
import type { StackPerson } from "../identity/AvatarStack";

export interface SparkCardProps {
  /** One-line plan title ("Sunset at the windmills"). */
  title: string;
  /** Where ("Oia"). */
  place?: string;
  /** When — a time ("8:30pm") or "now". */
  time?: string;
  /** Lifecycle readout ("ends 9:30p", "now · ends EOD"). */
  ttl?: string;
  /** Who's in — drives the avatar stack. */
  people?: StackPerson[];
  /** Head-count in. */
  count?: number;
  /** Fresh spark — ember glow treatment. */
  fresh?: boolean;
  /** Current user has tapped in. */
  joined?: boolean;
  onJoin?: () => void;
  style?: React.CSSProperties;
}

/**
 * A droppable one-line plan. A statement, not an invite — others tap "I'm in".
 * @startingPoint section="Pulse" subtitle="Droppable spark plan" viewport="380x160"
 */
export function SparkCard(props: SparkCardProps): JSX.Element;
