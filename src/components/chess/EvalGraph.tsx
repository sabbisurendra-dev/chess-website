"use client";

import React from "react";
import type { AnalyzedPly } from "@/types/chess";

interface EvalGraphProps {
  plies: AnalyzedPly[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export function EvalGraph({ plies, currentPly, onSelectPly }: EvalGraphProps) {
  if (plies.length === 0) return null;

  const w = 520;
  const h = 92;
  const mid = h / 2;

  const clampCp = (cp: number) => Math.max(-600, Math.min(600, cp));
  const points = plies.map((p, idx) => {
    const x = plies.length === 1 ? w / 2 : (idx / (plies.length - 1)) * w;
    const y = mid - (clampCp(p.evalAfterCp) / 600) * (mid - 6);
    return { x, y, ply: p.ply, classification: p.classification };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${w},${mid} L0,${mid} Z`;
  const activePt = points.find((p) => p.ply === currentPly);

  return (
    <div
      className="rounded-xl border p-2.5"
      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
        <span>Evaluation Advantage Graph (Click any move to jump)</span>
        <span>+White / -Black</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-22 overflow-visible cursor-pointer">
        <rect x={0} y={0} width={w} height={mid} fill="rgba(255,255,255,0.04)" rx={4} />
        <rect x={0} y={mid} width={w} height={mid} fill="rgba(0,0,0,0.18)" rx={4} />
        <line x1={0} y1={mid} x2={w} y2={mid} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" />

        <path d={areaPath} fill="rgba(52, 211, 153, 0.22)" />
        <path d={linePath} fill="none" stroke="#34d399" strokeWidth={2} />

        {points.map((pt) => {
          const isBad = pt.classification === "blunder" || pt.classification === "mistake";
          return (
            <g key={pt.ply} onClick={() => onSelectPly(pt.ply)}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isBad ? 4 : 2.5}
                fill={
                  pt.classification === "blunder"
                    ? "#ef4444"
                    : pt.classification === "mistake"
                      ? "#f59e0b"
                      : "transparent"
                }
                className="hover:fill-emerald-300"
              />
              <rect x={pt.x - 4} y={0} width={8} height={h} fill="transparent" />
            </g>
          );
        })}

        {activePt && (
          <g>
            <line x1={activePt.x} y1={0} x2={activePt.x} y2={h} stroke="#38bdf8" strokeWidth={1.5} />
            <circle cx={activePt.x} cy={activePt.y} r={4.5} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
