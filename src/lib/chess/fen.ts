import { Chess } from "chess.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Strips halfmove clock and fullmove number so identical positions reached via
 * different move orders (transpositions like Latvian <-> Rousseau) share one key.
 */
export function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return fen.trim();
  // Note: clear en passant target unless an actual en-passant capture is legal,
  // or keep parts[3] safely when chess.js produced it. chess.js v1 only emits
  // ep target when a pawn double-pushes, or we can canonicalize cleanly:
  return `${parts[0]} ${parts[1]} ${parts[2]} ${canonicalEp(parts[0], parts[1], parts[3])}`;
}

function canonicalEp(board: string, turn: string, ep: string): string {
  if (!ep || ep === "-") return "-";
  try {
    const c = new Chess(`${board} ${turn} - ${ep} 0 1`);
    const hasEpCapture = c.moves({ verbose: true }).some((m) => m.flags.includes("e"));
    return hasEpCapture ? ep : "-";
  } catch {
    return "-";
  }
}

export function canonicalFullFen(normFen: string, fullMove = 1): string {
  const parts = normFen.trim().split(/\s+/);
  if (parts.length >= 6) return normFen;
  if (parts.length === 4) return `${normFen} 0 ${fullMove}`;
  return START_FEN;
}

export function pieceCount(fen: string): number {
  const board = fen.split(" ")[0] || "";
  let n = 0;
  for (const ch of board) {
    if (/[pnbrqkPNBRQK]/.test(ch)) n++;
  }
  return n;
}

export function getTurnFromFen(fen: string): "white" | "black" {
  const turn = fen.split(" ")[1];
  return turn === "b" ? "black" : "white";
}

export function detectPhase(fen: string, ply: number): "opening" | "middlegame" | "endgame" {
  const board = fen.split(" ")[0] || "";
  let nonKingMaterial = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    if (lower === "q") nonKingMaterial += 9;
    else if (lower === "r") nonKingMaterial += 5;
    else if (lower === "b" || lower === "n") nonKingMaterial += 3;
  }
  if (nonKingMaterial <= 24 || ply >= 60) return "endgame";
  if (ply <= 18) return "opening";
  return "middlegame";
}

export function getMaterialBalance(fen: string): { white: number; black: number; diff: number } {
  const board = fen.split(" ")[0] || "";
  const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let white = 0;
  let black = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    const v = vals[lower];
    if (!v) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  return { white, black, diff: white - black };
}
