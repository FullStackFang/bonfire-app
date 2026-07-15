import React from "react";

/**
 * StatusPill — a person's live self-reported state.
 * Presence statuses (ambient): around · pool · asleep · out
 * Spark statuses (participation): in · otw · here · out
 * "here" carries the breathing spark dot; "otw" an arrow.
 */
const MAP = {
  // presence
  around: { fg: "var(--spark)", bg: "var(--spark-tint)", label: "around" },
  pool: { fg: "var(--dusk)", bg: "var(--dusk-tint)", label: "at the pool" },
  asleep: { fg: "#7A6C82", bg: "#efeaf0", label: "asleep" },
  // spark participation
  in: { fg: "var(--ember-deep)", bg: "var(--ember-tint)", label: "in" },
  otw: { fg: "var(--dusk)", bg: "var(--dusk-tint)", label: "on my way" },
  here: { fg: "var(--spark)", bg: "var(--spark-tint)", label: "here" },
  out: { fg: "var(--smoke)", bg: "#f1eeec", label: "out" },
};

export function StatusPill({ status = "around", label, time, where, small = false, style = {} }) {
  const s = MAP[status] || MAP.around;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: small ? "3px 9px" : "4px 11px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: small ? 11.5 : 12.5,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {status === "here" && (
        <span
          className="bonfire-pulse-dot"
          style={{ width: small ? 6 : 7, height: small ? 6 : 7, background: "var(--spark)" }}
        />
      )}
      {status === "otw" && <span style={{ fontSize: small ? 11 : 12 }}>→</span>}
      {label || s.label}
      {(time || where) && <span style={{ opacity: 0.55 }}>·</span>}
      {time && (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: small ? 11 : 12 }}>{time}</span>
      )}
      {where && <span style={{ fontWeight: 500 }}>{where}</span>}
    </span>
  );
}
