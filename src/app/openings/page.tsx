"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import {
  ArrowRight,
  BookmarkPlus,
  ChevronLeft,
  Compass,
  Cpu,
  Download,
  FlipVertical2,
  GitBranch,
  Globe,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import type {
  BoardArrow,
  BoardCircle,
  OpeningSummary,
  PatternFamily,
  PlayerColor,
  RepertoireNode,
} from "@/types/chess";
import { db, ensureSeeded, saveNodeCustomAnnotations, saveQuickPrepLine } from "@/lib/storage/db";
import { normalizeFen, START_FEN } from "@/lib/chess/fen";
import { exportRepertoireToPgn } from "@/lib/chess/openingGraph";
import { parseGamePgn } from "@/lib/chess/pgn";
import { stockfishEngine, type PositionEvalResult } from "@/lib/chess/stockfish";
import { formatEvalLabel } from "@/lib/chess/classifier";
import { downloadTextFile } from "@/lib/export/exporters";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";
import { QuickSavePrepModal } from "@/components/chess/QuickSavePrepModal";
import { ModalDialog } from "@/components/layout/ModalDialog";

interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
}

function OpeningsContent() {
  const searchParams = useSearchParams();
  const initialFamily = searchParams.get("family") || "";
  const initialFen = searchParams.get("fen") || "";

  const [families, setFamilies] = useState<PatternFamily[]>([]);
  const [openings, setOpenings] = useState<OpeningSummary[]>([]);
  const [nodesMap, setNodesMap] = useState<Map<string, RepertoireNode>>(new Map());
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");

  const [moveHistorySan, setMoveHistorySan] = useState<string[]>([]);
  const [customStartFen, setCustomStartFen] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<PlayerColor>("white");

  const [noteDraft, setNoteDraft] = useState("");
  const [arrowsDraft, setArrowsDraft] = useState<BoardArrow[]>([]);
  const [circlesDraft, setCirclesDraft] = useState<BoardCircle[]>([]);
  const [toast, setToast] = useState("");

  // Explorer & Engine
  const [explorerMoves, setExplorerMoves] = useState<ExplorerMove[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerSource, setExplorerSource] = useState<"masters" | "lichess">("masters");
  const [explorerNote, setExplorerNote] = useState("");
  const [lichessToken, setLichessToken] = useState("");
  const [showEngine, setShowEngine] = useState(false);
  const [engineEval, setEngineEval] = useState<PositionEvalResult | null>(null);

  // Modals
  const [quickSaveOpen, setQuickSaveOpen] = useState(false);
  const [importPgnOpen, setImportPgnOpen] = useState(false);
  const [importPgnText, setImportPgnText] = useState("");
  const [importOpeningName, setImportOpeningName] = useState("");
  const [newFamilyOpen, setNewFamilyOpen] = useState(false);
  const [newFamName, setNewFamName] = useState("");
  const [newFamColor, setNewFamColor] = useState<PlayerColor>("white");
  const [newFamSubtitle, setNewFamSubtitle] = useState("");
  const [newFamDna, setNewFamDna] = useState("");

  const loadGraph = useCallback(async () => {
    await ensureSeeded();
    const [fams, ops, nodes] = await Promise.all([
      db.families.toArray(),
      db.openings.toArray(),
      db.nodes.toArray(),
    ]);
    setFamilies(fams);
    setOpenings(ops);
    setNodesMap(new Map(nodes.map((n) => [n.normFen, n])));

    setSelectedFamilyId((prev) => {
      if (prev && fams.some((f) => f.id === prev)) return prev;
      if (initialFamily && fams.some((f) => f.id === initialFamily)) {
        const fam = fams.find((f) => f.id === initialFamily);
        if (fam) setOrientation(fam.color);
        return initialFamily;
      }
      return fams[0]?.id || "";
    });

    if (initialFen) {
      setCustomStartFen(initialFen);
    }
  }, [initialFamily, initialFen]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const activeFamily = useMemo(
    () => families.find((f) => f.id === selectedFamilyId) || families[0],
    [families, selectedFamilyId]
  );

  const familyOpenings = useMemo(
    () => openings.filter((o) => o.familyId === activeFamily?.id),
    [openings, activeFamily]
  );

  // Current FEN computed from start + moveHistorySan
  const boardSnapshot = useMemo(() => {
    const chess = new Chess(customStartFen || START_FEN);
    let lastMove: [string, string] | undefined;
    for (const san of moveHistorySan) {
      const mv = chess.move(san);
      if (!mv) break;
      lastMove = [mv.from, mv.to];
    }
    const fen = chess.fen();
    return { fen, normFen: normalizeFen(fen), lastMove };
  }, [customStartFen, moveHistorySan]);

  const activeNode = nodesMap.get(boardSnapshot.normFen);

  // Sync draft annotations whenever position node changes
  useEffect(() => {
    setNoteDraft(activeNode?.notes || "");
    setArrowsDraft(activeNode?.arrows || []);
    setCirclesDraft(activeNode?.circles || []);
  }, [boardSnapshot.normFen, activeNode]);

  // Query Lichess Opening Explorer for current FEN
  useEffect(() => {
    let cancelled = false;
    setExplorerLoading(true);
    setExplorerNote("");
    const headers: Record<string, string> = {};
    if (lichessToken.trim()) headers["x-lichess-token"] = lichessToken.trim();

    fetch(
      `/api/lichess/explorer?fen=${encodeURIComponent(boardSnapshot.fen)}&source=${explorerSource}`,
      { headers }
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.moves)) {
          setExplorerMoves(d.moves.slice(0, 7));
        } else {
          setExplorerMoves([]);
        }
        if (d.authRequiredForClub) {
          setExplorerNote("Club Lichess Explorer requires a personal Lichess token; showing Masters DB automatically.");
        } else if (d.error) {
          setExplorerNote(d.error);
        }
      })
      .catch(() => {
        if (!cancelled) setExplorerMoves([]);
      })
      .finally(() => {
        if (!cancelled) setExplorerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boardSnapshot.fen, explorerSource, lichessToken]);

  // Optional live Stockfish check
  useEffect(() => {
    if (!showEngine) return;
    let cancelled = false;
    stockfishEngine
      .evaluatePosition(boardSnapshot.fen, {
        depth: 12,
        multiPv: 2,
        onProgress: (r) => {
          if (!cancelled) setEngineEval(r);
        },
      })
      .then((r) => {
        if (!cancelled) setEngineEval(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showEngine, boardSnapshot.fen]);

  const handleSaveNodeNotes = async () => {
    const saved = await saveNodeCustomAnnotations({
      normFen: boardSnapshot.normFen,
      notes: noteDraft,
      arrows: arrowsDraft,
      circles: circlesDraft,
    });
    setNodesMap((prev) => {
      const next = new Map(prev);
      next.set(saved.normFen, saved);
      return next;
    });
    setToast("Saved position note & drawn arrows!");
  };

  const handleLoadMoves = (moves: string[], color: PlayerColor) => {
    setCustomStartFen(null);
    setMoveHistorySan(moves);
    setOrientation(color);
  };

  const handleDemonstrateTransposition = () => {
    const latFam = families.find((f) => f.id === "black-f5-counter-gambits");
    if (latFam) setSelectedFamilyId(latFam.id);
    setCustomStartFen(null);
    setMoveHistorySan(["e4", "e5", "Nf3", "Nc6", "Bc4", "f5"]);
    setOrientation("black");
    setToast("Loaded the Latvian ↔ Rousseau Transposition Hub! Notice both openings share this exact node.");
  };

  const handleImportPgn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFamily) return;
    const parsed = parseGamePgn(importPgnText);
    if (parsed.movesSan.length === 0) {
      setToast("No valid moves parsed from PGN.");
      return;
    }
    const name = importOpeningName.trim() || "Imported Line";
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const res = await saveQuickPrepLine({
      movesSan: parsed.movesSan.slice(0, 24),
      color: activeFamily.color,
      familyId: activeFamily.id,
      openingId: id,
      openingName: name,
      tags: ["#plan"],
    });
    await loadGraph();
    setMoveHistorySan(parsed.movesSan.slice(0, 8));
    setImportPgnOpen(false);
    setImportPgnText("");
    setImportOpeningName("");
    setToast(`Imported "${name}" (+${res.drillCardsAdded} FSRS drill cards).`);
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamName.trim()) return;
    const id = `family-${newFamName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    const fam: PatternFamily = {
      id,
      name: newFamName.trim(),
      color: newFamColor,
      subtitle: newFamSubtitle.trim() || "Custom clubbed opening system",
      dnaSummary: newFamDna.trim() || "Custom opening pattern family.",
      sharedBlueprint: [newFamDna.trim() || "Shared opening development & pawn-break blueprint."],
      keyBenefits: ["Grouped under one strategic philosophy for faster learning."],
      comparisonRows: [],
      openingsIncluded: [],
      createdAt: Date.now(),
    };
    await db.families.put(fam);
    setFamilies((prev) => [...prev, fam]);
    setSelectedFamilyId(fam.id);
    setOrientation(fam.color);
    setNewFamilyOpen(false);
    setNewFamName("");
    setNewFamSubtitle("");
    setNewFamDna("");
    setToast(`Created Pattern Family "${fam.name}"!`);
  };

  const allTranspositionNodes = useMemo(
    () => [...nodesMap.values()].filter((n) => n.transpositionNames.length > 1),
    [nodesMap]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Pattern-Clubbed Opening Prep &amp; Transposition Graph
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Group related systems (Vienna + Grand Prix, Latvian ↔ Rousseau, King&apos;s Indian), draw arrows, and bridge transpositions automatically by FEN.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDemonstrateTransposition}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/35 text-sky-300 text-xs font-semibold hover:bg-sky-500/25 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Latvian ↔ Rousseau Transposition ({allTranspositionNodes.length} hubs)</span>
          </button>

          <button
            type="button"
            onClick={() => setNewFamilyOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Plus className="w-3.5 h-3.5" /> New Family
          </button>

          <button
            type="button"
            onClick={() => setImportPgnOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload className="w-3.5 h-3.5" /> Import PGN
          </button>

          <button
            type="button"
            onClick={() => {
              const pgn = exportRepertoireToPgn([...nodesMap.values()], activeFamily?.id);
              downloadTextFile(pgn, `${activeFamily?.id || "repertoire"}.pgn`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Download className="w-3.5 h-3.5" /> Export PGN
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Pattern Family Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {families.map((fam) => {
          const active = fam.id === activeFamily?.id;
          return (
            <button
              key={fam.id}
              type="button"
              onClick={() => {
                setSelectedFamilyId(fam.id);
                setOrientation(fam.color);
              }}
              className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                active ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5"
              }`}
              style={!active ? { backgroundColor: "var(--surface)", borderColor: "var(--border)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    fam.color === "white"
                      ? "bg-slate-100 text-slate-900"
                      : "bg-slate-800 text-slate-100 border border-slate-600"
                  }`}
                >
                  {fam.color}
                </span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {fam.openingsIncluded.length} branches
                </span>
              </div>
              <div className="text-sm font-bold mt-2">{fam.name}</div>
              <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--muted)" }}>
                {fam.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Graph Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Board + Controls */}
        <div
          className="xl:col-span-5 rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <InteractiveBoard
            fen={boardSnapshot.fen}
            orientation={orientation}
            interactive={true}
            lastMove={boardSnapshot.lastMove}
            arrows={arrowsDraft}
            circles={circlesDraft}
            onMove={(mv) => {
              setMoveHistorySan((prev) => [...prev, mv.san]);
            }}
            onDrawChange={(newArrows, newCircles) => {
              setArrowsDraft(newArrows);
              setCirclesDraft(newCircles);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCustomStartFen(null);
                  setMoveHistorySan([]);
                }}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer flex items-center gap-1"
                style={{ borderColor: "var(--border)" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Start
              </button>
              <button
                type="button"
                onClick={() => setMoveHistorySan((p) => p.slice(0, -1))}
                disabled={moveHistorySan.length === 0}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer flex items-center gap-1 disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
                title="Flip board"
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setQuickSaveOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" /> Quick-Save Line
            </button>
          </div>

          <div
            className="rounded-lg border px-3 py-2 text-xs font-mono"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            {moveHistorySan.length > 0
              ? moveHistorySan.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.${m}` : m)).join(" ")
              : "Starting Position — play moves or select a branch"}
          </div>

          {/* Family Opening Branch Shortcuts */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Jump to Branch in {activeFamily?.name}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {familyOpenings.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => handleLoadMoves(op.startMovesSan, op.color)}
                  className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:border-emerald-500/50 cursor-pointer"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  {op.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Transpositions, Saved Repertoire Continuations, Notes, Explorer */}
        <div className="xl:col-span-7 space-y-4">
          {/* Transposition & Repertoire Continuations Card */}
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold">Saved Repertoire Tree &amp; Transpositions</h2>
              </div>
              {activeFamily && (
                <Link
                  href={`/practice?family=${encodeURIComponent(activeFamily.id)}`}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 inline-flex items-center gap-1"
                >
                  <Compass className="w-3.5 h-3.5" /> Drill This Family
                </Link>
              )}
            </div>

            {activeNode && activeNode.transpositionNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeNode.transpositionNames.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    Transposes ↔ ({activeNode.transpositionNames.length} openings meet here!)
                  </span>
                )}
                {activeNode.transpositionNames.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded-full text-[11px] border"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Next Saved Moves from this FEN */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                Saved Replies from Here (click to step):
              </div>
              {activeNode && activeNode.edges.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeNode.edges.map((edge) => (
                    <button
                      key={`${edge.openingId}-${edge.uci}`}
                      type="button"
                      onClick={() => setMoveHistorySan((prev) => [...prev, edge.san])}
                      className="text-left p-2.5 rounded-xl border hover:border-emerald-500/50 transition-colors cursor-pointer"
                      style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {edge.san}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {edge.openingName}
                        </span>
                      </div>
                      {edge.note && (
                        <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>
                          {edge.note}
                        </p>
                      )}
                      {edge.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {edge.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-sky-300">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="text-xs p-3 rounded-lg border"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  No saved prep moves from this exact position yet. Play a move on the board and click{" "}
                  <strong>Quick-Save Line</strong> to add it!
                </div>
              )}
            </div>

            {/* Position Note & Right-Click Arrows Editor */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold">
                  Position Plan / Trap Note (Right-click board to draw arrows/circles)
                </label>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {arrowsDraft.length} arrows · {circlesDraft.length} circles
                </span>
              </div>
              <textarea
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write strategic plan, pawn break ideas, or why a trap works..."
                className="w-full rounded-xl border p-2.5 text-xs"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEngine}
                    onChange={(e) => setShowEngine(e.target.checked)}
                  />
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Live Stockfish Check
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSaveNodeNotes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Note &amp; Arrows
                </button>
              </div>
              {showEngine && engineEval && (
                <div
                  className="rounded-lg border p-2.5 text-xs font-mono space-y-1"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  {engineEval.lines.map((l) => (
                    <div key={l.multipv} className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {formatEvalLabel(l.cpWhite, l.mateWhite)}
                      </span>
                      <span className="truncate">{l.pvSan.join(" ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lichess Opening Explorer */}
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold">Lichess Opening Explorer</h2>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={explorerSource}
                  onChange={(e) => setExplorerSource(e.target.value as "masters" | "lichess")}
                  className="rounded-lg border px-2 py-1 text-xs"
                  style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <option value="masters">Masters Database</option>
                  <option value="lichess">Club Rating Band (Token)</option>
                </select>
                {explorerSource === "lichess" && (
                  <input
                    type="password"
                    value={lichessToken}
                    onChange={(e) => setLichessToken(e.target.value)}
                    placeholder="Optional Lichess lip_ token"
                    className="rounded-lg border px-2 py-1 text-xs w-40"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  />
                )}
              </div>
            </div>

            {explorerNote && (
              <p className="text-[11px] text-amber-300">{explorerNote}</p>
            )}

            <div className="table-wrapper">
              <table className="chess-table">
                <thead>
                  <tr>
                    <th>Move</th>
                    <th>Games</th>
                    <th>White / Draw / Black</th>
                  </tr>
                </thead>
                <tbody>
                  {explorerLoading ? (
                    <tr>
                      <td colSpan={3} className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>
                        Querying Lichess database...
                      </td>
                    </tr>
                  ) : explorerMoves.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>
                        No master games reached this exact position.
                      </td>
                    </tr>
                  ) : (
                    explorerMoves.map((m) => {
                      const total = m.white + m.draws + m.black;
                      const wPct = total ? Math.round((m.white / total) * 100) : 0;
                      const dPct = total ? Math.round((m.draws / total) * 100) : 0;
                      const bPct = Math.max(0, 100 - wPct - dPct);
                      return (
                        <tr
                          key={m.uci}
                          onClick={() => setMoveHistorySan((prev) => [...prev, m.san])}
                          className="cursor-pointer"
                        >
                          <th className="font-mono font-bold text-emerald-400">{m.san}</th>
                          <td className="font-mono text-xs">{total.toLocaleString()}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2.5 rounded overflow-hidden flex min-w-[120px]">
                                <div className="bg-slate-100" style={{ width: `${wPct}%` }} />
                                <div className="bg-slate-400" style={{ width: `${dPct}%` }} />
                                <div className="bg-slate-800" style={{ width: `${bPct}%` }} />
                              </div>
                              <span className="text-[11px] font-mono w-24 text-right" style={{ color: "var(--muted)" }}>
                                {wPct}/{dPct}/{bPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Pattern Family Comparison Card (Clubbing Explanation + Side-by-Side Benefits) */}
      {activeFamily && (
        <section
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Pattern Family Comparison &amp; Benefits
              </div>
              <h2 className="text-lg font-bold">{activeFamily.name}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {activeFamily.dnaSummary}
              </p>
            </div>
            <Link
              href={`/practice?family=${encodeURIComponent(activeFamily.id)}`}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <span>Practice Family Mix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                Shared Tactical &amp; Structural Blueprint
              </div>
              <ul className="space-y-1.5 text-xs list-disc pl-4 leading-relaxed">
                {activeFamily.sharedBlueprint.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-sky-400">
                Why Club These Openings Together?
              </div>
              <ul className="space-y-1.5 text-xs list-disc pl-4 leading-relaxed">
                {activeFamily.keyBenefits.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {activeFamily.comparisonRows.length > 0 && (
            <div className="table-wrapper">
              <table className="chess-table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    {Object.keys(activeFamily.comparisonRows[0].columns).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeFamily.comparisonRows.map((row) => (
                    <tr key={row.aspect}>
                      <th className="font-semibold text-xs">{row.aspect}</th>
                      {Object.entries(row.columns).map(([col, val]) => (
                        <td key={col} className="text-xs leading-relaxed">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <QuickSavePrepModal
        open={quickSaveOpen}
        onClose={() => setQuickSaveOpen(false)}
        movesSan={moveHistorySan}
        defaultColor={activeFamily?.color || orientation}
        defaultNote={noteDraft}
        arrows={arrowsDraft}
        circles={circlesDraft}
        onSaved={(msg) => {
          setToast(msg);
          loadGraph();
        }}
      />

      <ModalDialog
        open={importPgnOpen}
        onClose={() => setImportPgnOpen(false)}
        title="Import PGN Line into Active Pattern Family"
      >
        <form onSubmit={handleImportPgn} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Opening / Branch Name
            </label>
            <input
              type="text"
              required
              value={importOpeningName}
              onChange={(e) => setImportOpeningName(e.target.value)}
              placeholder="e.g. Vienna Mieses Variation"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              PGN Moves
            </label>
            <textarea
              rows={5}
              required
              value={importPgnText}
              onChange={(e) => setImportPgnText(e.target.value)}
              placeholder="1. e4 e5 2. Nc3 Nf6 3. g3..."
              className="w-full rounded-lg border p-2.5 text-xs font-mono"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImportPgnOpen(false)}
              className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
            >
              Import &amp; Generate Drills
            </button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        open={newFamilyOpen}
        onClose={() => setNewFamilyOpen(false)}
        title="Create New Pattern Family Club"
      >
        <form onSubmit={handleCreateFamily} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Family Name
            </label>
            <input
              type="text"
              required
              value={newFamName}
              onChange={(e) => setNewFamName(e.target.value)}
              placeholder="e.g. White d4-c4 Catalan / Queen's Gambit Club"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Color
            </label>
            <select
              value={newFamColor}
              onChange={(e) => setNewFamColor(e.target.value as PlayerColor)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Subtitle (Openings Clubbed)
            </label>
            <input
              type="text"
              value={newFamSubtitle}
              onChange={(e) => setNewFamSubtitle(e.target.value)}
              placeholder="Openings sharing this pattern"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Core Shared DNA / Plan
            </label>
            <textarea
              rows={3}
              value={newFamDna}
              onChange={(e) => setNewFamDna(e.target.value)}
              placeholder="Explain why these lines belong together..."
              className="w-full rounded-lg border p-2.5 text-xs"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewFamilyOpen(false)}
              className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
            >
              Create Family
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export default function OpeningsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading Opening Prep Studio...</div>}>
      <OpeningsContent />
    </Suspense>
  );
}
