import { Chess } from "chess.js";
import type {
  AnalyzedPly,
  PersonalBlunderPuzzle,
  PlayerColor,
  RepertoireNode,
  StoredGame,
} from "@/types/chess";
import { classifyMove, computeAccuracyFromWinDrops, cpToWinProb, mateToCp } from "./classifier";
import { generateCoachExplanation, inferTacticalMotif } from "./coach";
import { detectPhase, getMaterialBalance, getTurnFromFen, normalizeFen } from "./fen";
import { uciToMoveObj } from "./pgn";

export interface EngineLine {
  multipv: number;
  depth: number;
  cpWhite: number; // White POV centipawns
  mateWhite: number | null;
  pvUci: string[];
  pvSan: string[];
}

export interface PositionEvalResult {
  fen: string;
  depth: number;
  bestMoveUci: string;
  bestMoveSan: string;
  lines: EngineLine[];
}

function uciLineToSan(fen: string, uciMoves: string[]): string[] {
  const out: string[] = [];
  try {
    const c = new Chess(fen);
    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;
      const mv = c.move(uciToMoveObj(uci));
      if (!mv) break;
      out.push(mv.san);
    }
  } catch {
    // ignore partial PV conversion errors
  }
  return out;
}

class StockfishController {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private currentAbort: (() => void) | null = null;

