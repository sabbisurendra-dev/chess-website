import { Chess } from "chess.js";
import type { PlayerColor, StoredGame } from "@/types/chess";
import { normalizeFen, START_FEN } from "./fen";

export interface OpeningLeak {
  ecoSlug: string;
  ecoName: string;
  userColor: PlayerColor;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  leakScore: number; // higher = more urgent to fix (frequent + low score)
  sampleMoves: string;
  recentGameId: string;
}

export interface TreeMoveStat {
  san: string;
  uci: string;
  nextNormFen: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  avgOpponentRating: number;
}

export interface PhaseClockDiagnostics {
  totalGames: number;
  analyzedGames: number;
  avgAccuracy: number | null;
  timeTroubleLosses: number; // lost with < 20s left on clock
  quickLossesUnder20Moves: number;
  winsByColor: {
    white: { games: number; wins: number; draws: number; losses: number; winRate: number };
    black: { games: number; wins: number; draws: number; losses: number; winRate: number };
  };
  byTimeClass: Record<string, { games: number; wins: number; draws: number; losses: number; winRate: number }>;
  blundersByPhase: { opening: number; middlegame: number; endgame: number };
  recurringPatterns: string[];
}

export function detectOpeningLeaks(games: StoredGame[], minGames = 2): OpeningLeak[] {
  const buckets = new Map<
    string,
    {
      ecoSlug: string;
      ecoName: string;
      userColor: PlayerColor;
      games: number;
      wins: number;
      draws: number;
      losses: number;
      sampleMoves: string;
      recentGameId: string;
      recentTime: number;
    }
  >();

  for (const g of games) {
    const key = `${g.userColor}:${g.ecoName}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        ecoSlug: g.ecoSlug,
        ecoName: g.ecoName,
        userColor: g.userColor,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        sampleMoves: g.openingMovesKey,
        recentGameId: g.id,
        recentTime: g.endTime,
      };
      buckets.set(key, b);
    }
    b.games++;
    if (g.result === "win") b.wins++;
    else if (g.result === "draw") b.draws++;
    else b.losses++;

    if (g.endTime > b.recentTime) {
      b.recentTime = g.endTime;
      b.recentGameId = g.id;
    }
  }

  const leaks: OpeningLeak[] = [];
  for (const b of buckets.values()) {
    if (b.games < minGames) continue;
    const score = (b.wins + b.draws * 0.5) / b.games;
    const winRate = Math.round(score * 100);
    // Leak score favors openings played often with < 50% score
    const deficit = Math.max(0, 0.52 - score);
    const leakScore = Math.round(deficit * Math.sqrt(b.games) * 1000) / 10;
    leaks.push({
      ecoSlug: b.ecoSlug,
      ecoName: b.ecoName,
      userColor: b.userColor,
      games: b.games,
      wins: b.wins,
      draws: b.draws,
      losses: b.losses,
      winRate,
      leakScore,
      sampleMoves: b.sampleMoves,
      recentGameId: b.recentGameId,
    });
  }

  return leaks.sort((a, b) => b.leakScore - a.leakScore || b.games - a.games);
}

/**
 * OpeningTree-style personal position explorer across synced Chess.com games.
 */
export function buildPersonalTreeAtFen(
  games: StoredGame[],
  targetFen: string,
  colorFilter?: PlayerColor | "all",
  maxPlies = 16
): { totalReached: number; moves: TreeMoveStat[] } {
  const targetNorm = normalizeFen(targetFen || START_FEN);
  const stats = new Map<
    string,
    {
      san: string;
      uci: string;
      nextNormFen: string;
      games: number;
      wins: number;
      draws: number;
      losses: number;
      oppRatingSum: number;
    }
  >();

  let totalReached = 0;

  // Performance cap: scan up to 600 most recent matching games synchronously for instant UI
  const filtered = games
    .filter((g) => (colorFilter && colorFilter !== "all" ? g.userColor === colorFilter : true))
    .slice(0, 600);

  for (const g of filtered) {
    const chess = new Chess();
    if (targetNorm === normalizeFen(START_FEN)) {
      totalReached++;
      const firstSan = g.movesSan[0];
      if (!firstSan) continue;
      const mv = chess.move(firstSan);
      if (!mv) continue;
      const uci = `${mv.from}${mv.to}${mv.promotion || ""}`;
      recordMove(stats, mv.san, uci, normalizeFen(chess.fen()), g);
      continue;
    }

    for (let i = 0; i < Math.min(g.movesSan.length, maxPlies); i++) {
      const mv = chess.move(g.movesSan[i]);
      if (!mv) break;
      if (normalizeFen(chess.fen()) === targetNorm) {
        totalReached++;
        const nextSan = g.movesSan[i + 1];
        if (!nextSan) break;
        const nextMv = chess.move(nextSan);
        if (!nextMv) break;
        const uci = `${nextMv.from}${nextMv.to}${nextMv.promotion || ""}`;
        recordMove(stats, nextMv.san, uci, normalizeFen(chess.fen()), g);
        break;
      }
    }
  }

  const moves: TreeMoveStat[] = [...stats.values()]
    .map((s) => ({
      san: s.san,
      uci: s.uci,
      nextNormFen: s.nextNormFen,
      games: s.games,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      winRate: Math.round(((s.wins + s.draws * 0.5) / s.games) * 100),
      avgOpponentRating: Math.round(s.oppRatingSum / s.games),
    }))
    .sort((a, b) => b.games - a.games);

  return { totalReached, moves };
}

function recordMove(
  stats: Map<
    string,
    {
      san: string;
      uci: string;
      nextNormFen: string;
      games: number;
      wins: number;
      draws: number;
      losses: number;
      oppRatingSum: number;
    }
  >,
  san: string,
  uci: string,
  nextNormFen: string,
  g: StoredGame
) {
  let entry = stats.get(uci);
  if (!entry) {
    entry = {
      san,
      uci,
      nextNormFen,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      oppRatingSum: 0,
    };
    stats.set(uci, entry);
  }
  entry.games++;
  entry.oppRatingSum += g.opponentRating || 0;
  if (g.result === "win") entry.wins++;
  else if (g.result === "draw") entry.draws++;
  else entry.losses++;
}

export function analyzePhaseAndClock(games: StoredGame[]): PhaseClockDiagnostics {
  const white = { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 };
  const black = { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 };
  const byTimeClass: PhaseClockDiagnostics["byTimeClass"] = {};
  const blundersByPhase = { opening: 0, middlegame: 0, endgame: 0 };

  let timeTroubleLosses = 0;
  let quickLossesUnder20Moves = 0;
  let analyzedGames = 0;
  let accSum = 0;

  for (const g of games) {
    const colorBucket = g.userColor === "white" ? white : black;
    colorBucket.games++;
    if (g.result === "win") colorBucket.wins++;
    else if (g.result === "draw") colorBucket.draws++;
    else colorBucket.losses++;

    if (!byTimeClass[g.timeClass]) {
      byTimeClass[g.timeClass] = { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 };
    }
    const tc = byTimeClass[g.timeClass];
    tc.games++;
    if (g.result === "win") tc.wins++;
    else if (g.result === "draw") tc.draws++;
    else tc.losses++;

    if (g.result === "loss") {
      if (g.movesSan.length <= 40) quickLossesUnder20Moves++;
      const userClocks = g.clocksSec.filter((_, idx) =>
        g.userColor === "white" ? idx % 2 === 0 : idx % 2 === 1
      );
      const lastClock = userClocks[userClocks.length - 1];
      if (lastClock != null && lastClock >= 0 && lastClock < 20) {
        timeTroubleLosses++;
      }
    }

    if (g.analyzed && g.userAccuracy != null) {
      analyzedGames++;
      accSum += g.userAccuracy;
      for (const ply of g.reviewMoves || []) {
        const plyColor: PlayerColor = ply.ply % 2 === 1 ? "white" : "black";
        if (plyColor === g.userColor && (ply.classification === "blunder" || ply.classification === "mistake")) {
          blundersByPhase[ply.phase]++;
        }
      }
    }
  }

  white.winRate = white.games ? Math.round(((white.wins + white.draws * 0.5) / white.games) * 100) : 0;
  black.winRate = black.games ? Math.round(((black.wins + black.draws * 0.5) / black.games) * 100) : 0;
  for (const tc of Object.values(byTimeClass)) {
    tc.winRate = tc.games ? Math.round(((tc.wins + tc.draws * 0.5) / tc.games) * 100) : 0;
  }

  const recurringPatterns: string[] = [];
  if (games.length > 0) {
    if (white.games > 0 && black.games > 0 && white.winRate - black.winRate >= 8) {
      recurringPatterns.push(
        `Stronger as White (${white.winRate}% score) than Black (${black.winRate}%). Sharpening your ...f5 counter-gambits and King's Indian replies against 1.d4/1.c4 offers immediate Elo gain.`
      );
    } else if (black.games > 0 && white.games > 0 && black.winRate - white.winRate >= 8) {
      recurringPatterns.push(
        `Stronger as Black (${black.winRate}%) than White (${white.winRate}%). Consolidating your 1.e4 Nc3+f4 (Vienna + Grand Prix) move orders will boost White conversion.`
      );
    }

    if (timeTroubleLosses > 0) {
      const pct = Math.round((timeTroubleLosses / Math.max(1, white.losses + black.losses)) * 100);
      recurringPatterns.push(
        `${timeTroubleLosses} losses (${pct}% of losses) occurred with under 20 seconds left on the clock — FSRS opening drills will save critical opening minutes.`
      );
    }

    if (quickLossesUnder20Moves > 0) {
      recurringPatterns.push(
        `${quickLossesUnder20Moves} games ended in losses within 20 moves — review those games in Stockfish & save opponent traps into your Opening Prep.`
      );
    }
  }

  return {
    totalGames: games.length,
    analyzedGames,
    avgAccuracy: analyzedGames > 0 ? Math.round((accSum / analyzedGames) * 10) / 10 : null,
    timeTroubleLosses,
    quickLossesUnder20Moves,
    winsByColor: { white, black },
    byTimeClass,
    blundersByPhase,
    recurringPatterns,
  };
}
