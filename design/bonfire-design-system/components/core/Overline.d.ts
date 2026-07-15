import React from "react";

export interface OverlineProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** Uppercase section label above a list ("WHO'S OUT", "LIVE NOW"). */
export function Overline(props: OverlineProps): JSX.Element;