  private async ensureReady(): Promise<Worker> {
    if (typeof window === "undefined") {
      throw new Error("Stockfish WASM runs only in the browser.");
    }
    if (this.worker && this.ready) return this.worker;
    if (this.initPromise) {
      await this.initPromise;
      return this.worker!;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        const w = new Worker("/engine/stockfish.js");
        this.worker = w;
        let sawUci = false;

        const timeout = setTimeout(() => {
          reject(new Error("Stockfish WASM handshake timed out."));
        }, 15000);

        const onMsg = (ev: MessageEvent<string>) => {
          const line = String(ev.data || "");
          if (line.includes("uciok") && !sawUci) {
            sawUci = true;
            w.postMessage("isready");
          } else if (line.includes("readyok")) {
            clearTimeout(timeout);
            w.removeEventListener("message", onMsg);
            this.ready = true;
            resolve();
          }
        };

        w.addEventListener("message", onMsg);
        w.addEventListener("error", (err) => {
          clearTimeout(timeout);
          this.ready = false;
          reject(new Error(`Stockfish Worker error: ${err.message || "unknown"}`));
        });

        w.postMessage("uci");
      } catch (err) {
        reject(err);
      }
    });

    await this.initPromise;
    return this.worker!;
  }

  public stopCurrent() {
    if (this.currentAbort) {
      this.currentAbort();
      this.currentAbort = null;
    }
  }

  public evaluatePosition(
    fen: string,
    options?: {
      depth?: number;
      multiPv?: number;
      skillLevel?: number;
      onProgress?: (res: PositionEvalResult) => void;
    }
  ): Promise<PositionEvalResult> {
    const depth = options?.depth ?? 13;
    const multiPv = options?.multiPv ?? 3;
    const skillLevel = options?.skillLevel ?? 20;

    // Serialize engine searches cleanly while stopping any superseded UI search
    this.stopCurrent();

    const task = this.queue.then(async () => {
      const worker = await this.ensureReady();
      const sideToMove = getTurnFromFen(fen);
      const sign = sideToMove === "white" ? 1 : -1;

      return new Promise<PositionEvalResult>((resolve, reject) => {
        const linesByPv = new Map<number, EngineLine>();
        let finished = false;
        let lastDepthEmitted = 0;

        const cleanup = () => {
          worker.removeEventListener("message", onMsg);
          clearTimeout(timer);
          if (this.currentAbort === abortFn) {
            this.currentAbort = null;
          }
        };

        const buildResult = (bestMoveUci: string): PositionEvalResult => {
          const sorted = [...linesByPv.values()].sort((a, b) => a.multipv - b.multipv);
          const topUci = bestMoveUci && bestMoveUci !== "(none)" ? bestMoveUci : sorted[0]?.pvUci[0] || "";
          const topSan = topUci ? uciLineToSan(fen, [topUci])[0] || topUci : "";
          const topDepth = sorted[0]?.depth || depth;
          return {
            fen,
            depth: topDepth,
            bestMoveUci: topUci,
            bestMoveSan: topSan,
            lines: sorted,
          };
        };

        const abortFn = () => {
          if (finished) return;
          finished = true;
          worker.postMessage("stop");
          cleanup();
          resolve(buildResult(linesByPv.get(1)?.pvUci[0] || ""));
        };
        this.currentAbort = abortFn;

        const timer = setTimeout(() => {
          if (finished) return;
          finished = true;
          worker.postMessage("stop");
          cleanup();
          resolve(buildResult(linesByPv.get(1)?.pvUci[0] || ""));
        }, 12000);

        const onMsg = (ev: MessageEvent<string>) => {
          if (finished) return;
          const raw = String(ev.data || "").trim();

          if (raw.startsWith("info ") && raw.includes(" pv ")) {
            const depthMatch = /\bdepth (\d+)/.exec(raw);
            const pvNumMatch = /\bmultipv (\d+)/.exec(raw);
            const cpMatch = /\bscore cp (-?\d+)/.exec(raw);
            const mateMatch = /\bscore mate (-?\d+)/.exec(raw);
            const pvSplit = raw.split(/\bpv\s+/);
            if (!depthMatch || pvSplit.length < 2) return;

            const curDepth = Number(depthMatch[1]);
            const pvNum = pvNumMatch ? Number(pvNumMatch[1]) : 1;
            const pvUci = pvSplit[1].trim().split(/\s+/).slice(0, 8);

            let cpWhite = 0;
            let mateWhite: number | null = null;
            if (mateMatch) {
              const m = Number(mateMatch[1]) * sign;
              mateWhite = m;
              cpWhite = mateToCp(m);
            } else if (cpMatch) {
              cpWhite = Number(cpMatch[1]) * sign;
            }

            const existing = linesByPv.get(pvNum);
            if (!existing || curDepth >= existing.depth) {
              linesByPv.set(pvNum, {
                multipv: pvNum,
                depth: curDepth,
                cpWhite,
                mateWhite,
                pvUci,
                pvSan: uciLineToSan(fen, pvUci),
              });
            }

            if (options?.onProgress && pvNum === 1 && curDepth > lastDepthEmitted && curDepth >= 6) {
              lastDepthEmitted = curDepth;
              options.onProgress(buildResult(pvUci[0] || ""));
            }
          } else if (raw.startsWith("bestmove ")) {
            finished = true;
            cleanup();
            const best = raw.split(/\s+/)[1] || "";
            resolve(buildResult(best));
          }
        };

        try {
          worker.addEventListener("message", onMsg);
          worker.postMessage(`setoption name MultiPV value ${multiPv}`);
          worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(`go depth ${depth}`);
        } catch (err) {
          finished = true;
          cleanup();
          reject(err);
        }
      });
    });

    this.queue = task.catch(() => undefined);
    return task;
  }

  public async pickSparringMove(fen: string, targetElo = 1300): Promise<{ uci: string; san: string }> {
    const clampedElo = Math.max(800, Math.min(2200, targetElo));
    const skillLevel = Math.round(((clampedElo - 800) / 1400) * 20);
    const depth = clampedElo < 1100 ? 6 : clampedElo < 1500 ? 9 : 12;

    const evalRes = await this.evaluatePosition(fen, {
      depth,
      multiPv: clampedElo < 1400 ? 3 : 1,
      skillLevel,
    });

    if (evalRes.lines.length > 1 && clampedElo < 1350) {
      const top = evalRes.lines[0];
      const candidates = evalRes.lines.filter(
        (l) => Math.abs(l.cpWhite - top.cpWhite) <= (clampedElo < 1050 ? 150 : 75)
      );
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || top;
      const uci = chosen.pvUci[0] || evalRes.bestMoveUci;
      return { uci, san: uciLineToSan(fen, [uci])[0] || evalRes.bestMoveSan };
    }

    return { uci: evalRes.bestMoveUci, san: evalRes.bestMoveSan };
  }
}

