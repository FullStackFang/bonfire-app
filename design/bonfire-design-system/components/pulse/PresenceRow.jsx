import React from "react";
import { StatusPill } from "./StatusPill.jsx";
import { Avatar } from "../identity/Avatar.jsx";

/**
 * PresenceRow — one person in the ambient "who's up to what" roster.
 * Self-reported status + optional freeform note. "you" highlights the row.
 */
export function PresenceRow({ person = {}, status = "around", note, time, you = false, style = {} }) {
  const here = status === "here";
  return (
    <div
      style={{
        background: you ? "var(--ember-tint)" : "var(--hearth)",
        borderRadius: 16,
        border: you ? "1.5px solid var(--ember)" : "1px solid var(--ash)",
        padding: "11px 13px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        ...style,
      }}
    >
      <Avatar initials={person.initials} color={person.color} src={person.src} size={40} live={here} ring={you ? "var(--ember)" : null} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--coal)" }}>
            {person.name}
          </span>
          {you && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: 0.5,
                color: "var(--ember)",
                background: "var(--hearth)",
                border: "1px solid var(--ember-glow)",
                padding: "1px 7px",
                borderRadius: 999,
              }}
            >
              YOU
            </span>
          )}
          {time && (
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--smoke)" }}>
              {time}
            </span>
          )}
        </div>
        <div style={{ marginTop: 7 }}>
          <StatusPill status={status} small />
        </div>
        {note && (
          <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--smoke)", marginTop: 6, lineHeight: 1.35 }}>
            “{note}”
          </div>
        )}
      </div>
    </div>
  );
}
