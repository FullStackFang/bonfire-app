import React from "react";
import type { PresenceStatus, SparkStatus } from "./StatusPill";

export interface PresencePerson {
  name: string;
  initials?: string;
  color?: string;
  src?: string;
}

export interface PresenceRowProps {
  person: PresencePerson;
  status?: PresenceStatus | SparkStatus;
  /** Optional freeform note ("wake me for dinner"). */
  note?: string;
  /** Mono timestamp (last update). */
  time?: string;
  /** Highlights the current user's own row. */
  you?: boolean;
  style?: React.CSSProperties;
}

/**
 * One person in the ambient presence roster — avatar, name, status, optional note.
 * @startingPoint section="Pulse" subtitle="Presence roster row" viewport="380x120"
 */
export function PresenceRow(props: PresenceRowProps): JSX.Element;