export const stockfishEngine = new StockfishController();

export async function analyzeGameWithStockfish(
  game: StoredGame,
  repertoireNodes: Map<string, RepertoireNode>,
  options?: {
    depth?: number;
    onProgress?: (completedPlies: number, totalPlies: number) => void;
    signal?: AbortSignal;
  }
): Promise<{
  plies: AnalyzedPly[];
  whiteAccuracy: number;
  blackAccuracy: number;
  userAccuracy: number;
  counts: NonNullable<StoredGame["counts"]>;
  extractedBlunders: PersonalBlunderPuzzle[];
}> {
  const depth = options?.depth ?? 10;
  const chess = new Chess();
  const totalPlies = game.movesSan.length;

  // Pre-build FEN sequence
  const stepPositions: {
    ply: number;
    moveSan: string;
    moveUci: string;
    fenBefore: string;
    fenAfter: string;
    moverColor: PlayerColor;
    isSacrifice: boolean;
    clockRemainingSec?: number;
  }[] = [];

  for (let i = 0; i < game.movesSan.length; i++) {
    const fenBefore = chess.fen();
    const matBefore = getMaterialBalance(fenBefore);
    const mv = chess.move(game.movesSan[i]);
    if (!mv) break;
    const fenAfter = chess.fen();
    const matAfter = getMaterialBalance(fenAfter);
    const moverColor: PlayerColor = mv.color === "w" ? "white" : "black";
    const matDelta =
      moverColor === "white" ? matAfter.diff - matBefore.diff : matBefore.diff - matAfter.diff;

    stepPositions.push({
      ply: i + 1,
      moveSan: mv.san,
      moveUci: `${mv.from}${mv.to}${mv.promotion || ""}`,
      fenBefore,
      fenAfter,
      moverColor,
      isSacrifice: matDelta <= -2,
      clockRemainingSec: game.clocksSec[i],
    });
  }

  // Evaluate each position once (N+1 positions)
  const evals: PositionEvalResult[] = [];
  for (let i = 0; i <= stepPositions.length; i++) {
    if (options?.signal?.aborted) {
      throw new Error("Analysis cancelled.");
    }
    const fen = i < stepPositions.length ? stepPositions[i].fenBefore : stepPositions[stepPositions.length - 1]?.fenAfter || chess.fen();
    const res = await stockfishEngine.evaluatePosition(fen, { depth, multiPv: 1 });
    evals.push(res);
    options?.onProgress?.(Math.min(i + 1, totalPlies), totalPlies);
  }

  const plies: AnalyzedPly[] = [];
  const whiteWinDrops: number[] = [];
  const blackWinDrops: number[] = [];
  const counts: NonNullable<StoredGame["counts"]> = {
    brilliant: 0,
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  const extractedBlunders: PersonalBlunderPuzzle[] = [];

  let userLeftBook = false;
  let oppLeftBook = false;

  for (let i = 0; i < stepPositions.length; i++) {
    const step = stepPositions[i];
    const beforeEval = evals[i];
    const afterEval = evals[i + 1];

    const evalBeforeCp = beforeEval?.lines[0]?.cpWhite ?? 0;
    const mateBefore = beforeEval?.lines[0]?.mateWhite ?? null;
    const evalAfterCp = afterEval?.lines[0]?.cpWhite ?? evalBeforeCp;
    const mateAfter = afterEval?.lines[0]?.mateWhite ?? null;

    const normBefore = normalizeFen(step.fenBefore);
    const repNode = repertoireNodes.get(normBefore);
    const repEdge = repNode?.edges.find((e) => e.uci === step.moveUci || e.san === step.moveSan);
    const inBook = Boolean(repEdge) && step.ply <= 16;

    let repertoireDeviation: "user" | "opponent" | null = null;
    if (repNode && !repEdge && step.ply <= 16) {
      if (step.moverColor === game.userColor && !userLeftBook) {
        userLeftBook = true;
        repertoireDeviation = "user";
      } else if (step.moverColor !== game.userColor && !oppLeftBook) {
        oppLeftBook = true;
        repertoireDeviation = "opponent";
      }
    }

    const bestMoveUci = beforeEval?.bestMoveUci || step.moveUci;
    const bestMoveSan = beforeEval?.bestMoveSan || step.moveSan;
    const pvSan = beforeEval?.lines[0]?.pvSan || [];

    const { cpLoss, classification } = classifyMove({
      moverColor: step.moverColor,
      evalBeforeCp,
      evalAfterCp,
      mateBefore,
      mateAfter,
      playedUci: step.moveUci,
      bestUci: bestMoveUci,
      isSacrifice: step.isSacrifice,
      ply: step.ply,
      inBook,
    });

    const beforePov = step.moverColor === "white" ? evalBeforeCp : -evalBeforeCp;
    const afterPov = step.moverColor === "white" ? evalAfterCp : -evalAfterCp;
    const winDrop = Math.max(0, cpToWinProb(beforePov) - cpToWinProb(afterPov));

    if (step.moverColor === "white") whiteWinDrops.push(winDrop);
    else blackWinDrops.push(winDrop);

    if (step.moverColor === game.userColor && classification !== "book") {
      counts[classification] = (counts[classification] || 0) + 1;
    }

    const phase = detectPhase(step.fenBefore, step.ply);
    const coachExplanation = generateCoachExplanation({
      fenBefore: step.fenBefore,
      fenAfter: step.fenAfter,
      moveSan: step.moveSan,
      moveUci: step.moveUci,
      bestMoveSan,
      bestMoveUci,
      pvSan,
      classification,
      cpLoss,
      moverColor: step.moverColor,
      phase,
      repertoireNote: repEdge?.note || repNode?.notes,
      repertoireDeviation,
    });

    plies.push({
      ply: step.ply,
      moveSan: step.moveSan,
      moveUci: step.moveUci,
      fenBefore: step.fenBefore,
      fenAfter: step.fenAfter,
      evalBeforeCp,
      evalAfterCp,
      mateBefore,
      mateAfter,
      bestMoveUci,
      bestMoveSan,
      pvSan,
      cpLoss,
      classification,
      coachExplanation,
      clockRemainingSec: step.clockRemainingSec,
      phase,
    });

    // Extract user mistakes/blunders into Personal Tactics Bank!
    if (
      step.moverColor === game.userColor &&
      (classification === "blunder" || classification === "mistake") &&
      bestMoveUci &&
      bestMoveUci !== step.moveUci &&
      cpLoss >= 140
    ) {
      extractedBlunders.push({
        id: `${game.id}-ply-${step.ply}`,
        gameId: game.id,
        gameUrl: game.url,
        playedAt: game.endTime,
        userColor: game.userColor,
        fen: step.fenBefore,
        bestMoveUci,
        bestMoveSan,
        playedMoveSan: step.moveSan,
        pvSan,
        cpLoss,
        motif: inferTacticalMotif({
          fenBefore: step.fenBefore,
          bestMoveUci,
          pvSan,
          phase,
        }),
        openingName: game.ecoName,
        coachExplanation,
        solvedCount: 0,
        failedCount: 0,
      });
    }
  }

  const whiteAccuracy = computeAccuracyFromWinDrops(whiteWinDrops);
  const blackAccuracy = computeAccuracyFromWinDrops(blackWinDrops);
  const userAccuracy = game.userColor === "white" ? whiteAccuracy : blackAccuracy;

  return {
    plies,
    whiteAccuracy,
    blackAccuracy,
    userAccuracy,
    counts,
    extractedBlunders,
  };
}
