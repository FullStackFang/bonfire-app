"use client";

import type { User, Status } from "@/lib/types";

const STATUS_COLORS: Record<Status, string> = {
  available: "#00c46a",
  out: "#ff8c42",
  down: "#9333ea",
  place: "#0891b2",
  invisible: "#9ca3af",
};

const LABELS: Record<Status, string> = {
  available: "Available now",
  out: "Out tonight",
  down: "Down for something",
  place: "At a place",
  invisible: "Invisible",
};

type Props = {
  user: User | null;
  onClose: () => void;
};

export function PersonSheet({ user, onClose }: Props) {
  const open = user !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] rounded-t-[28px] transition-transform duration-300 ease-out"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,248,250,0.99) 100%)",
          backdropFilter: "blur(40px)",
          borderTop: "1px solid var(--border-strong)",
          padding: "14px 24px max(28px, env(safe-area-inset-bottom)) 24px",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.14)",
          transform: open ? "translateY(0)" : "translateY(110%)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle */}
        <div
          className="w-9 h-1 rounded-full mx-auto mb-4"
          style={{ background: "rgba(0,0,0,0.18)" }}
        />

        {user && (
          <>
            <div className="flex items-center gap-3.5 mb-3.5">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-xl"
                style={{
                  background: `linear-gradient(135deg, ${user.gradient[0]}, ${user.gradient[1]})`,
                  border: "2.5px solid #fff",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
                }}
              >
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[17px] font-semibold mb-0.5"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {user.name}
                </div>
                <div
                  className="flex items-center gap-1.5 text-[13px] font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: STATUS_COLORS[user.status],
                      boxShadow: `0 0 8px ${STATUS_COLORS[user.status]}`,
                    }}
                  />
                  <span>{LABELS[user.status]} · {user.distance}</span>
                </div>
              </div>
            </div>

            <div
              className="text-[13px] italic font-mono px-3 py-2.5 rounded-xl mb-4 border"
              style={{
                color: "var(--text)",
                background: "rgba(0,0,0,0.04)",
                borderColor: "var(--border)",
              }}
            >
              <span style={{ color: "var(--text-faint)" }}>&ldquo;</span>
              {user.note}
              <span style={{ color: "var(--text-faint)" }}>&rdquo;</span>
            </div>

            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
              <button
                className="px-2 py-3.5 rounded-xl text-[13px] font-semibold text-white border-transparent"
                style={{
                  background: "linear-gradient(135deg, var(--accent-warm), var(--accent))",
                  letterSpacing: "-0.01em",
                  boxShadow: "0 6px 20px var(--accent-glow)",
                }}
              >
                Pull up
              </button>
              <button
                className="px-2 py-3.5 rounded-xl text-[13px] font-semibold border transition-colors hover:bg-black/[0.08]"
                style={{
                  color: "var(--text)",
                  background: "rgba(0,0,0,0.04)",
                  borderColor: "var(--border-strong)",
                  letterSpacing: "-0.01em",
                }}
              >
                Interested
              </button>
              <button
                className="px-2 py-3.5 rounded-xl text-[13px] font-semibold border transition-colors hover:bg-black/[0.08]"
                style={{
                  color: "var(--text)",
                  background: "rgba(0,0,0,0.04)",
                  borderColor: "var(--border-strong)",
                  letterSpacing: "-0.01em",
                }}
              >
                Message
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
