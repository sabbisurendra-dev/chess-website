"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Crown,
  Database,
  FileText,
  Lightbulb,
  Play,
  RotateCcw,
} from "lucide-react";
import type { EndgameStructure } from "@/types/chess";
import { SEED_ENDGAMES } from "@/data/seedEndgames";
import { db, ensureSeeded } from "@/lib/storage/db";
import { pieceCount } from "@/lib/chess/fen";
import { uciToMoveObj } from "@/lib/chess/pgn";
import { stockfishEngine } from "@/lib/chess/stockfish";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";

const CATEGORIES = ["All", "King & Pawn", "Rook Endings", "Minor Piece", "Queen & Heavy"] as const;

interface TablebaseResponse {
  supported: boolean;
  category?: "win" | "loss" | "draw" | "cursed-win" | "blessed-loss" | "unknown";
  dtz?: number | null;
  moves?: { uci: string; san: string; category: string; dtz: number | null }[];
}

export default function EndgamesPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [selected, setSelected] = useState<EndgameStructure>(SEED_ENDGAMES[0]);
  const [mode, setMode] = useState<"learn" | "play">("learn");
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  // Learn mode state
  const [demoStep, setDemoStep] = useState(0);

  // Play-out mode state
  const [playFen, setPlayFen] = useState(SEED_ENDGAMES[0].fen);
  const [playMoves, setPlayMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [playStatus, setPlayStatus] = useState("Make your move to test the position!");
  const [wdlBadge, setWdlBadge] = useState<string>("");
  const [hintText, setHintText] = useState<string>("");
  const [hintArrow, setHintArrow] = useState<{ orig: string; dest: string; brush: "green" } | null>(null);
  const [opponentBusy, setOpponentBusy] = useState(false);
  const [toast, setToast] = useState("");

  const loadSettings = useCallback(async () => {
    await ensureSeeded();
    const s = await db.settings.get("singleton");
    setCompletedIds(s?.completedEndgameIds || []);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const filteredEndgames = useMemo(
    () =>
      category === "All"
        ? SEED_ENDGAMES
        : SEED_ENDGAMES.filter((e) => e.category === category),
    [category]
  );

  const selectStructure = (eg: EndgameStructure) => {
    setSelected(eg);
    setDemoStep(0);
    setPlayFen(eg.fen);
    setPlayMoves([]);
    setLastMove(undefined);
    setPlayStatus(`Goal: ${eg.goal} playing as ${eg.playerColor}.`);
    setWdlBadge("");
    setHintText("");
    setHintArrow(null);
  };

  // Compute demo FEN at demoStep
  const demoSnapshot = useMemo(() => {
    const c = new Chess(selected.fen);
    let lm: [string, string] | undefined;
    for (let i = 0; i < Math.min(demoStep, selected.demoLineSan.length); i++) {
      const mv = c.move(selected.demoLineSan[i]);
      if (!mv) break;
      if (i === demoStep - 1) lm = [mv.from, mv.to];
    }
    return { fen: c.fen(), lastMove: lm };
  }, [selected, demoStep]);

  const queryOracleMove = async (fenNow: string): Promise<{
    uci: string;
    san: string;
    source: string;
    wdlLabel: string;
  } | null> => {
    const pieces = pieceCount(fenNow);
    if (pieces <= 7) {
      try {
        const res = await fetch(`/api/lichess/tablebase?fen=${encodeURIComponent(fenNow)}`);
        const data: TablebaseResponse = await res.json();
        if (data.supported && data.moves && data.moves.length > 0) {
          const top = data.moves[0];
          const wdlLabel = `Syzygy Tablebase: ${data.category || top.category}${
            data.dtz != null ? ` (DTZ ${Math.abs(data.dtz)})` : ""
          }`;
          return { uci: top.uci, san: top.san, source: "Syzygy 7-Piece Tablebase", wdlLabel };
        }
      } catch {
        // Fallback to Stockfish
      }
    }

    const sf = await stockfishEngine.evaluatePosition(fenNow, { depth: 12, multiPv: 1 });
    if (sf.bestMoveUci) {
      return {
        uci: sf.bestMoveUci,
        san: sf.bestMoveSan,
        source: "Stockfish 19 WASM",
        wdlLabel: "Stockfish 19 Endgame Engine",
      };
    }
    return null;
  };

  const handlePlayMove = async (mv: { san: string; from: string; to: string; fenAfter: string }) => {
    if (opponentBusy) return;
    setHintArrow(null);
    setHintText("");
    const nextMoves = [...playMoves, mv.san];
    setPlayMoves(nextMoves);
    setPlayFen(mv.fenAfter);
    setLastMove([mv.from, mv.to]);

    const c = new Chess(mv.fenAfter);
    if (c.isGameOver()) {
      if (c.isCheckmate()) {
        setPlayStatus("Checkmate! Endgame structure mastered!");
        await markCompleted(selected.id);
      } else {
        setPlayStatus(
          selected.goal === "Draw"
            ? "Draw achieved! Theoretical fortress held!"
            : "Game drawn — review the winning bridge/technique and try again."
        );
        if (selected.goal === "Draw") await markCompleted(selected.id);
      }
      return;
    }

    setOpponentBusy(true);
    try {
      const oracle = await queryOracleMove(mv.fenAfter);
      if (!oracle) return;
      setWdlBadge(oracle.wdlLabel);
      const reply = c.move(uciToMoveObj(oracle.uci));
      if (reply) {
        setPlayMoves([...nextMoves, reply.san]);
        setPlayFen(c.fen());
        setLastMove([reply.from, reply.to]);

        if (c.isGameOver()) {
          setPlayStatus(
            c.isCheckmate()
              ? "Opponent delivered mate — reset and try again!"
              : selected.goal === "Draw"
                ? "Theoretical draw achieved! Well defended!"
                : "Game ended in a draw."
          );
          if (!c.isCheckmate() && selected.goal === "Draw") {
            await markCompleted(selected.id);
          }
        } else {
          setPlayStatus(`${oracle.source} played ${reply.san}. Your turn!`);
        }
      }
    } finally {
      setOpponentBusy(false);
    }
  };

  const handleRequestHint = async () => {
    setHintText(selected.successHint);
    const oracle = await queryOracleMove(playFen);
    if (oracle && oracle.uci.length >= 4) {
      setHintArrow({
        orig: oracle.uci.slice(0, 2),
        dest: oracle.uci.slice(2, 4),
        brush: "green",
      });
      setWdlBadge(oracle.wdlLabel);
      setHintText(`${selected.successHint} (Best move: ${oracle.san})`);
    }
  };

  const markCompleted = async (id: string) => {
    if (completedIds.includes(id)) return;
    const next = [...completedIds, id];
    setCompletedIds(next);
    await db.settings.update("singleton", { completedEndgameIds: next });
  };

  const handlePinEndgameToNotebook = async () => {
    const md = [
      `# ${selected.title}`,
      `- **Category:** ${selected.category} · **Goal:** ${selected.goal}`,
      "",
      "## Key Rules",
      ...selected.keyRules.map((r) => `- ${r}`),
      "",
      `[[fen:${selected.fen}]]`,
      "",
      "## Demonstration Line",
      selected.demoLineSan.join(" "),
    ].join("\n");

    await db.notes.put({
      id: `note-endgame-${selected.id}`,
      path: `04-endgame-structures/${selected.id}.md`,
      folder: "04-endgame-structures",
      title: selected.title,
      tags: ["endgame", selected.category.toLowerCase().replace(/\s+/g, "-")],
      content: md,
      pinnedFens: [selected.fen],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setToast(`Pinned "${selected.title}" into Chess Notebook (04-endgame-structures/)!`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Common Endgame Structures Lab</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Master essential Pawn, Rook, Minor Piece &amp; Queen structures — then test yourself live against 7-piece Syzygy Tablebases &amp; Stockfish 19.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                category === cat
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "hover:bg-white/5"
              }`}
              style={category !== cat ? { borderColor: "var(--border)" } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Structure Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredEndgames.map((eg) => {
          const active = eg.id === selected.id;
          const mastered = completedIds.includes(eg.id);
          return (
            <button
              key={eg.id}
              type="button"
              onClick={() => selectStructure(eg)}
              className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                active ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5"
              }`}
              style={!active ? { backgroundColor: "var(--surface)", borderColor: "var(--border)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-white/5 font-medium">{eg.category}</span>
                {mastered ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Mastered
                  </span>
                ) : (
                  <span
                    className={`font-semibold ${
                      eg.goal === "Draw" ? "text-sky-300" : "text-amber-300"
                    }`}
                  >
                    Goal: {eg.goal}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold mt-2">{eg.title}</div>
            </button>
          );
        })}
      </div>

      {/* Main Endgame Lab */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div
          className="xl:col-span-5 rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <InteractiveBoard
            fen={mode === "learn" ? demoSnapshot.fen : playFen}
            orientation={selected.playerColor}
            interactive={mode === "play" && !opponentBusy}
            allowedColor={mode === "play" ? selected.playerColor : "both"}
            lastMove={mode === "learn" ? demoSnapshot.lastMove : lastMove}
            arrows={
              mode === "learn"
                ? demoStep === 0
                  ? selected.arrows || []
                  : []
                : hintArrow
                  ? [hintArrow]
                  : []
            }
            onMove={handlePlayMove}
          />

          {mode === "learn" ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDemoStep((s) => Math.max(0, s - 1))}
                disabled={demoStep === 0}
                className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer disabled:opacity-40 flex items-center gap-1"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev Move
              </button>
              <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                Step {demoStep} / {selected.demoLineSan.length}
              </span>
              <button
                type="button"
                onClick={() => setDemoStep((s) => Math.min(selected.demoLineSan.length, s + 1))}
                disabled={demoStep === selected.demoLineSan.length}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-40 flex items-center gap-1"
              >
                Next Move <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => selectStructure(selected)}
                className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer flex items-center gap-1"
                style={{ borderColor: "var(--border)" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart Position
              </button>
              <button
                type="button"
                onClick={handleRequestHint}
                className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer flex items-center gap-1 text-amber-300"
                style={{ borderColor: "var(--border)" }}
              >
                <Lightbulb className="w-3.5 h-3.5" /> Tablebase Hint
              </button>
            </div>
          )}
        </div>

        <div
          className="xl:col-span-7 rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> {selected.category} · {selected.difficulty} · Play as{" "}
                {selected.playerColor}
              </div>
              <h2 className="text-lg font-bold mt-1">{selected.title}</h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMode("learn")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  mode === "learn" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : ""
                }`}
                style={mode !== "learn" ? { borderColor: "var(--border)" } : undefined}
              >
                1. Learn Principles
              </button>
              <button
                type="button"
                onClick={() => {
                  selectStructure(selected);
                  setMode("play");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1 ${
                  mode === "play" ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : ""
                }`}
                style={mode !== "play" ? { borderColor: "var(--border)" } : undefined}
              >
                <Play className="w-3 h-3" /> 2. Play vs Tablebase
              </button>
              <button
                type="button"
                onClick={handlePinEndgameToNotebook}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer flex items-center gap-1"
                style={{ borderColor: "var(--border)" }}
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" /> Pin to Notebook
              </button>
            </div>
          </div>

          <div
            className="rounded-xl border p-4 space-y-2"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              Core Winning / Holding Rules
            </div>
            <ul className="space-y-1.5 text-xs list-disc pl-4 leading-relaxed">
              {selected.keyRules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {mode === "learn" ? (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-sky-400">
                Guided Walkthrough Commentary
              </div>
              <p className="text-sm leading-relaxed">
                {demoStep === 0
                  ? `Starting Position (${selected.goal} for ${selected.playerColor}). Click Next Move to step through the canonical technique.`
                  : selected.demoAnnotations[demoStep - 1] || ""}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {selected.demoLineSan.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDemoStep(idx + 1)}
                    className={`px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
                      demoStep === idx + 1
                        ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-xl border p-3.5 text-xs space-y-2"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold flex items-center gap-1.5 text-sky-300">
                    {pieceCount(playFen) <= 7 ? (
                      <Database className="w-3.5 h-3.5" />
                    ) : (
                      <Cpu className="w-3.5 h-3.5" />
                    )}
                    <span>{opponentBusy ? "Calculating exact reply..." : playStatus}</span>
                  </span>
                  {wdlBadge && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[11px]">
                      {wdlBadge}
                    </span>
                  )}
                </div>
                {hintText && (
                  <div className="text-amber-300 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                    💡 {hintText}
                  </div>
                )}
              </div>

              <div
                className="rounded-xl border p-3 text-xs font-mono"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                {playMoves.length > 0 ? playMoves.join(" ") : "Drag your piece on the board to start playing."}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => markCompleted(selected.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 ${
                completedIds.includes(selected.id)
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "border hover:bg-white/5"
              }`}
              style={!completedIds.includes(selected.id) ? { borderColor: "var(--border)" } : undefined}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {completedIds.includes(selected.id) ? "Structure Mastered" : "Mark Structure Mastered"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
