"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import {
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  Flame,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { DrillCard, OpeningSummary, PatternFamily, PlayerColor, RepertoireNode } from "@/types/chess";
import { db, ensureSeeded } from "@/lib/storage/db";
import { gradeDrillCard, isCardDue, previewNextIntervals, type DrillGrade } from "@/lib/fsrs/scheduler";
import { normalizeFen, START_FEN } from "@/lib/chess/fen";
import { stockfishEngine } from "@/lib/chess/stockfish";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";

type PracticeMode = "due" | "family" | "all" | "sparring";

function PracticeContent() {
  const searchParams = useSearchParams();
  const paramFamily = searchParams.get("family") || "";
  const paramOpening = searchParams.get("opening") || "";

  const [mode, setMode] = useState<PracticeMode>(paramFamily ? "family" : "due");
  const [families, setFamilies] = useState<PatternFamily[]>([]);
  const [openings, setOpenings] = useState<OpeningSummary[]>([]);
  const [nodesMap, setNodesMap] = useState<Map<string, RepertoireNode>>(new Map());
  const [allCards, setAllCards] = useState<DrillCard[]>([]);

  const [selectedFamilyId, setSelectedFamilyId] = useState(paramFamily || "");
  const [selectedOpeningId, setSelectedOpeningId] = useState(paramOpening || "");
  const [queueIndex, setQueueIndex] = useState(0);
  const [solvedCurrent, setSolvedCurrent] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showHintArrow, setShowHintArrow] = useState(false);

  // Sparring State
  const [sparringColor, setSparringColor] = useState<PlayerColor>("white");
  const [sparringElo, setSparringElo] = useState(1250);
  const [sparringFen, setSparringFen] = useState(START_FEN);
  const [sparringMoves, setSparringMoves] = useState<string[]>([]);
  const [sparringLastMove, setSparringLastMove] = useState<[string, string] | undefined>();
  const [sparringStatus, setSparringStatus] = useState("Ready to spar! Play a move or pick an opening anchor.");
  const [botThinking, setBotThinking] = useState(false);

  const loadData = useCallback(async () => {
    await ensureSeeded();
    const [fams, ops, nodes, cards] = await Promise.all([
      db.families.toArray(),
      db.openings.toArray(),
      db.nodes.toArray(),
      db.drillCards.toArray(),
    ]);
    setFamilies(fams);
    setOpenings(ops);
    setNodesMap(new Map(nodes.map((n) => [n.normFen, n])));
    setAllCards(cards);
    if (!selectedFamilyId && fams[0]) {
      setSelectedFamilyId(fams[0].id);
    }
  }, [selectedFamilyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeQueue = useMemo(() => {
    const now = new Date();
    let list = [...allCards];
    if (selectedOpeningId) {
      list = list.filter((c) => c.openingId === selectedOpeningId);
    } else if (mode === "family" && selectedFamilyId) {
      list = list.filter((c) => c.familyId === selectedFamilyId);
    } else if (mode === "due") {
      list = list.filter((c) => isCardDue(c, now));
    }
    return list.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  }, [allCards, mode, selectedFamilyId, selectedOpeningId]);

  const currentCard = activeQueue[queueIndex % Math.max(1, activeQueue.length)];
  const intervalPreview = useMemo(
    () => (currentCard ? previewNextIntervals(currentCard) : null),
    [currentCard]
  );

  const resetDrillCardState = () => {
    setSolvedCurrent(false);
    setWrongAttempts(0);
    setFeedback(null);
    setShowHintArrow(false);
  };

  const handleDrillMove = (mv: { uci: string; san: string }) => {
    if (!currentCard || solvedCurrent) return;
    if (mv.uci === currentCard.expectedUci || mv.san === currentCard.expectedSan) {
      setSolvedCurrent(true);
      setFeedback({
        ok: true,
        msg: `Correct! ${currentCard.expectedSan} — ${currentCard.coachHint}`,
      });
    } else {
      setWrongAttempts((w) => w + 1);
      setFeedback({
        ok: false,
        msg: `${mv.san} is not your repertoire move here. Try again or peek at the hint!`,
      });
    }
  };

  const handleGradeCard = async (grade: DrillGrade) => {
    if (!currentCard) return;
    const updated = gradeDrillCard(currentCard, grade);
    await db.drillCards.put(updated);
    setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    resetDrillCardState();
    setQueueIndex((idx) => (idx + 1 >= activeQueue.length ? 0 : idx + 1));
  };

  // Sparring Helpers
  const startSparringFromOpening = async (opening?: OpeningSummary) => {
    const c = new Chess();
    const moves: string[] = [];
    const targetColor: PlayerColor = opening?.color || sparringColor;
    setSparringColor(targetColor);

    if (opening) {
      for (const san of opening.startMovesSan) {
        const mv = c.move(san);
        if (!mv) break;
        moves.push(mv.san);
      }
    }

    setSparringMoves(moves);
    setSparringFen(c.fen());
    setSparringLastMove(undefined);

    // If it's opponent's turn immediately, let bot reply!
    const turn: PlayerColor = c.turn() === "w" ? "white" : "black";
    if (turn !== targetColor) {
      await triggerBotReply(c.fen(), moves, targetColor);
    } else {
      setSparringStatus(`Your move as ${targetColor} (${opening ? opening.name : "Free Sparring"}).`);
    }
  };

  const triggerBotReply = async (fenNow: string, currentMoves: string[], userCol: PlayerColor) => {
    setBotThinking(true);
    try {
      const c = new Chess(fenNow);
      if (c.isGameOver()) {
        setSparringStatus(c.isCheckmate() ? "Checkmate!" : "Game Over (Draw).");
        return;
      }

      const norm = normalizeFen(fenNow);
      const repNode = nodesMap.get(norm);
      let chosenSan = "";
      let sourceLabel = "Stockfish 19";

      if (repNode && repNode.edges.length > 0 && currentMoves.length <= 14) {
        const edge = repNode.edges[Math.floor(Math.random() * repNode.edges.length)];
        chosenSan = edge.san;
        sourceLabel = "Repertoire Book";
      } else {
        const sf = await stockfishEngine.pickSparringMove(fenNow, sparringElo);
        chosenSan = sf.san;
        sourceLabel = `Stockfish ~${sparringElo}`;
      }

      const mv = c.move(chosenSan);
      if (mv) {
        setSparringMoves([...currentMoves, mv.san]);
        setSparringFen(c.fen());
        setSparringLastMove([mv.from, mv.to]);
        setSparringStatus(`${sourceLabel} played ${mv.san}. Your turn as ${userCol}!`);
      }
    } catch (err) {
      setSparringStatus(err instanceof Error ? err.message : "Bot move failed.");
    } finally {
      setBotThinking(false);
    }
  };

  const handleSparringUserMove = async (mv: { san: string; from: string; to: string; fenAfter: string }) => {
    if (botThinking) return;
    const nextMoves = [...sparringMoves, mv.san];
    setSparringMoves(nextMoves);
    setSparringFen(mv.fenAfter);
    setSparringLastMove([mv.from, mv.to]);
    await triggerBotReply(mv.fenAfter, nextMoves, sparringColor);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Opening Practice &amp; Sparring Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            FSRS spaced repetition for long-term retention + Pattern Family Mix drills + Live Play-Out Sparring vs Stockfish.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "due", label: `Due Queue (${allCards.filter((c) => isCardDue(c)).length})` },
              { id: "family", label: "Pattern Family Mix" },
              { id: "all", label: `All Lines (${allCards.length})` },
              { id: "sparring", label: "Play-Out Sparring" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setSelectedOpeningId("");
                setQueueIndex(0);
                resetDrillCardState();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                mode === m.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "hover:bg-white/5"
              }`}
              style={mode !== m.id ? { borderColor: "var(--border)" } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode !== "sparring" ? (
        <div className="space-y-4">
          {/* Family / Opening filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {mode === "family" && (
              <select
                value={selectedFamilyId}
                onChange={(e) => {
                  setSelectedFamilyId(e.target.value);
                  setQueueIndex(0);
                  resetDrillCardState();
                }}
                className="rounded-lg border px-3 py-1.5 text-xs"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={selectedOpeningId}
              onChange={(e) => {
                setSelectedOpeningId(e.target.value);
                setQueueIndex(0);
                resetDrillCardState();
              }}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <option value="">All Openings in Scope</option>
              {openings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {!currentCard ? (
            <div
              className="rounded-2xl border p-8 text-center space-y-3"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h2 className="text-base font-bold">All Due FSRS Cards Completed!</h2>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--muted)" }}>
                Switch to Pattern Family Mix, All Lines, or Play-Out Sparring to keep sharpening your systems.
              </p>
              <button
                type="button"
                onClick={() => setMode("family")}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
              >
                Drill Pattern Family Mix
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div
                className="lg:col-span-6 rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <InteractiveBoard
                  fen={currentCard.promptFen}
                  orientation={currentCard.color}
                  interactive={!solvedCurrent}
                  allowedColor={currentCard.color}
                  arrows={
                    showHintArrow || solvedCurrent
                      ? [
                          {
                            orig: currentCard.expectedUci.slice(0, 2),
                            dest: currentCard.expectedUci.slice(2, 4),
                            brush: "green",
                          },
                        ]
                      : []
                  }
                  onMove={handleDrillMove}
                />
              </div>

              <div
                className="lg:col-span-6 rounded-2xl border p-5 flex flex-col justify-between gap-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {currentCard.openingName || "Repertoire Drill"}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                      Card {(queueIndex % activeQueue.length) + 1} / {activeQueue.length}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Compass className="w-5 h-5 text-emerald-400" />
                    <span>Find your {currentCard.color} repertoire move!</span>
                  </h2>

                  <div
                    className="rounded-xl border p-3 text-xs font-mono leading-relaxed"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    <div style={{ color: "var(--muted)" }} className="mb-1">
                      Moves played so far:
                    </div>
                    {currentCard.lineContextSan.length > 0
                      ? currentCard.lineContextSan.join(" ")
                      : "Starting position"}
                    {currentCard.opponentLastMoveSan && (
                      <div className="mt-1.5 text-sky-300 font-semibold">
                        Opponent just played: {currentCard.opponentLastMoveSan}
                      </div>
                    )}
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

                  {!solvedCurrent && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHintArrow(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" /> Show Move Hint
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSolvedCurrent(true);
                          setWrongAttempts((w) => w + 1);
                          setFeedback({
                            ok: false,
                            msg: `Answer: ${currentCard.expectedSan} — ${currentCard.coachHint}`,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Reveal Answer
                      </button>
                    </div>
                  )}
                </div>

                {/* FSRS Grading Buttons */}
                {solvedCurrent && intervalPreview && (
                  <div className="space-y-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Rate Recall (FSRS Scheduler){wrongAttempts > 0 ? ` · ${wrongAttempts} miss(es)` : ""}:
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          { id: "again", label: "Again", cls: "border-rose-500/40 bg-rose-500/15 text-rose-300" },
                          { id: "hard", label: "Hard", cls: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
                          { id: "good", label: "Good", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
                          { id: "easy", label: "Easy", cls: "border-sky-500/40 bg-sky-500/15 text-sky-300" },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => handleGradeCard(btn.id)}
                          className={`rounded-xl border py-2 px-2 text-center cursor-pointer hover:brightness-110 ${btn.cls}`}
                        >
                          <div className="text-xs font-bold">{btn.label}</div>
                          <div className="text-[10px] opacity-80 font-mono">{intervalPreview[btn.id]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SPARRING MODE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div
            className="lg:col-span-6 rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <InteractiveBoard
              fen={sparringFen}
              orientation={sparringColor}
              interactive={!botThinking}
              allowedColor={sparringColor}
              lastMove={sparringLastMove}
              onMove={handleSparringUserMove}
            />
          </div>

          <div
            className="lg:col-span-6 rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Play-Out Sparring vs Book + Stockfish 19</span>
              </h2>
              <button
                type="button"
                onClick={() => startSparringFromOpening()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                  Your Side
                </label>
                <select
                  value={sparringColor}
                  onChange={(e) => {
                    const c = e.target.value as PlayerColor;
                    setSparringColor(c);
                    startSparringFromOpening();
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <option value="white">Play White</option>
                  <option value="black">Play Black</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
                  Bot Target Strength: <span className="font-mono">{sparringElo} Elo</span>
                </label>
                <input
                  type="range"
                  min={800}
                  max={2100}
                  step={50}
                  value={sparringElo}
                  onChange={(e) => setSparringElo(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                Start Sparring From Opening Tabia:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {openings.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => startSparringFromOpening(op)}
                    className="px-2.5 py-1 rounded-lg border text-xs hover:border-emerald-500/50 cursor-pointer"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl border p-3.5 text-xs flex items-center gap-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{botThinking ? "Engine thinking..." : sparringStatus}</span>
            </div>

            <div
              className="rounded-xl border p-3 text-xs font-mono max-h-48 overflow-y-auto scroller"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              {sparringMoves.length > 0
                ? sparringMoves.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.${m}` : m)).join(" ")
                : "Make your first move on the board to begin sparring."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading Practice Studio...</div>}>
      <PracticeContent />
    </Suspense>
  );
}
