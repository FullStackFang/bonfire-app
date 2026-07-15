import React from "react";
import { AvatarStack } from "../identity/AvatarStack.jsx";
import { Ember } from "../core/Ember.jsx";

/**
 * SparkCard — a droppable one-line plan: title + place + time (or "now").
 * A statement, not an invite. Fresh sparks glow ember; others sit on cream.
 * Shows who's in and an "I'm in" affordance.
 */
export function SparkCard({
  title,
  place,
  time = "now",
  ttl,
  people = [],
  count,
  fresh = false,
  joined = false,
  onJoin,
  style = {},
}) {
  return (
    <div
      style={{
        background: fresh ? "var(--ember-tint)" : "var(--cream)",
        border: fresh ? "1px solid var(--ember-glow)" : "1px solid var(--ash)",
        borderRadius: 16,
        padding: "14px 16px",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 18, color: "var(--coal)" }}>
          {title}
        </span>
        {ttl && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--smoke)", whiteSpace: "nowrap" }}>
            {ttl}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--smoke)", marginTop: 3 }}>
        <b style={{ color: "var(--coal)", fontWeight: 600 }}>{place}</b>
        {place && time && " · "}
        {time}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, flexWrap: "wrap" }}>
        {people.length > 0 && <AvatarStack people={people} size={24} max={4} />}
        {count != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ember-deep)", fontWeight: 500 }}>
            {count} in
          </span>
        )}
        <button
          onClick={onJoin}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: joined ? "var(--hearth)" : "var(--ember)",
            color: joined ? "var(--ember)" : "var(--hearth)",
            border: joined ? "1.5px solid var(--ember-glow)" : "none",
            borderRadius: 999,
            padding: "5px 13px",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <Ember size={9} /> {joined ? "you’re in" : "I’m in"}
        </button>
      </div>
    </div>
  );
}
