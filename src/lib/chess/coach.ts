import { Chess } from "chess.js";
import type { MoveClassification } from "@/types/chess";
import { getMaterialBalance } from "./fen";

export interface CoachInput {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  moveUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  pvSan: string[];
  classification: MoveClassification;
  cpLoss: number;
  moverColor: "white" | "black";
  phase: "opening" | "middlegame" | "endgame";
  repertoireNote?: string;
  repertoireDeviation?: "user" | "opponent" | null;
}

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export function inferTacticalMotif(params: {
  fenBefore: string;
  bestMoveUci: string;
  pvSan: string[];
  phase: "opening" | "middlegame" | "endgame";
}): string {
  const { fenBefore, bestMoveUci, pvSan, phase } = params;
  if (phase === "endgame") return "Endgame Technique";
  try {
    const c = new Chess(fenBefore);
    const mv = c.move({
      from: bestMoveUci.slice(0, 2),
      to: bestMoveUci.slice(2, 4),
      promotion: bestMoveUci.length > 4 ? bestMoveUci[4] : undefined,
    });
    if (!mv) return "Tactical Shot";
    if (c.isCheckmate() || pvSan.some((s) => s.includes("#"))) return "Checkmate Pattern";
    if (mv.piece === "n" && mv.san.includes("+")) return "Knight Fork / Check";
    if (mv.captured && mv.piece !== "p") {
      return "Winning Material";
    }
    if (mv.san.includes("+")) return "Checking Attack";
    if (mv.piece === "p" && (mv.to[1] === "7" || mv.to[1] === "2" || mv.to[1] === "8" || mv.to[1] === "1")) {
      return "Pawn Promotion Threat";
    }
    if (pvSan.length >= 3) return "Calculation / Combination";
  } catch {
    // ignore
  }
  return "Tactical Opportunity";
}

export function generateCoachExplanation(input: CoachInput): string {
  const {
    fenBefore,
    fenAfter,
    moveSan,
    bestMoveSan,
    pvSan,
    classification,
    cpLoss,
    moverColor,
    phase,
    repertoireNote,
    repertoireDeviation,
  } = input;

  if (repertoireNote && classification === "book") {
    return `Book move (${moveSan}). ${repertoireNote}`;
  }

  const ideas: string[] = [];

  try {
    const before = new Chess(fenBefore);
    const after = new Chess(fenAfter);
    const matBefore = getMaterialBalance(fenBefore);
    const matAfter = getMaterialBalance(fenAfter);

    const movedPiece = before.get(input.moveUci.slice(0, 2) as Parameters<Chess["get"]>[0]);
    const pieceLabel = movedPiece ? PIECE_NAMES[movedPiece.type] || "piece" : "piece";

    if (after.isCheckmate()) {
      return `${moveSan} delivers checkmate! Game over.`;
    }

    if (repertoireDeviation === "user") {
      ideas.push(`You left your saved Opening Prep here.`);
    } else if (repertoireDeviation === "opponent") {
      ideas.push(`Opponent stepped out of your saved Opening Prep — you can capture this sideline right into your tree.`);
    }

    // Analyze tactical/strategic features of the move played
    if (moveSan === "O-O" || moveSan === "O-O-O") {
      ideas.push(`Safeguards the king and activates the rook toward the center.`);
    } else if (after.inCheck()) {
      ideas.push(`${moveSan} hits the enemy king with check, forcing an immediate response.`);
    }

    if (phase === "opening" && (moveSan === "f4" || moveSan === "f5")) {
      ideas.push(
        `Strikes early on the f-file—the signature battering-ram break shared across Vienna, Grand Prix, and ...f5 counter-gambit systems.`
      );
    }

    const matChangeForMover =
      moverColor === "white" ? matAfter.diff - matBefore.diff : matBefore.diff - matAfter.diff;

    if (classification === "brilliant") {
      ideas.push(
        `${moveSan} is a brilliant sacrifice—giving up material on the board to rip open lines and seize a decisive attack!`
      );
    } else if (classification === "best" || classification === "good" || classification === "book") {
      if (matChangeForMover > 0) {
        ideas.push(`${moveSan} cleanly wins material (+${matChangeForMover} pawn value).`);
      } else if (ideas.length === 0) {
        ideas.push(
          classification === "best"
            ? `${moveSan} is the top engine choice, improving your ${pieceLabel} with strong control.`
            : `${moveSan} keeps the position solid and playable.`
        );
      }
      if (bestMoveSan && bestMoveSan !== moveSan && classification === "good") {
        ideas.push(`Engine slightly preferred ${bestMoveSan}.`);
      }
    } else {
      // Inaccuracy, Mistake, or Blunder — explain WHY it hurt & what was better
      const severity =
        classification === "blunder"
          ? `Blunder (-${(cpLoss / 100).toFixed(1)} eval swing)`
          : classification === "mistake"
          ? `Mistake (-${(cpLoss / 100).toFixed(1)} eval)`
          : `Inaccuracy (-${(cpLoss / 100).toFixed(1)} eval)`;

      let reason = "";
      if (matChangeForMover < 0) {
        reason = `drops material or steps into an unfavorable trade`;
      } else if (pvSan.length > 0) {
        reason = `allows strong counterplay starting with ${pvSan.slice(0, 3).join(" ")}`;
      } else if (phase === "endgame") {
        reason = `gives away key endgame tempo or square control`;
      } else {
        reason = `misses a stronger tactical or structural continuation`;
      }

      ideas.push(`${severity}: ${moveSan} ${reason}.`);

      if (bestMoveSan && bestMoveSan !== moveSan) {
        const linePreview = pvSan.length > 1 ? ` (idea: ${pvSan.slice(0, 4).join(" ")})` : "";
        ideas.push(`Better was ${bestMoveSan}${linePreview}.`);
      }
    }
  } catch {
    return classification === "best"
      ? `${moveSan} is the strongest continuation.`
      : `Consider ${bestMoveSan || moveSan} here.`;
  }

  return ideas.join(" ");
}
