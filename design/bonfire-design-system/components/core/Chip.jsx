import React from "react";

/** Chip — pill label. solid (ember) / outline / ghost / tinted state variants. */
export function Chip({ children, variant = "outline", size = "md", tint, style = {} }) {
  const pad = size === "sm" ? "6px 10px" : "8px 14px";
  const fs = size === "sm" ? 11 : 13;
  const looks = {
    solid: { background: "var(--ember)", color: "var(--hearth)", border: "none" },
    outline: { background: "var(--hearth)", color: "var(--coal)", border: "1px solid var(--ash)" },
    ghost: { background: "transparent", color: "var(--smoke)", border: "none" },
    tinted: { background: tint ? `${tint}1f` : "var(--ember-tint)", color: tint || "var(--ember-deep)", border: "none" },
  }[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: 999,
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: fs,
        whiteSpace: "nowrap",
        ...looks,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
