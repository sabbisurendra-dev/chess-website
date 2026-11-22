"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import {
  Activity,
  BookmarkPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  ExternalLink,
  FileText,
  FlipVertical2,
  GitBranch,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import type {
  AnalyzedPly,
  MoveClassification,
  PlayerColor,
  RepertoireNode,
  StoredGame,
} from "@/types/chess";
import { db, ensureSeeded } from "@/lib/storage/db";
import { syncChessComGames } from "@/lib/storage/sync";
import { analyzeGameWithStockfish, stockfishEngine, type PositionEvalResult } from "@/lib/chess/stockfish";
import { formatEvalLabel } from "@/lib/chess/classifier";
import { diffGameWithRepertoire } from "@/lib/chess/openingGraph";
import { analyzePhaseAndClock, buildPersonalTreeAtFen, detectOpeningLeaks } from "@/lib/chess/patternMiner";
import { formatClock, formatEcoSlug, parseGamePgn } from "@/lib/chess/pgn";
import { START_FEN } from "@/lib/chess/fen";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";
import { EvalBar } from "@/components/chess/EvalBar";
import { EvalGraph } from "@/components/chess/EvalGraph";
import { QuickSavePrepModal } from "@/components/chess/QuickSavePrepModal";

const CLASS_STYLES: Record<MoveClassification, { badge: string; label: string }> = {
  brilliant: { badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40", label: "!!" },
  best: { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", label: "★" },
  good: { badge: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20", label: "✓" },
  book: { badge: "bg-sky-500/15 text-sky-300 border-sky-500/30", label: "Book" },
  inaccuracy: { badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", label: "?!" },
  mistake: { badge: "bg-orange-500/20 text-orange-300 border-orange-500/40", label: "?" },
  blunder: { badge: "bg-rose-500/20 text-rose-300 border-rose-500/40", label: "??" },
};

function GamesContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "library";
  const initialGameId = searchParams.get("game") || "";
  const initialPly = Number(searchParams.get("ply") || "0");

  const [tab, setTab] = useState<"library" | "tree" | "patterns" | "paste">(
    initialTab === "tree" || initialTab === "patterns" || initialTab === "paste" ? initialTab : "library"
  );
  const [username, setUsername] = useState("ssaabbbbii");
  const [games, setGames] = useState<StoredGame[]>([]);
  const [nodesMap, setNodesMap] = useState<Map<string, RepertoireNode>>(new Map());
  const [selectedGame, setSelectedGame] = useState<StoredGame | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<PlayerColor>("white");

  // Filters
  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<"all" | PlayerColor>("all");
  const [tcFilter, setTcFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  // Analysis & Engine
  const [analyzingGame, setAnalyzingGame] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [liveEngineEnabled, setLiveEngineEnabled] = useState(false);
  const [liveEval, setLiveEval] = useState<PositionEvalResult | null>(null);
  const [toast, setToast] = useState("");
  const analyzeAbortRef = useRef<AbortController | null>(null);

  // Quick Save Prep modal
  const [quickSaveOpen, setQuickSaveOpen] = useState(false);

  // Personal Tree Tab state
  const [treeMoves, setTreeMoves] = useState<string[]>([]);
  const [treeColor, setTreeColor] = useState<"all" | PlayerColor>("all");

  // Paste PGN Tab state
  const [pastedPgn, setPastedPgn] = useState("");
  const [pasteColor, setPasteColor] = useState<PlayerColor>("white");

  const loadData = useCallback(async () => {
    await ensureSeeded();
    const s = await db.settings.get("singleton");
    const u = (s?.chessComUsername || "ssaabbbbii").toLowerCase();
    setUsername(u);

    const [loadedGames, nodes] = await Promise.all([
      db.games.where("username").equals(u).reverse().sortBy("endTime"),
      db.nodes.toArray(),
    ]);

    setNodesMap(new Map(nodes.map((n) => [n.normFen, n])));
    setGames(loadedGames);

    if (loadedGames.length === 0) {
      await syncChessComGames({ username: u, mode: "recent", recentMonthCount: 2 }).catch(() => {});
      const fresh = await db.games.where("username").equals(u).reverse().sortBy("endTime");
      setGames(fresh);
      if (fresh[0]) {
        setSelectedGame((prev) => prev || fresh[0]);
        setOrientation(fresh[0].userColor);
      }
      return;
    }

    if (initialGameId) {
      const target = loadedGames.find((g) => g.id === initialGameId);
      if (target) {
        setSelectedGame(target);
        setOrientation(target.userColor);
        setCurrentPly(Math.min(initialPly || 0, target.movesSan.length));
        return;
      }
    }

    setSelectedGame((prev) => {
      if (prev) {
        return loadedGames.find((g) => g.id === prev.id) || prev;
      }
      if (loadedGames[0]) {
        setOrientation(loadedGames[0].userColor);
        return loadedGames[0];
      }
      return null;
    });
  }, [initialGameId, initialPly]);

  useEffect(() => {
    loadData();
    return () => analyzeAbortRef.current?.abort();
  }, [loadData]);

  // Filtered library
  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (colorFilter !== "all" && g.userColor !== colorFilter) return false;
      if (tcFilter !== "all" && g.timeClass !== tcFilter) return false;
      if (resultFilter !== "all" && g.result !== resultFilter) return false;
      if (q) {
        const hay = `${g.opponentName} ${g.ecoName} ${g.openingMovesKey}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [games, query, colorFilter, tcFilter, resultFilter]);

  // Current FEN & move list state for selected game
  const boardSnapshot = useMemo(() => {
    if (!selectedGame) {
      return { fen: START_FEN, lastMove: undefined as [string, string] | undefined, plies: [] as string[] };
    }
    const chess = new Chess();
    let lastMove: [string, string] | undefined;
    const limit = Math.min(currentPly, selectedGame.movesSan.length);
    for (let i = 0; i < limit; i++) {
      const mv = chess.move(selectedGame.movesSan[i]);
      if (!mv) break;
      if (i === limit - 1) lastMove = [mv.from, mv.to];
    }
    return {
      fen: chess.fen(),
      lastMove,
      plies: selectedGame.movesSan.slice(0, limit),
    };
  }, [selectedGame, currentPly]);

  const activeAnalyzedPly: AnalyzedPly | undefined = selectedGame?.reviewMoves?.[currentPly - 1];

  const repDiff = useMemo(() => {
    if (!selectedGame) return null;
    return diffGameWithRepertoire(selectedGame, nodesMap);
  }, [selectedGame, nodesMap]);

  // Keyboard arrow navigation in Review view
  useEffect(() => {
    if (tab !== "library" || !selectedGame) return;
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPly((p) => Math.min(selectedGame.movesSan.length, p + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, selectedGame]);

  // Live Stockfish Explorer when toggled ON
  useEffect(() => {
    if (!liveEngineEnabled || tab !== "library") return;
    let cancelled = false;
    stockfishEngine
      .evaluatePosition(boardSnapshot.fen, {
        depth: 13,
        multiPv: 3,
        onProgress: (res) => {
          if (!cancelled) setLiveEval(res);
        },
      })
      .then((res) => {
        if (!cancelled) setLiveEval(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [liveEngineEnabled, boardSnapshot.fen, tab]);

  const handleAnalyzeSelected = async () => {
    if (!selectedGame || analyzingGame) return;
    analyzeAbortRef.current?.abort();
    const ctrl = new AbortController();
    analyzeAbortRef.current = ctrl;
    setAnalyzingGame(true);
    setAnalyzeProgress({ done: 0, total: selectedGame.movesSan.length });

    try {
      const result = await analyzeGameWithStockfish(selectedGame, nodesMap, {
        depth: 10,
        signal: ctrl.signal,
        onProgress: (done, total) => setAnalyzeProgress({ done, total }),
      });

      const updated: StoredGame = {
        ...selectedGame,
        analyzed: true,
        whiteAccuracy: result.whiteAccuracy,
        blackAccuracy: result.blackAccuracy,
        userAccuracy: result.userAccuracy,
        counts: result.counts,
        reviewMoves: result.plies,
      };

      await db.games.put(updated);
      if (result.extractedBlunders.length > 0) {
        await db.personalBlunders.bulkPut(result.extractedBlunders);
      }

      setSelectedGame(updated);
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setToast(
        `Analysis complete! Accuracy: ${result.userAccuracy}% · Extracted ${result.extractedBlunders.length} tactical blunder puzzle(s) into Tactics Practice.`
      );
    } catch (err) {
      if ((err as Error).message !== "Analysis cancelled.") {
        setToast(err instanceof Error ? err.message : "Engine analysis error.");
      }
    } finally {
      setAnalyzingGame(false);
    }
  };

  const handleBatchScan = async () => {
    if (batchProgress || analyzingGame) return;
    const targets = filteredGames.filter((g) => !g.analyzed).slice(0, 5);
    if (targets.length === 0) {
      setToast("All visible recent games are already analyzed!");
      return;
    }
    let blundersAdded = 0;
    for (let i = 0; i < targets.length; i++) {
      const g = targets[i];
      setBatchProgress(`Scanning game ${i + 1}/${targets.length}: vs ${g.opponentName}...`);
      try {
        const res = await analyzeGameWithStockfish(g, nodesMap, { depth: 8 });
        const updated: StoredGame = {
          ...g,
          analyzed: true,
          whiteAccuracy: res.whiteAccuracy,
          blackAccuracy: res.blackAccuracy,
          userAccuracy: res.userAccuracy,
          counts: res.counts,
          reviewMoves: res.plies,
        };
        await db.games.put(updated);
        if (res.extractedBlunders.length > 0) {
          await db.personalBlunders.bulkPut(res.extractedBlunders);
          blundersAdded += res.extractedBlunders.length;
        }
        setGames((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      } catch {
        // continue to next game
      }
    }
    setBatchProgress(null);
    setToast(`Batch scan finished (${targets.length} games). Added ${blundersAdded} puzzles to Personal Blunders!`);
  };

  const handlePinToNotebook = async () => {
    if (!selectedGame) return;
    const noteId = `note-game-${selectedGame.id}`;
    const moveNum = Math.ceil(currentPly / 2);
    const title = `Game Note: vs ${selectedGame.opponentName} (${selectedGame.ecoName})`;
    const snippet = [
      `# ${title}`,
      "",
      `- **Date:** ${new Date(selectedGame.endTime * 1000).toLocaleDateString()}`,
      `- **Color:** ${selectedGame.userColor} · **Result:** ${selectedGame.result.toUpperCase()}`,
      `- **Link:** ${selectedGame.url || "Pasted PGN"}`,
      "",
      `## Key Position (Move ${moveNum || 1})`,
      `[[fen:${boardSnapshot.fen}]]`,
      activeAnalyzedPly ? `\n**Coach Note:** ${activeAnalyzedPly.coachExplanation}` : "",
      `\n[[game:${selectedGame.id}#${currentPly}]]`,
    ].join("\n");

    await db.notes.put({
      id: noteId,
      path: `05-my-games-review/annotated-key-games/${selectedGame.id}.md`,
      folder: "05-my-games-review/annotated-key-games",
      title,
      tags: ["game-review", selectedGame.userColor, selectedGame.result],
      content: snippet,
      pinnedFens: [boardSnapshot.fen],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setToast(`Pinned position (Move ${moveNum}) into Chess Notebook -> annotated-key-games!`);
  };

  // Personal Tree Tab computed state
  const treeFen = useMemo(() => {
    const c = new Chess();
    for (const san of treeMoves) {
      if (!c.move(san)) break;
    }
    return c.fen();
  }, [treeMoves]);

  const treeStats = useMemo(
    () => buildPersonalTreeAtFen(games, treeFen, treeColor),
    [games, treeFen, treeColor]
  );

  const leaks = useMemo(() => detectOpeningLeaks(games, 2), [games]);
  const diagnostics = useMemo(() => analyzePhaseAndClock(games), [games]);

  // Display eval values (live engine overrides precomputed ply eval if enabled)
  const displayEvalCp =
    liveEngineEnabled && liveEval?.lines[0]
      ? liveEval.lines[0].cpWhite
      : activeAnalyzedPly?.evalAfterCp ?? 0;
  const displayMate =
    liveEngineEnabled && liveEval?.lines[0]
      ? liveEval.lines[0].mateWhite
      : activeAnalyzedPly?.mateAfter ?? null;

  const handleLoadPastedPgn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGamePgn(pastedPgn);
    if (parsed.movesSan.length === 0) {
      setToast("Could not parse any valid chess moves from the pasted PGN.");
      return;
    }
    const eco = formatEcoSlug(parsed.headers.ECOUrl, parsed.headers);
    const id = `custom-pgn-${Date.now()}`;
    const customGame: StoredGame = {
      id,
      username,
      url: parsed.headers.Link || "",
      pgn: pastedPgn,
      endTime: Math.floor(Date.now() / 1000),
      yearMonth: "custom",
      timeClass: "rapid",
      timeControl: parsed.headers.TimeControl || "600",
      rated: false,
      rules: "chess",
      userColor: pasteColor,
      userRating: 0,
      opponentName:
        pasteColor === "white"
          ? parsed.headers.Black || "Custom Opponent"
          : parsed.headers.White || "Custom Opponent",
      opponentRating: 0,
      result:
        parsed.headers.Result === "1-0"
          ? pasteColor === "white"
            ? "win"
            : "loss"
          : parsed.headers.Result === "0-1"
            ? pasteColor === "black"
              ? "win"
              : "loss"
            : "draw",
      termination: parsed.headers.Termination || "",
      ecoSlug: eco.slug,
      ecoName: eco.name,
      openingMovesKey: parsed.openingMovesKey,
      movesSan: parsed.movesSan,
      clocksSec: parsed.clocksSec,
    };
    await db.games.put(customGame);
    setGames((prev) => [customGame, ...prev]);
    setSelectedGame(customGame);
    setOrientation(pasteColor);
    setCurrentPly(0);
    setTab("library");
    setToast("Loaded PGN into Review Studio! Click Analyze Full Game to run Stockfish 19.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Games Review &amp; Pattern Miner</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Unlimited Stockfish 19 WASM review, plain-English coach explanations, OpeningTree explorer &amp; leak diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "library", label: "Review Studio" },
              { id: "tree", label: "My Opening Tree" },
              { id: "patterns", label: "Patterns & Leaks" },
              { id: "paste", label: "Paste PGN" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                tab === t.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "hover:bg-white/5"
              }`}
              style={tab !== t.id ? { borderColor: "var(--border)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: REVIEW STUDIO */}
      {tab === "library" && (
        <div className="space-y-5">
          {selectedGame && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Board Column */}
              <div
                className="xl:col-span-6 rounded-2xl border p-4 space-y-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="font-semibold">
                    {selectedGame.userColor === "black" ? `${username} (${selectedGame.userRating})` : `${selectedGame.opponentName} (${selectedGame.opponentRating})`}
                  </div>
                  {activeAnalyzedPly?.clockRemainingSec != null && (
                    <span className="font-mono px-2 py-0.5 rounded bg-white/5">
                      ⏱ {formatClock(activeAnalyzedPly.clockRemainingSec)}
                    </span>
                  )}
                </div>

                <div className="flex items-stretch gap-2.5">
                  <EvalBar cpWhite={displayEvalCp} mateWhite={displayMate} orientation={orientation} />
                  <div className="flex-1 min-w-0">
                    <InteractiveBoard
                      fen={boardSnapshot.fen}
                      orientation={orientation}
                      interactive={false}
                      lastMove={boardSnapshot.lastMove}
                      arrows={
                        activeAnalyzedPly &&
                        (activeAnalyzedPly.classification === "blunder" ||
                          activeAnalyzedPly.classification === "mistake") &&
                        activeAnalyzedPly.bestMoveUci.length >= 4
                          ? [
                              {
                                orig: activeAnalyzedPly.bestMoveUci.slice(0, 2),
                                dest: activeAnalyzedPly.bestMoveUci.slice(2, 4),
                                brush: "green",
                              },
                            ]
                          : []
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="font-semibold">
                    {selectedGame.userColor === "white" ? `${username} (${selectedGame.userRating})` : `${selectedGame.opponentName} (${selectedGame.opponentRating})`}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                      className="p-1.5 rounded-lg border hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      title="Flip board"
                    >
                      <FlipVertical2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPly(0)}
                      className="p-1.5 rounded-lg border hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      aria-label="Start of game"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded-lg border hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      aria-label="Previous move"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPly((p) => Math.min(selectedGame.movesSan.length, p + 1))}
                      className="p-1.5 rounded-lg border hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      aria-label="Next move"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPly(selectedGame.movesSan.length)}
                      className="p-1.5 rounded-lg border hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      aria-label="End of game"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedGame.reviewMoves && selectedGame.reviewMoves.length > 0 && (
                  <EvalGraph
                    plies={selectedGame.reviewMoves}
                    currentPly={currentPly}
                    onSelectPly={(p) => setCurrentPly(p)}
                  />
                )}
              </div>

              {/* Coach & Move List Column */}
              <div
                className="xl:col-span-6 rounded-2xl border p-4 flex flex-col gap-3.5"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          selectedGame.result === "win"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : selectedGame.result === "draw"
                              ? "bg-slate-500/20 text-slate-300"
                              : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {selectedGame.result}
                      </span>
                      <h2 className="text-base font-bold">{selectedGame.ecoName}</h2>
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
                      <span>{new Date(selectedGame.endTime * 1000).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="capitalize">{selectedGame.timeClass}</span>
                      {selectedGame.userAccuracy != null && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400 font-semibold">
                            Accuracy: {selectedGame.userAccuracy}%
                          </span>
                        </>
                      )}
                      {selectedGame.url && (
                        <a
                          href={selectedGame.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          Chess.com <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAnalyzeSelected}
                    disabled={analyzingGame}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Cpu className={`w-4 h-4 ${analyzingGame ? "animate-spin" : ""}`} />
                    <span>
                      {analyzingGame
                        ? `Analyzing ${analyzeProgress.done}/${analyzeProgress.total}...`
                        : selectedGame.analyzed
                          ? "Re-Analyze (Stockfish 19)"
                          : "Analyze Full Game (Free)"}
                    </span>
                  </button>
                </div>

                {/* Repertoire Diff Banner */}
                {repDiff && (
                  <div
                    className="rounded-xl border px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 flex-wrap"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-sky-400 shrink-0" />
                      {repDiff.firstDeviationPly ? (
                        <span>
                          In your saved prep through ply {repDiff.inBookPlies}.{" "}
                          <strong>
                            {repDiff.deviatedBy === "user" ? "You" : "Opponent"} deviated
                          </strong>{" "}
                          at move {Math.ceil(repDiff.firstDeviationPly / 2)} with{" "}
                          <code className="font-mono font-bold">{repDiff.deviationMoveSan}</code>
                          {repDiff.expectedUserMoves.length > 0 &&
                            ` (saved: ${repDiff.expectedUserMoves.join(", ")})`}
                          .
                        </span>
                      ) : repDiff.inBookPlies > 0 ? (
                        <span>Matched your Opening Prep for {repDiff.inBookPlies} plies.</span>
                      ) : (
                        <span>Position not yet in your saved Opening Prep tree.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickSaveOpen(true)}
                      className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      + Save Line to Prep
                    </button>
                  </div>
                )}

                {/* Chessiro-Style Plain-English Coach Box */}
                <div
                  className="rounded-xl border p-3.5 space-y-2"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coach Review</span>
                    </div>
                    {activeAnalyzedPly && (
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-semibold uppercase ${
                          CLASS_STYLES[activeAnalyzedPly.classification].badge
                        }`}
                      >
                        {activeAnalyzedPly.moveSan} · {activeAnalyzedPly.classification}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">
                    {activeAnalyzedPly
                      ? activeAnalyzedPly.coachExplanation
                      : currentPly === 0
                        ? "Click Analyze Full Game (or step through moves with →) to get Stockfish 19 move evaluations and plain-English coaching."
                        : `Move ${Math.ceil(currentPly / 2)}: ${
                            selectedGame.movesSan[currentPly - 1]
                          }. Run Stockfish 19 analysis to see move classification, evaluation swing, and best continuation.`}
                  </p>
                </div>

                {/* Live Engine Lines Toggle */}
                <div
                  className="rounded-xl border p-3 space-y-2"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={liveEngineEnabled}
                        onChange={(e) => setLiveEngineEnabled(e.target.checked)}
                      />
                      <span>Live Stockfish 19 Multi-PV Lines (depth 13)</span>
                    </label>
                    {liveEngineEnabled && liveEval && (
                      <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                        d={liveEval.depth}
                      </span>
                    )}
                  </div>
                  {liveEngineEnabled && (
                    <div className="space-y-1 text-xs font-mono">
                      {liveEval?.lines.length ? (
                        liveEval.lines.map((l) => (
                          <div key={l.multipv} className="flex items-center gap-2 truncate">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 w-14 text-center shrink-0">
                              {formatEvalLabel(l.cpWhite, l.mateWhite)}
                            </span>
                            <span className="truncate">{l.pvSan.join(" ")}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "var(--muted)" }}>Evaluating current board...</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Action Bar */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickSaveOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save Moves to Opening Prep</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePinToNotebook}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pin Position to Notebook</span>
                  </button>
                </div>

                {/* Move List */}
                <div
                  className="rounded-xl border p-3 max-h-56 overflow-y-auto scroller"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs font-mono">
                    {selectedGame.movesSan.map((san, idx) => {
                      const plyNum = idx + 1;
                      const analyzed = selectedGame.reviewMoves?.[idx];
                      const active = currentPly === plyNum;
                      const cls = analyzed?.classification;
                      return (
                        <button
                          key={plyNum}
                          type="button"
                          onClick={() => setCurrentPly(plyNum)}
                          className={`px-2 py-1 rounded text-left flex items-center justify-between gap-1 cursor-pointer ${
                            active
                              ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <span>
                            {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : "... "}
                            {san}
                          </span>
                          {cls && (cls === "blunder" || cls === "mistake" || cls === "inaccuracy" || cls === "brilliant") && (
                            <span
                              className={`px-1 rounded text-[10px] border ${CLASS_STYLES[cls].badge}`}
                            >
                              {CLASS_STYLES[cls].label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter & Game Library Table */}
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 opacity-60" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter opponent or opening..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border text-xs w-52"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  />
                </div>
                <select
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value as "all" | PlayerColor)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <option value="all">All Colors</option>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
                <select
                  value={tcFilter}
                  onChange={(e) => setTcFilter(e.target.value)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <option value="all">All Speeds</option>
                  <option value="rapid">Rapid</option>
                  <option value="blitz">Blitz</option>
                  <option value="bullet">Bullet</option>
                  <option value="daily">Daily</option>
                </select>
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <option value="all">All Results</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="draw">Draws</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleBatchScan}
                disabled={Boolean(batchProgress) || analyzingGame}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/5 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${batchProgress ? "animate-spin" : ""}`} />
                <span>{batchProgress || "Quick-Scan 5 Unanalyzed Games"}</span>
              </button>
            </div>

            <div className="table-wrapper max-h-[420px]">
              <table className="chess-table responsive-stack">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Color</th>
                    <th>Opening</th>
                    <th>Speed</th>
                    <th>Result</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.slice(0, 80).map((g) => {
                    const isSelected = selectedGame?.id === g.id;
                    return (
                      <tr
                        key={g.id}
                        onClick={() => {
                          setSelectedGame(g);
                          setOrientation(g.userColor);
                          setCurrentPly(0);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`cursor-pointer ${isSelected ? "bg-emerald-500/10" : ""}`}
                      >
                        <th className="font-mono text-xs whitespace-nowrap">
                          {new Date(g.endTime * 1000).toLocaleDateString()}
                        </th>
                        <td data-label="Opponent" className="font-medium">
                          {g.opponentName} ({g.opponentRating})
                        </td>
                        <td data-label="Color" className="capitalize">
                          {g.userColor}
                        </td>
                        <td data-label="Opening" className="max-w-[260px] truncate" title={g.ecoName}>
                          {g.ecoName}
                        </td>
                        <td data-label="Speed" className="capitalize text-xs">
                          {g.timeClass}
                        </td>
                        <td data-label="Result">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              g.result === "win"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : g.result === "draw"
                                  ? "bg-slate-500/20 text-slate-300"
                                  : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {g.result}
                          </span>
                        </td>
                        <td data-label="Accuracy" className="font-mono text-xs">
                          {g.analyzed && g.userAccuracy != null ? (
                            <span className="text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {g.userAccuracy}%
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>Click to review</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERSONAL OPENING TREE */}
      {tab === "tree" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div
            className="lg:col-span-5 rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <InteractiveBoard
              fen={treeFen}
              orientation={treeColor === "black" ? "black" : "white"}
              interactive={true}
              onMove={(mv) => setTreeMoves((prev) => [...prev, mv.san])}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setTreeMoves((p) => p.slice(0, -1))}
                disabled={treeMoves.length === 0}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                ← Back 1 Move
              </button>
              <button
                type="button"
                onClick={() => setTreeMoves([])}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Reset Start
              </button>
            </div>
            <div className="text-xs font-mono p-2 rounded-lg border" style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}>
              {treeMoves.length ? treeMoves.join(" ") : "Start Position"}
            </div>
          </div>

          <div
            className="lg:col-span-7 rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold">
                  Personal OpeningTree Explorer ({treeStats.totalReached} matching games)
                </h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Click any move row or play moves directly on the board to see your real W/D/L percentages.
                </p>
              </div>
              <select
                value={treeColor}
                onChange={(e) => setTreeColor(e.target.value as "all" | PlayerColor)}
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                <option value="all">Both Colors</option>
                <option value="white">As White</option>
                <option value="black">As Black</option>
              </select>
            </div>

            <div className="table-wrapper">
              <table className="chess-table">
                <thead>
                  <tr>
                    <th>Move</th>
                    <th>Games</th>
                    <th>Score</th>
                    <th>W / D / L</th>
                    <th>Avg Opp</th>
                  </tr>
                </thead>
                <tbody>
                  {treeStats.moves.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-xs" style={{ color: "var(--muted)" }}>
                        No synced games reached this exact position yet.
                      </td>
                    </tr>
                  ) : (
                    treeStats.moves.map((m) => (
                      <tr
                        key={m.uci}
                        onClick={() => setTreeMoves((prev) => [...prev, m.san])}
                        className="cursor-pointer"
                      >
                        <th className="font-mono font-bold text-emerald-400">{m.san}</th>
                        <td className="font-mono">{m.games}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs w-9">{m.winRate}%</span>
                            <div className="w-28 h-2 rounded-full overflow-hidden flex bg-slate-800">
                              <div
                                className="bg-emerald-500"
                                style={{ width: `${(m.wins / m.games) * 100}%` }}
                              />
                              <div
                                className="bg-slate-400"
                                style={{ width: `${(m.draws / m.games) * 100}%` }}
                              />
                              <div
                                className="bg-rose-500"
                                style={{ width: `${(m.losses / m.games) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs">
                          {m.wins}-{m.draws}-{m.losses}
                        </td>
                        <td className="font-mono text-xs">{m.avgOpponentRating || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PATTERNS & LEAKS */}
      {tab === "patterns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Average Analyzed Accuracy</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {diagnostics.avgAccuracy != null ? `${diagnostics.avgAccuracy}%` : "Run Scan"}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Across {diagnostics.analyzedGames} analyzed games
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Opening Blunders</div>
              <div className="text-2xl font-bold font-mono mt-1 text-amber-400">
                {diagnostics.blundersByPhase.opening}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>Plies 1–18</div>
            </div>
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Middlegame Blunders</div>
              <div className="text-2xl font-bold font-mono mt-1 text-orange-400">
                {diagnostics.blundersByPhase.middlegame}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>Tactical battles</div>
            </div>
            <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Endgame Blunders</div>
              <div className="text-2xl font-bold font-mono mt-1 text-rose-400">
                {diagnostics.blundersByPhase.endgame}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>Conversions &amp; saves</div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> All Opening Performances &amp; Leaks
            </h2>
            <div className="table-wrapper max-h-[420px]">
              <table className="chess-table responsive-stack">
                <thead>
                  <tr>
                    <th>Opening</th>
                    <th>Color</th>
                    <th>Games</th>
                    <th>W-D-L</th>
                    <th>Win Score</th>
                    <th>Leak Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {leaks.slice(0, 25).map((l) => (
                    <tr key={`${l.userColor}:${l.ecoName}`}>
                      <th className="font-medium">{l.ecoName}</th>
                      <td data-label="Color" className="capitalize">{l.userColor}</td>
                      <td data-label="Games" className="font-mono">{l.games}</td>
                      <td data-label="W-D-L" className="font-mono text-xs">{l.wins}-{l.draws}-{l.losses}</td>
                      <td data-label="Score" className="font-mono">{l.winRate}%</td>
                      <td data-label="Priority" className="font-mono text-amber-400">{l.leakScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PASTE PGN */}
      {tab === "paste" && (
        <form
          onSubmit={handleLoadPastedPgn}
          className="rounded-2xl border p-5 space-y-4 max-w-3xl"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" /> Paste Any PGN for Free Unlimited Review
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Works with Chess.com, Lichess, OTB tournament PGNs, or study lines.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Your Color
            </label>
            <select
              value={pasteColor}
              onChange={(e) => setPasteColor(e.target.value as PlayerColor)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </div>
          <textarea
            rows={8}
            required
            value={pastedPgn}
            onChange={(e) => setPastedPgn(e.target.value)}
            placeholder="Paste PGN here... e.g. 1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4..."
            className="w-full rounded-xl border p-3 text-xs font-mono"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" /> Load into Review Studio
          </button>
        </form>
      )}

      <QuickSavePrepModal
        open={quickSaveOpen}
        onClose={() => setQuickSaveOpen(false)}
        movesSan={boardSnapshot.plies.length > 0 ? boardSnapshot.plies : selectedGame?.movesSan.slice(0, 12) || []}
        defaultColor={selectedGame?.userColor || "white"}
        defaultNote={activeAnalyzedPly?.coachExplanation || ""}
        onSaved={(msg) => {
          setToast(msg);
          loadData();
        }}
      />
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading Games &amp; Review Studio...</div>}>
      <GamesContent />
    </Suspense>
  );
}
