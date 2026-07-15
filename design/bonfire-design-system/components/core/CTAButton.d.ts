import React from "react";

export interface CTAButtonProps {
  children: React.ReactNode;
  /** primary = ember face; outline = hearth face + ember text; ghost = flat text ("skip"/"not now"). */
  variant?: "primary" | "outline" | "ghost";
  /** Optional smaller sub-label line under the main label. */
  sub?: string;
  /** Full-width (default) or hug content. */
  full?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * The chunky 3D-press button — Bonfire's depth vocabulary.
 * @startingPoint section="Actions" subtitle="Chunky 3D-press CTA" viewport="360x120"
 */
export function CTAButton(props: CTAButtonProps): JSX.Element;
