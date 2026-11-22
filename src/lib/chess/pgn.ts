import { Chess } from "chess.js";

export interface ParsedPgnResult {
  movesSan: string[];
  clocksSec: number[];
  headers: Record<string, string>;
  openingMovesKey: string;
}

export function parseClockToSeconds(clockStr: string): number {
  const parts = clockStr.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return -1;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return -1;
}

export function formatClock(sec?: number): string {
  if (sec == null || sec < 0 || Number.isNaN(sec)) return "--:--";
  const whole = Math.floor(sec);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function extractClocksFromPgn(pgn: string): number[] {
  const clocks: number[] = [];
  const regex = /\[%clk\s+([0-9:.]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pgn)) !== null) {
    const sec = parseClockToSeconds(match[1]);
    if (sec >= 0) clocks.push(sec);
  }
  return clocks;
}

export function formatEcoSlug(ecoUrl?: string, pgnHeaders?: Record<string, string>): { slug: string; name: string } {
  if (ecoUrl && ecoUrl.includes("/openings/")) {
    const slug = ecoUrl.split("/openings/").pop() || "Unknown-Opening";
    const clean = slug
      .replace(/-[0-9]+\..*$/, "")
      .replace(/\.{3}.*$/, "")
      .replace(/-/g, " ")
      .trim();
    return {
      slug,
      name: clean || slug.replace(/-/g, " "),
    };
  }
  if (pgnHeaders?.Opening) {
    return {
      slug: pgnHeaders.Opening.replace(/\s+/g, "-"),
      name: pgnHeaders.Opening,
    };
  }
  if (pgnHeaders?.ECO) {
    return {
      slug: pgnHeaders.ECO,
      name: `ECO ${pgnHeaders.ECO}`,
    };
  }
  return { slug: "Unknown", name: "Unclassified Opening" };
}

export function parseGamePgn(pgn: string): ParsedPgnResult {
  const chess = new Chess();
  let headers: Record<string, string> = {};
  let movesSan: string[] = [];

  try {
    chess.loadPgn(pgn, { strict: false });
    headers = Object.fromEntries(
      Object.entries(chess.getHeaders()).map(([k, v]) => [k, String(v ?? "")])
    );
    movesSan = chess.history();
  } catch {
    // Fallback token parser if a Chess.com PGN has non-standard annotations
    const stripped = pgn
      .replace(/^\[.*\]$/gm, "")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\d+\.\.\./g, " ")
      .replace(/\d+\./g, " ")
      .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, " ");
    const tokens = stripped.trim().split(/\s+/).filter(Boolean);
    const fallback = new Chess();
    for (const tok of tokens) {
      try {
        const mv = fallback.move(tok);
        if (mv) movesSan.push(mv.san);
      } catch {
        break;
      }
    }
  }

  const clocksSec = extractClocksFromPgn(pgn);
  const openingMovesKey = movesSan.slice(0, 6).join(" ");

  return { movesSan, clocksSec, headers, openingMovesKey };
}

export function uciToMoveObj(uci: string): { from: string; to: string; promotion?: string } {
  const clean = uci.trim();
  return {
    from: clean.slice(0, 2),
    to: clean.slice(2, 4),
    promotion: clean.length > 4 ? clean[4] : undefined,
  };
}
