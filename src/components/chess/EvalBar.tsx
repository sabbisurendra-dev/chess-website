"use client";

import React from "react";
import { formatEvalLabel } from "@/lib/chess/classifier";

interface EvalBarProps {
  cpWhite: number;
  mateWhite?: number | null;
  orientation?: "white" | "black";
}

export function EvalBar({ cpWhite, mateWhite, orientation = "white" }: EvalBarProps) {
  // Clamp visual percentage between 5% and 95% (except forced mate -> 0% / 100%)
  let whitePct = 50;
  if (mateWhite != null && mateWhite !== 0) {
    whitePct = mateWhite > 0 ? 100 : 0;
  } else {
    const clamped = Math.max(-1000, Math.min(1000, cpWhite));
    whitePct = 50 + (clamped / 1000) * 45;
  }

  const label = formatEvalLabel(cpWhite, mateWhite);
  const whiteAdvantage = (mateWhite != null && mateWhite > 0) || (mateWhite == null && cpWhite >= 0);

  return (
    <div
      className="w-7 sm:w-8 h-full min-h-[280px] rounded-lg border overflow-hidden flex flex-col relative select-none shrink-0"
      style={{ borderColor: "var(--border)", backgroundColor: "#1e293b" }}
      title={`Engine eval: ${label}`}
    >
      {orientation === "white" ? (
        <>
          <div
            className="w-full transition-all duration-300 bg-slate-900"
            style={{ height: `${100 - whitePct}%` }}
          />
          <div
            className="w-full transition-all duration-300 bg-slate-100"
            style={{ height: `${whitePct}%` }}
          />
        </>
      ) : (
        <>
          <div
            className="w-full transition-all duration-300 bg-slate-100"
            style={{ height: `${whitePct}%` }}
          />
          <div
            className="w-full transition-all duration-300 bg-slate-900"
            style={{ height: `${100 - whitePct}%` }}
          />
        </>
      )}
      <span
        className={`absolute left-0 right-0 text-center text-[10px] font-mono font-bold px-0.5 ${
          whiteAdvantage ? "bottom-1 text-slate-900" : "top-1 text-slate-100"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
