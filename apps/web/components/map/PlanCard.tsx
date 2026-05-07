"use client";

import { useDragState } from "./PannableMap";
import type { Plan } from "@/lib/types";

type Props = {
  plan: Plan;
  onClick?: (plan: Plan) => void;
};

export function PlanCard({ plan, onClick }: Props) {
  const { wasDragging } = useDragState();

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragging()) return;
    e.stopPropagation();
    onClick?.(plan);
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-[12]"
      style={{ left: `${plan.x}%`, top: `${plan.y}%` }}
    >
      <div
        className="w-[158px] cursor-pointer rounded-2xl px-3.5 pt-2.5 pb-3 border transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          background: "var(--surface-strong)",
          borderColor: "var(--border-strong)",
          backdropFilter: "blur(28px) saturate(160%)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
        onClick={handleClick}
      >
        <div
          className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase mb-1"
          style={{
            color: "var(--accent-warm)",
            letterSpacing: "0.06em",
          }}
        >
          {plan.vibe}
        </div>
        <div className="text-sm font-semibold leading-tight mb-1.5" style={{ letterSpacing: "-0.015em" }}>
          {plan.title}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
          <div className="flex mr-1">
            {plan.faces.map((c, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${c}, ${c}99)`,
                  border: "1.5px solid #fff",
                  marginLeft: i === 0 ? 0 : -5,
                }}
              />
            ))}
          </div>
          <span>{plan.count} in · {plan.distance}</span>
        </div>
      </div>
    </div>
  );
}
