import React from "react";
import { Avatar } from "./Avatar.jsx";

/** AvatarStack — overlapping avatars with a +N coal overflow chip. */
export function AvatarStack({ people = [], size = 30, max = 5 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: shown.length - i }}>
          <Avatar initials={p.initials} color={p.color} src={p.src} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: -size * 0.32,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--coal)",
            color: "#fff",
            border: "2px solid var(--hearth)",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: size * 0.32,
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
