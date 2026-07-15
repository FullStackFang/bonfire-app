import React from "react";

/**
 * CTAButton — the chunky 3D-press button. Ember face on an ember-deep
 * colored offset; on press the face translates down to meet its shadow.
 * The house depth vocabulary — never a flat material button.
 */
export function CTAButton({
  children,
  variant = "primary",
  sub,
  full = true,
  onClick,
  style = {},
}) {
  const primary = variant === "primary";
  const ghost = variant === "ghost";
  const depth = 5;

  if (ghost) {
    return (
      <button
        onClick={onClick}
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          width: full ? "100%" : "auto",
          height: 54,
          padding: "0 20px",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--smoke)",
          ...style,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        width: full ? "100%" : "auto",
        border: primary ? "none" : "1.5px solid var(--shadow-warm)",
        cursor: "pointer",
        borderRadius: 999,
        height: sub ? 60 : 56,
        padding: "0 22px",
        background: primary ? "var(--ember)" : "var(--hearth)",
        color: primary ? "var(--hearth)" : "var(--ember)",
        boxShadow: `0 ${depth}px 0 ${primary ? "var(--ember-deep)" : "var(--shadow-warm)"}`,
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 17,
        letterSpacing: 0.2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        transition: "transform 0.06s, box-shadow 0.06s",
        ...style,
      }}
      onPointerDown={(e) => {
        e.currentTarget.style.transform = `translateY(${depth}px)`;
        e.currentTarget.style.boxShadow = `0 0px 0 ${primary ? "var(--ember-deep)" : "var(--shadow-warm)"}`;
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = `0 ${depth}px 0 ${primary ? "var(--ember-deep)" : "var(--shadow-warm)"}`;
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = `0 ${depth}px 0 ${primary ? "var(--ember-deep)" : "var(--shadow-warm)"}`;
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</span>
      {sub && <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.82 }}>{sub}</span>}
    </button>
  );
}
