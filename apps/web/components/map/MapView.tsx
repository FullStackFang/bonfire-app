"use client";

import { useState } from "react";
import Link from "next/link";
import { PannableMap } from "./PannableMap";
import { UserMarker } from "./UserMarker";
import { PlanCard } from "./PlanCard";
import { PersonSheet } from "@/components/sheet/PersonSheet";
import { MOCK_USERS, MOCK_PLANS } from "@/lib/mock-data";
import type { User } from "@/lib/types";

export function MapView() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <>
      <PannableMap
        imageSrc="/manhattan-map.jpg"
        onTap={() => setSelectedUser(null)}
      >
        {MOCK_USERS.map((user) => (
          <UserMarker key={user.id} user={user} onClick={setSelectedUser} />
        ))}
        {MOCK_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </PannableMap>

      <div className="vignette" />

      {/* Top bar */}
      <div className="fixed top-5 left-4 right-4 flex justify-between items-center z-[50] pointer-events-none">
        <button
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border cursor-pointer transition-all hover:-translate-y-px"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
            backdropFilter: "blur(24px) saturate(160%)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--accent-warm), var(--accent))",
              boxShadow: "0 0 6px var(--accent-glow)",
            }}
          />
          <span>Friends</span>
          <span className="text-[10px] opacity-40 ml-0.5">▾</span>
        </button>

        <button
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border cursor-pointer transition-all hover:-translate-y-px"
          style={{
            background: "rgba(0, 196, 106, 0.14)",
            borderColor: "rgba(0, 196, 106, 0.35)",
            color: "#00853f",
            backdropFilter: "blur(24px) saturate(160%)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
          }}
        >
          <span
            className="live-dot-pulse w-1.5 h-1.5 rounded-full"
            style={{
              background: "var(--status-available)",
              boxShadow: "0 0 8px var(--status-available)",
            }}
          />
          <span>Available now</span>
          <span className="text-[10px] opacity-50 ml-0.5">▾</span>
        </button>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-7 left-0 right-0 flex flex-col items-center gap-3.5 z-[50] pointer-events-none">
        <div
          className="font-mono text-[10px] pointer-events-none"
          style={{
            color: "rgba(0,0,0,0.45)",
            letterSpacing: "0.32em",
            textShadow: "0 1px 2px rgba(255,255,255,0.5)",
          }}
        >
          B O N F I R E
        </div>
        <Link
          href="/p/new"
          className="pointer-events-auto inline-flex items-center gap-2.5 pl-5 pr-7 py-4 rounded-full text-[15px] font-semibold text-white cursor-pointer transition-transform hover:-translate-y-px"
          style={{
            background: "linear-gradient(135deg, var(--accent-warm) 0%, var(--accent) 100%)",
            letterSpacing: "-0.01em",
            boxShadow:
              "0 12px 32px var(--accent-glow), 0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          <span
            className="w-5.5 h-5.5 rounded-full inline-flex items-center justify-center text-base font-normal leading-none"
            style={{ background: "rgba(255,255,255,0.22)", width: 22, height: 22 }}
          >
            +
          </span>
          <span>Start something</span>
        </Link>
      </div>

      <PersonSheet user={selectedUser} onClose={() => setSelectedUser(null)} />
    </>
  );
}
