import React from "react";

export interface ChipProps {
  children: React.ReactNode;
  /** solid = selected/ember; outline = default/unselected; ghost = quiet; tinted = state color at 12%. */
  variant?: "solid" | "outline" | "ghost" | "tinted";
  size?: "sm" | "md";
  /** For variant="tinted": the state hex (e.g. var(--spark)). */
  tint?: string;
  style?: React.CSSProperties;
}

/** Pill label / filter chip. */
export function Chip(props: ChipProps): JSX.Element;
