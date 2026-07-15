import React from "react";

const ACCENTS = ["#5E7FE5", "#1A9E75", "#9D5BC2", "#E2843D", "#E2B33D", "#666f7d"];

/** Deterministic avatar accent from a seed (name / id). */
export function avatarColorFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

/**
 * Avatar — circle, photo-first with a letter-pair fallback on an accent.
 * Live state carries a breathing ember/spark halo.
 */
export function Avatar({ initials, color, src, size = 40, live = false, ring = null }) {
  const accent = color || avatarColorFor(initials || "");
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-flex" }}>
      {live && (
        <span
          className="bonfire-pulse-dot"
          style={{
            position: "absolute",
            inset: -Math.round(size * 0.18),
            width: "auto",
            height: "auto",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(84,176,90,0.53) 0%, rgba(84,176,90,0) 68%)",
            zIndex: 0,
          }}
        />
      )}
      <span
        style={{
          position: "relative",
          zIndex: 1,
          width: size,
          height: size,
          borderRadius: "50%",
          background: src ? `center/cover url(${src})` : accent,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: size * 0.36,
          letterSpacing: 0.2,
          border: ring ? `2.5px solid ${ring}` : `2px solid var(--hearth)`,
          boxSizing: "border-box",
        }}
      >
        {!src && initials}
      </span>
    </span>
  );
}
