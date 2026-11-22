import type { MoveClassification } from "@/types/chess";

/**
 * Converts centipawn evaluation (White POV) into expected win probability [0, 100].
 * Uses Lichess's empirical sigmoid curve.
 */
export function cpToWinProb(cp: number): number {
  const clamped = Math.max(-1500, Math.min(1500, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export function mateToCp(mateIn: number): number {
  if (mateIn > 0) return Math.max(8500, 10000 - mateIn * 50);
  if (mateIn < 0) return Math.min(-8500, -10000 - mateIn * 50);
  return 0;
}

export function formatEvalLabel(cp: number, mate?: number | null): string {
  if (mate != null && mate !== 0) {
    return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
  }
  const pawns = cp / 100;
  if (Math.abs(pawns) >= 90) {
    return pawns > 0 ? "+M" : "-M";
  }
  const sign = pawns > 0.05 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export function classifyMove(params: {
  moverColor: "white" | "black";
  evalBeforeCp: number;
  evalAfterCp: number;
  mateBefore?: number | null;
  mateAfter?: number | null;
  playedUci: string;
  bestUci: string;
  isSacrifice?: boolean;
  ply: number;
  inBook?: boolean;
}): { cpLoss: number; classification: MoveClassification } {
  const {
    moverColor,
    evalBeforeCp,
    evalAfterCp,
    mateBefore,
    mateAfter,
    playedUci,
    bestUci,
    isSacrifice,
    ply,
    inBook,
  } = params;

  if (inBook && ply <= 16) {
    return { cpLoss: 0, classification: "book" };
  }

  // Express evals from mover's POV
  const beforePov = moverColor === "white" ? evalBeforeCp : -evalBeforeCp;
  const afterPov = moverColor === "white" ? evalAfterCp : -evalAfterCp;

  const cpLoss = Math.max(0, beforePov - afterPov);
  const winBefore = cpToWinProb(beforePov);
  const winAfter = cpToWinProb(afterPov);
  const winDrop = Math.max(0, winBefore - winAfter);

  const missedForcedMate =
    mateBefore != null &&
    ((moverColor === "white" && mateBefore > 0) || (moverColor === "black" && mateBefore < 0)) &&
    (mateAfter == null ||
      (moverColor === "white" && mateAfter <= 0) ||
      (moverColor === "black" && mateAfter >= 0));

  const walkedIntoMate =
    mateAfter != null &&
    ((moverColor === "white" && mateAfter < 0) || (moverColor === "black" && mateAfter > 0)) &&
    !(
      mateBefore != null &&
      ((moverColor === "white" && mateBefore < 0) || (moverColor === "black" && mateBefore > 0))
    );

  if (playedUci === bestUci || cpLoss <= 10) {
    if (isSacrifice && afterPov >= 80 && playedUci === bestUci) {
      return { cpLoss, classification: "brilliant" };
    }
    return { cpLoss, classification: "best" };
  }

  if (walkedIntoMate || winDrop >= 18 || (cpLoss >= 250 && !missedForcedMate ? true : missedForcedMate && winDrop >= 12)) {
    return { cpLoss, classification: "blunder" };
  }

  if (winDrop >= 9 || cpLoss >= 110 || missedForcedMate) {
    return { cpLoss, classification: "mistake" };
  }

  if (winDrop >= 4.5 || cpLoss >= 45) {
    return { cpLoss, classification: "inaccuracy" };
  }

  return { cpLoss, classification: "good" };
}

export function computeAccuracyFromWinDrops(winDrops: number[]): number {
  if (winDrops.length === 0) return 100;
  const scores = winDrops.map((d) => {
    const acc = 103.1668 * Math.exp(-0.04354 * Math.max(0, d)) - 3.1669;
    return Math.max(0, Math.min(100, acc));
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}
