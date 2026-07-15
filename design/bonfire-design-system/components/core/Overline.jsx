import React from "react";

/** Overline — uppercase section label above lists. Onest medium, +1.1 tracking. */
export function Overline({ children, style = {} }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color: "var(--smoke)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
