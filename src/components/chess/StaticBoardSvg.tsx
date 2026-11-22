import React from "react";

interface StaticBoardSvgProps {
  fen: string;
  size?: number;
  orientation?: "white" | "black";
  className?: string;
}

const PIECE_UNICODE: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

function parseBoardGrid(fen: string): (string | null)[][] {
  const boardPart = (fen || "").split(" ")[0] || "8/8/8/8/8/8/8/8";
  const rows = boardPart.split("/");
  const grid: (string | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r] || "8";
    const row: (string | null)[] = [];
    for (const ch of rowStr) {
      if (/[1-8]/.test(ch)) {
        const count = Number(ch);
        for (let k = 0; k < count; k++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    while (row.length < 8) row.push(null);
    grid.push(row.slice(0, 8));
  }
  return grid;
}

export function StaticBoardSvg({
  fen,
  size = 240,
  orientation = "white",
  className = "",
}: StaticBoardSvgProps) {
  const grid = parseBoardGrid(fen);
  const sq = size / 8;

  const squares: React.ReactNode[] = [];
  for (let vr = 0; vr < 8; vr++) {
    for (let vc = 0; vc < 8; vc++) {
      const r = orientation === "white" ? vr : 7 - vr;
      const c = orientation === "white" ? vc : 7 - vc;
      const isLight = (r + c) % 2 === 0;
      const piece = grid[r]?.[c];
      const x = vc * sq;
      const y = vr * sq;

      squares.push(
        <g key={`${vr}-${vc}`}>
          <rect
            x={x}
            y={y}
            width={sq}
            height={sq}
            fill={isLight ? "#f0d9b5" : "#b58863"}
          />
          {piece && PIECE_UNICODE[piece] && (
            <text
              x={x + sq / 2}
              y={y + sq * 0.77}
              textAnchor="middle"
              fontSize={sq * 0.78}
              fill={piece === piece.toUpperCase() ? "#ffffff" : "#111827"}
              stroke={piece === piece.toUpperCase() ? "#1f2937" : "#f8fafc"}
              strokeWidth={piece === piece.toUpperCase() ? sq * 0.032 : sq * 0.015}
              style={{ fontFamily: "serif", userSelect: "none" }}
            >
              {PIECE_UNICODE[piece]}
            </text>
          )}
        </g>
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`static-chessboard rounded-lg border overflow-hidden shadow-sm ${className}`}
      style={{ borderColor: "var(--border)" }}
      role="img"
      aria-label={`Chess position ${fen}`}
    >
      {squares}
    </svg>
  );
}
