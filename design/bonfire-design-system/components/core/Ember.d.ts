import React from "react";

export interface EmberProps {
  /** Edge length in px. Default 16. */
  size?: number;
  /** Adds a soft ember bloom behind the mark. Use on hero / brand moments. */
  glow?: boolean;
  style?: React.CSSProperties;
}

/**
 * The Bonfire brand mark — a CSS teardrop flame.
 * @startingPoint section="Brand" subtitle="The ember mark" viewport="200x120"
 */
export function Ember(props: EmberProps): JSX.Element;
