"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import type { BoardArrow, BoardCircle, PlayerColor } from "@/types/chess";
import { START_FEN } from "@/lib/chess/fen";

interface InteractiveBoardProps {
  fen: string;
  orientation?: PlayerColor;
  interactive?: boolean;
  allowedColor?: PlayerColor | "both";
  lastMove?: [string, string];
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
  onMove?: (move: { from: string; to: string; promotion?: string; san: string; uci: string; fenAfter: string }) => void;
  onDrawChange?: (arrows: BoardArrow[], circles: BoardCircle[]) => void;
  maxWidthClass?: string;
}

function computeLegalDests(fen: string): {
  dests: Map<Key, Key[]>;
  turnColor: PlayerColor;
  inCheck: boolean;
} {
  try {
    const chess = new Chess(fen);
    const dests = new Map<Key, Key[]>();
    const moves = chess.moves({ verbose: true });
    for (const m of moves) {
      const from = m.from as Key;
      const to = m.to as Key;
      const arr = dests.get(from);
      if (arr) {
        if (!arr.includes(to)) arr.push(to);
      } else {
        dests.set(from, [to]);
      }
    }
    return {
      dests,
      turnColor: chess.turn() === "b" ? "black" : "white",
      inCheck: chess.inCheck(),
    };
  } catch {
    return { dests: new Map(), turnColor: "white", inCheck: false };
  }
}

export function InteractiveBoard({
  fen,
  orientation = "white",
  interactive = true,
  allowedColor = "both",
  lastMove,
  arrows = [],
  circles = [],
  onMove,
  onDrawChange,
  maxWidthClass = "max-w-[540px]",
}: InteractiveBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  const onDrawRef = useRef(onDrawChange);
  const fenRef = useRef(fen);

  onMoveRef.current = onMove;
  onDrawRef.current = onDrawChange;
  fenRef.current = fen;

  const [pendingPromo, setPendingPromo] = useState<{ from: string; to: string; color: PlayerColor } | null>(null);

  const boardState = useMemo(() => computeLegalDests(fen || START_FEN), [fen]);

  const drawShapes = useMemo<DrawShape[]>(() => {
    const a: DrawShape[] = arrows.map((ar) => ({
      orig: ar.orig as Key,
      dest: ar.dest as Key,
      brush: ar.brush,
    }));
    const c: DrawShape[] = circles.map((ci) => ({
      orig: ci.orig as Key,
      brush: ci.brush,
    }));
    return [...a, ...c];
  }, [arrows, circles]);

  const handleMoveExec = (from: string, to: string, promotion?: string) => {
    try {
      const chess = new Chess(fenRef.current);
      const piece = chess.get(from as Square);
      // Detect pawn promotion if not already chosen
      if (
        !promotion &&
        piece?.type === "p" &&
        ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"))
      ) {
        const legalPromos = chess
          .moves({ square: from as Square, verbose: true })
          .filter((m) => m.to === to && m.promotion);
        if (legalPromos.length > 0) {
          setPendingPromo({ from, to, color: piece.color === "w" ? "white" : "black" });
          return;
        }
      }

      const mv = chess.move({ from, to, promotion });
      if (!mv) return;
      onMoveRef.current?.({
        from,
        to,
        promotion,
        san: mv.san,
        uci: `${mv.from}${mv.to}${mv.promotion || ""}`,
        fenAfter: chess.fen(),
      });
    } catch {
      // Revert visual piece to canonical FEN on invalid move
      apiRef.current?.set({ fen: fenRef.current });
    }
  };

  const handleMoveExecRef = useRef(handleMoveExec);
  handleMoveExecRef.current = handleMoveExec;

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    import("chessground").then(({ Chessground }) => {
      if (cancelled || !el) return;
      const movableColor = !interactive
        ? undefined
        : allowedColor === "both"
          ? boardState.turnColor
          : allowedColor === boardState.turnColor
            ? boardState.turnColor
            : undefined;

      const api = Chessground(el, {
        fen: fen || START_FEN,
        orientation,
        turnColor: boardState.turnColor,
        check: boardState.inCheck ? boardState.turnColor : false,
        lastMove: lastMove as [Key, Key] | undefined,
        coordinates: true,
        viewOnly: !interactive && !onDrawChange,
        highlight: { lastMove: true, check: true },
        animation: { enabled: true, duration: 180 },
        movable: {
          free: false,
          color: movableColor,
          dests: interactive ? boardState.dests : new Map(),
          showDests: true,
          events: {
            after: (orig, dest) => {
              handleMoveExecRef.current(orig, dest);
            },
          },
        },
        drawable: {
          enabled: true,
          visible: true,
          autoShapes: drawShapes,
          onChange: (shapes) => {
            if (!onDrawRef.current) return;
            const outArrows: BoardArrow[] = [];
            const outCircles: BoardCircle[] = [];
            for (const s of shapes) {
              const brush =
                s.brush === "red" || s.brush === "blue" || s.brush === "yellow"
                  ? s.brush
                  : "green";
              if (s.dest) {
                outArrows.push({ orig: s.orig, dest: s.dest, brush });
              } else {
                outCircles.push({ orig: s.orig, brush });
              }
            }
            onDrawRef.current(outArrows, outCircles);
          },
        },
      });
      apiRef.current = api;
    });

    return () => {
      cancelled = true;
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // Mount once; subsequent prop updates sync via apiRef.current.set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    setPendingPromo(null);

    const movableColor = !interactive
      ? undefined
      : allowedColor === "both"
        ? boardState.turnColor
        : allowedColor === boardState.turnColor
          ? boardState.turnColor
          : undefined;

    api.set({
      fen: fen || START_FEN,
      orientation,
      turnColor: boardState.turnColor,
      check: boardState.inCheck ? boardState.turnColor : false,
      lastMove: lastMove as [Key, Key] | undefined,
      viewOnly: !interactive && !onDrawChange,
      movable: {
        free: false,
        color: movableColor,
        dests: interactive ? boardState.dests : new Map(),
        showDests: true,
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: drawShapes,
      },
    });
  }, [fen, orientation, interactive, allowedColor, lastMove, boardState, drawShapes, onDrawChange]);

  return (
    <div className={`relative w-full aspect-square ${maxWidthClass} mx-auto select-none`}>
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden shadow-lg border"
        style={{ borderColor: "var(--border)" }}
      />
      {pendingPromo && (
        <div className="absolute inset-0 z-20 bg-black/55 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
          <div
            className="p-3 rounded-xl border shadow-2xl flex items-center gap-2"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <span className="text-xs font-medium mr-1" style={{ color: "var(--muted)" }}>
              Promote:
            </span>
            {(["q", "r", "b", "n"] as const).map((p) => {
              const glyph =
                pendingPromo.color === "white"
                  ? { q: "♕", r: "♖", b: "♗", n: "♘" }[p]
                  : { q: "♛", r: "♜", b: "♝", n: "♞" }[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const promo = pendingPromo;
                    setPendingPromo(null);
                    handleMoveExec(promo.from, promo.to, p);
                  }}
                  className="w-11 h-11 rounded-lg border text-2xl flex items-center justify-center hover:bg-emerald-500/20 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
