import React from "react";

export interface StackPerson {
  initials?: string;
  color?: string;
  src?: string;
}

export interface AvatarStackProps {
  people: StackPerson[];
  size?: number;
  /** Max shown before a +N overflow chip. Default 5. */
  max?: number;
}

/** Overlapping avatar row with a +N overflow chip — "who's in" at a glance. */
export function AvatarStack(props: AvatarStackProps): JSX.Element;
