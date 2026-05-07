"use client";

import { useDragState } from "./PannableMap";
import type { User } from "@/lib/types";

type Props = {
  user: User;
  onClick: (user: User) => void;
};

/**
 * A draggable-map-aware marker. Renders the avatar, slow campfire simmer halo,
 * status dot, and optional floating "AIM-style" note bubble. Suppresses the
 * click event if the user just dragged the map.
 */
export function UserMarker({ user, onClick }: Props) {
  const { wasDragging } = useDragState();

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragging()) return;
    e.stopPropagation();
    onClick(user);
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${user.x}%`, top: `${user.y}%` }}
    >
      <div
        className="relative w-12 h-12 cursor-pointer transition-transform duration-200 hover:scale-110 hover:z-50"
        onClick={handleClick}
      >
        <div className="simmer" />

        {user.showNote && (
          <div
            className="note-bubble absolute -top-9 left-1/2 px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap pointer-events-none border"
            style={{
              background: "var(--surface-strong)",
              borderColor: "var(--border-strong)",
              color: "var(--text)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          >
            {user.note}
          </div>
        )}

        <div
          className="relative w-full h-full rounded-full flex items-center justify-center text-white font-semibold text-base z-[2]"
          style={{
            background: `linear-gradient(135deg, ${user.gradient[0]}, ${user.gradient[1]})`,
            border: "2.5px solid #fff",
            letterSpacing: "-0.02em",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 6px 18px rgba(0,0,0,0.22)",
          }}
        >
          {user.initials}
        </div>

        <div
          className={`absolute -bottom-px -right-px w-3.5 h-3.5 rounded-full z-[3] status-dot-${user.status}`}
          style={{ border: "2.5px solid #fff" }}
        />
      </div>
    </div>
  );
}
