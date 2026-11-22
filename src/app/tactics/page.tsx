"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  Crosshair,
  Eye,
  Flame,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { CuratedPuzzle, PersonalBlunderPuzzle, PlayerColor, PuzzleStatsEntry } from "@/types/chess";
import { SEED_TACTICS } from "@/data/seedTactics";
import { db, ensureSeeded } from "@/lib/storage/db";
import { getTurnFromFen } from "@/lib/chess/fen";
import { uciToMoveObj } from "@/lib/chess/pgn";
import { stockfishEngine, type PositionEvalResult } from "@/lib/chess/stockfish";
import { formatEvalLabel } from "@/lib/chess/classifier";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";

const OPENING_FILTERS = [
  "All",
  "Vienna Game",
  "Grand Prix / Sicilian",
  "Latvian / Rousseau",
  "King's Indian",
  "Endgame & General",
] as const;

export default function TacticsPage() {
  const [source, setSource] = useState<"curated" | "personal">("curated");
  const [openingFilter, setOpeningFilter] = useState<string>("All");
  const [motifFilter, setMotifFilter] = useState<string>("All");
  const [personalBlunders, setPersonalBlunders] = useState<PersonalBlunderPuzzle[]>([]);
  const [stats, setStats] = useState<PuzzleStatsEntry[]>([]);

  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [curFen, setCurFen] = useState("");
  const [stepIndex, setStepIndex] = useState(0); // index into movesUci
  const [solved, setSolved] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [showEngine, setShowEngine] = useState(false);
  const [engineEval, setEngineEval] = useState<PositionEvalResult | null>(null);

  const loadTacticsData = useCallback(async () => {
    await ensureSeeded();
    const [blunders, pStats] = await Promise.all([
      db.personalBlunders.orderBy("playedAt").reverse().toArray(),
      db.puzzleStats.toArray(),
    ]);
    setPersonalBlunders(blunders);
    setStats(pStats);
  }, []);

  useEffect(() => {
    loadTacticsData();
  }, [loadTacticsData]);

  const allMotifs = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const p of SEED_TACTICS) set.add(p.motif);
    return [...set];
  }, []);

  const filteredCurated = useMemo(() => {
    return SEED_TACTICS.filter((p) => {
      if (openingFilter !== "All" && p.openingFamily !== openingFilter) return false;
      if (motifFilter !== "All" && p.motif !== motifFilter) return false;
      return true;
    });
  }, [openingFilter, motifFilter]);

  const activeCurated: CuratedPuzzle | undefined =
    source === "curated"
      ? filteredCurated[puzzleIdx % Math.max(1, filteredCurated.length)]
      : undefined;

  const activePersonal: PersonalBlunderPuzzle | undefined =
    source === "personal"
      ? personalBlunders[puzzleIdx % Math.max(1, personalBlunders.length)]
      : undefined;

  const activeBaseFen = activeCurated?.fen || activePersonal?.fen || "";
  const activeMovesUci = useMemo(
    () => (activeCurated ? activeCurated.movesUci : activePersonal ? [activePersonal.bestMoveUci] : []),
    [activeCurated, activePersonal]
  );
  const activePlayerColor: PlayerColor = useMemo(() => {
    if (activePersonal) return activePersonal.userColor;
    return activeBaseFen ? getTurnFromFen(activeBaseFen) : "white";
  }, [activeBaseFen, activePersonal]);

  // Reset puzzle board whenever selection changes
  useEffect(() => {
    setCurFen(activeBaseFen);
    setStepIndex(0);
    setSolved(false);
    setFailedOnce(false);
    setFeedback(null);
    setHintLevel(0);
    setEngineEval(null);
  }, [activeBaseFen, source, puzzleIdx, openingFilter, motifFilter]);

  useEffect(() => {
    if (!showEngine || !curFen) return;
    let cancelled = false;
    stockfishEngine
      .evaluatePosition(curFen, { depth: 12, multiPv: 2 })
      .then((res) => {
        if (!cancelled) setEngineEval(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showEngine, curFen]);

  const recordOutcome = async (puzzleId: string, motif: string, ok: boolean) => {
    const existing = await db.puzzleStats.get(puzzleId);
    const updated: PuzzleStatsEntry = existing
      ? {
          ...existing,
          solved: existing.solved + (ok ? 1 : 0),
          failed: existing.failed + (ok ? 0 : 1),
          lastSolvedAt: Date.now(),
        }
      : {
          puzzleId,
          motif,
          solved: ok ? 1 : 0,
          failed: ok ? 0 : 1,
          totalTimeMs: 0,
          lastSolvedAt: Date.now(),
        };
    await db.puzzleStats.put(updated);
    setStats((prev) => {
      const idx = prev.findIndex((s) => s.puzzleId === puzzleId);
      if (idx === -1) return [...prev, updated];
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  };

  const handleMove = async (mv: { uci: string; san: string; fenAfter: string }) => {
    if (solved || !curFen || activeMovesUci.length === 0) return;
    const expectedUci = activeMovesUci[stepIndex];
    if (!expectedUci) return;

    const chessCheck = new Chess(mv.fenAfter);
    const isImmediateMate = chessCheck.isCheckmate();

    if (mv.uci === expectedUci || isImmediateMate) {
      const nextStep = stepIndex + 1;
      // Check if puzzle is complete
      if (nextStep >= activeMovesUci.length || isImmediateMate) {
        setCurFen(mv.fenAfter);
        setSolved(true);
        const explanation =
          activeCurated?.explanation || activePersonal?.coachExplanation || "Clean tactical finish!";
        setFeedback({ ok: true, msg: `Solved! ${mv.san} — ${explanation}` });
        const pid = activeCurated?.id || activePersonal?.id || "puz";
        const motif = activeCurated?.motif || activePersonal?.motif || "Tactic";
        await recordOutcome(pid, motif, !failedOnce);
        if (activePersonal) {
          await db.personalBlunders.update(activePersonal.id, {
            solvedCount: activePersonal.solvedCount + 1,
            lastAttemptAt: Date.now(),
          });
        }
        return;
      }

      // Otherwise automatically play opponent's forced reply at activeMovesUci[nextStep]
      const replyUci = activeMovesUci[nextStep];
      const afterReply = new Chess(mv.fenAfter);
      const replyMv = afterReply.move(uciToMoveObj(replyUci));
      if (replyMv) {
        setCurFen(afterReply.fen());
        setStepIndex(nextStep + 1);
        setFeedback({ ok: true, msg: `Good! Opponent replied ${replyMv.san} — find the follow-up!` });
      }
    } else {
      setFailedOnce(true);
      setFeedback({
        ok: false,
        msg: `${mv.san} is not the strongest continuation. Try again or use a hint!`,
      });
      if (activePersonal) {
        await db.personalBlunders.update(activePersonal.id, {
          failedCount: activePersonal.failedCount + 1,
          lastAttemptAt: Date.now(),
        });
      }
    }
  };

  // Weakness Radar grouped by motif
  const motifRadar = useMemo(() => {
    const map = new Map<string, { solved: number; failed: number }>();
    for (const s of stats) {
      const cur = map.get(s.motif) || { solved: 0, failed: 0 };
      cur.solved += s.solved;
      cur.failed += s.failed;
      map.set(s.motif, cur);
    }
    return [...map.entries()].map(([motif, val]) => {
      const total = val.solved + val.failed;
      return {
        motif,
        total,
        accuracy: total > 0 ? Math.round((val.solved / total) * 100) : 0,
      };
    });
  }, [stats]);

  const activeExpectedUci = activeMovesUci[stepIndex] || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tactics Practice Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Punish your own Chess.com blunders or train opening-matched tactics from Vienna, Grand Prix, Latvian/Rousseau &amp; King&apos;s Indian.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSource("curated");
              setPuzzleIdx(0);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              source === "curated"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "hover:bg-white/5"
            }`}
            style={source !== "curated" ? { borderColor: "var(--border)" } : undefined}
          >
            Opening-Matched ({SEED_TACTICS.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSource("personal");
              setPuzzleIdx(0);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              source === "personal"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "hover:bg-white/5"
            }`}
            style={source !== "personal" ? { borderColor: "var(--border)" } : undefined}
          >
            My Chess.com Blunders ({personalBlunders.length})
          </button>
        </div>
      </div>

      {source === "curated" && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={openingFilter}
            onChange={(e) => {
              setOpeningFilter(e.target.value);
              setPuzzleIdx(0);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            {OPENING_FILTERS.map((o) => (
              <option key={o} value={o}>
                Opening: {o}
              </option>
            ))}
          </select>

          <select
            value={motifFilter}
            onChange={(e) => {
              setMotifFilter(e.target.value);
              setPuzzleIdx(0);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            {allMotifs.map((m) => (
              <option key={m} value={m}>
                Motif: {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {source === "personal" && personalBlunders.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Crosshair className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold">No Personal Blunders Extracted Yet</h2>
          <p className="text-xs max-w-md mx-auto" style={{ color: "var(--muted)" }}>
            Open <strong>Games &amp; Review</strong> and click <strong>Analyze Full Game</strong> or{" "}
            <strong>Quick-Scan 5 Unanalyzed Games</strong> — every blunder and big mistake from{" "}
            <code>ssaabbbbii</code> automatically turns into a playable puzzle right here!
          </p>
          <Link
            href="/games"
            className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
          >
            Scan My Chess.com Games →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Board */}
          <div
            className="lg:col-span-6 rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <InteractiveBoard
              fen={curFen || activeBaseFen}
              orientation={activePlayerColor}
              interactive={!solved}
              allowedColor={activePlayerColor}
              circles={
                hintLevel >= 1 && activeExpectedUci
                  ? [{ orig: activeExpectedUci.slice(0, 2), brush: "yellow" }]
                  : []
              }
              arrows={
                hintLevel >= 2 && activeExpectedUci
                  ? [
                      {
                        orig: activeExpectedUci.slice(0, 2),
                        dest: activeExpectedUci.slice(2, 4),
                        brush: "green",
                      },
                    ]
                  : []
              }
              onMove={handleMove}
            />
          </div>

          {/* Info & Controls */}
          <div
            className="lg:col-span-6 rounded-2xl border p-5 flex flex-col justify-between gap-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {activeCurated
                    ? `${activeCurated.openingFamily} · ${activeCurated.motif} (${activeCurated.rating})`
                    : `${activePersonal?.openingName || "Personal Blunder"} · ${activePersonal?.motif}`}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                  #{puzzleIdx + 1}
                </span>
              </div>

              <h2 className="text-lg font-bold">
                {activeCurated
                  ? activeCurated.title
                  : `Find the move you missed (instead of ${activePersonal?.playedMoveSan})`}
              </h2>

              <div className="text-xs font-medium flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full inline-block border ${
                    activePlayerColor === "white" ? "bg-white border-slate-400" : "bg-slate-900 border-slate-500"
                  }`}
                />
                <span className="capitalize">{activePlayerColor} to move</span>
              </div>

              {feedback && (
                <div
                  className={`rounded-xl border p-3.5 text-xs leading-relaxed flex items-start gap-2.5 ${
                    feedback.ok
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-200"
                  }`}
                >
                  {feedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.msg}</span>
                </div>
              )}

              {activeCurated && hintLevel >= 1 && (
                <div
                  className="rounded-xl border p-3 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-amber-400" />
                  {activeCurated.hint}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!solved && (
                  <button
                    type="button"
                    onClick={() => setHintLevel((h) => (h < 2 ? ((h + 1) as 0 | 1 | 2) : 2))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{hintLevel === 0 ? "Hint (Show Piece)" : "Hint (Show Arrow)"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCurFen(activeBaseFen);
                    setStepIndex(0);
                    setSolved(false);
                    setFeedback(null);
                    setHintLevel(0);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>

                <button
                  type="button"
                  onClick={() => setPuzzleIdx((i) => i + 1)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <span>Next Puzzle</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={showEngine}
                  onChange={(e) => setShowEngine(e.target.checked)}
                />
                <span className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Verify with Stockfish 19
                </span>
              </label>
              {showEngine && engineEval && (
                <div
                  className="rounded-lg border p-2.5 text-xs font-mono"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  {engineEval.lines.map((l) => (
                    <div key={l.multipv} className="truncate">
                      <span className="text-emerald-400 mr-2">
                        {formatEvalLabel(l.cpWhite, l.mateWhite)}
                      </span>
                      <span>{l.pvSan.join(" ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Motif Weakness Radar */}
            <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Motif Accuracy Radar
              </div>
              {motifRadar.length === 0 ? (
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Solve puzzles to build your personal motif radar!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {motifRadar.map((r) => (
                    <div
                      key={r.motif}
                      className="rounded-lg border px-2.5 py-1.5 text-xs flex items-center justify-between"
                      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                    >
                      <span className="truncate">{r.motif}</span>
                      <span
                        className={`font-mono font-bold ${
                          r.accuracy >= 75 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {r.accuracy}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
