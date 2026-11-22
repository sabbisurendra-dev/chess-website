import { Chess } from "chess.js";
import type {
  BoardArrow,
  BoardCircle,
  PlayerColor,
  RepertoireMoveEdge,
  RepertoireNode,
  StoredGame,
} from "@/types/chess";
import { canonicalFullFen, normalizeFen, START_FEN } from "./fen";

export interface SeedLineInput {
  openingId: string;
  openingName: string;
  familyId: string;
  color: PlayerColor;
  movesSan: string[];
  isMainLine?: boolean;
  tags?: string[];
  annotationsByPly?: Record<
    number,
    {
      note?: string;
      tags?: string[];
      arrows?: BoardArrow[];
      circles?: BoardCircle[];
    }
  >;
}

export function buildGraphFromSeedLines(lines: SeedLineInput[]): Map<string, RepertoireNode> {
  const nodes = new Map<string, RepertoireNode>();
  const startNorm = normalizeFen(START_FEN);
  nodes.set(startNorm, {
    normFen: startNorm,
    fullFen: START_FEN,
    edges: [],
    transpositionNames: [],
    notes: "Starting position — root of your unified transposition graph.",
    arrows: [],
    circles: [],
    updatedAt: Date.now(),
  });

  for (const line of lines) {
    insertLineIntoMap(nodes, line);
  }

  return nodes;
}

export function insertLineIntoMap(nodes: Map<string, RepertoireNode>, line: SeedLineInput) {
  const chess = new Chess();
  const now = Date.now();

  for (let i = 0; i < line.movesSan.length; i++) {
    const beforeFen = chess.fen();
    const normBefore = normalizeFen(beforeFen);
    const mv = chess.move(line.movesSan[i]);
    if (!mv) {
      throw new Error(`Invalid seed move "${line.movesSan[i]}" in opening "${line.openingName}" at ply ${i + 1}`);
    }

    const afterFen = chess.fen();
    const normAfter = normalizeFen(afterFen);
    const uci = `${mv.from}${mv.to}${mv.promotion || ""}`;
    const plyAnn = line.annotationsByPly?.[i + 1];

    let sourceNode = nodes.get(normBefore);
    if (!sourceNode) {
      sourceNode = {
        normFen: normBefore,
        fullFen: canonicalFullFen(normBefore),
        edges: [],
        transpositionNames: [],
        notes: "",
        arrows: [],
        circles: [],
        updatedAt: now,
      };
      nodes.set(normBefore, sourceNode);
    }

    let destNode = nodes.get(normAfter);
    if (!destNode) {
      destNode = {
        normFen: normAfter,
        fullFen: canonicalFullFen(normAfter, Math.floor((i + 1) / 2) + 1),
        edges: [],
        transpositionNames: [line.openingName],
        notes: plyAnn?.note || "",
        arrows: plyAnn?.arrows || [],
        circles: plyAnn?.circles || [],
        updatedAt: now,
      };
      nodes.set(normAfter, destNode);
    } else {
      if (!destNode.transpositionNames.includes(line.openingName)) {
        destNode.transpositionNames.push(line.openingName);
      }
      if (plyAnn?.note && !destNode.notes.includes(plyAnn.note)) {
        destNode.notes = destNode.notes ? `${destNode.notes}\n\n${plyAnn.note}` : plyAnn.note;
      }
      if (plyAnn?.arrows?.length && destNode.arrows.length === 0) {
        destNode.arrows = plyAnn.arrows;
      }
      if (plyAnn?.circles?.length && destNode.circles.length === 0) {
        destNode.circles = plyAnn.circles;
      }
      destNode.updatedAt = now;
    }

    const existingEdge = sourceNode.edges.find(
      (e) => e.uci === uci && e.openingId === line.openingId
    );
    if (!existingEdge) {
      const mergedTags = Array.from(
        new Set([...(line.tags || []), ...(plyAnn?.tags || []), ...(destNode.transpositionNames.length > 1 ? ["#transposition"] : [])])
      );
      const edge: RepertoireMoveEdge = {
        san: mv.san,
        uci,
        nextNormFen: normAfter,
        openingId: line.openingId,
        openingName: line.openingName,
        familyId: line.familyId,
        isMainLine: line.isMainLine ?? true,
        tags: mergedTags,
        note: plyAnn?.note || "",
        arrows: plyAnn?.arrows || [],
        circles: plyAnn?.circles || [],
      };
      sourceNode.edges.push(edge);
    } else if (plyAnn?.note && !existingEdge.note) {
      existingEdge.note = plyAnn.note;
    }
  }
}

export function diffGameWithRepertoire(
  game: StoredGame,
  nodes: Map<string, RepertoireNode>
): {
  inBookPlies: number;
  firstDeviationPly: number | null;
  deviatedBy: "user" | "opponent" | null;
  deviationFen: string | null;
  deviationMoveSan: string | null;
  expectedUserMoves: string[];
} {
  const chess = new Chess();
  let inBookPlies = 0;

  for (let i = 0; i < Math.min(game.movesSan.length, 20); i++) {
    const fenBefore = chess.fen();
    const normBefore = normalizeFen(fenBefore);
    const node = nodes.get(normBefore);
    const mv = chess.move(game.movesSan[i]);
    if (!mv) break;

    const uci = `${mv.from}${mv.to}${mv.promotion || ""}`;
    const moverColor: PlayerColor = mv.color === "w" ? "white" : "black";

    if (!node || node.edges.length === 0) {
      break;
    }

    const matchedEdge = node.edges.find((e) => e.uci === uci || e.san === mv.san);
    if (matchedEdge) {
      inBookPlies++;
      continue;
    }

    // Repertoire exists at this node, but the played move isn't in it
    return {
      inBookPlies,
      firstDeviationPly: i + 1,
      deviatedBy: moverColor === game.userColor ? "user" : "opponent",
      deviationFen: fenBefore,
      deviationMoveSan: mv.san,
      expectedUserMoves: node.edges.map((e) => e.san),
    };
  }

  return {
    inBookPlies,
    firstDeviationPly: null,
    deviatedBy: null,
    deviationFen: null,
    deviationMoveSan: null,
    expectedUserMoves: [],
  };
}

export function exportRepertoireToPgn(
  nodes: RepertoireNode[],
  filterFamilyId?: string
): string {
  const map = new Map(nodes.map((n) => [n.normFen, n]));
  const startNorm = normalizeFen(START_FEN);
  const visitedEdges = new Set<string>();
  const linesOut: string[] = [];

  function dfs(normFen: string, moveHistory: string[], notesTrail: string[]) {
    const node = map.get(normFen);
    if (!node) return;
    const matchingEdges = node.edges.filter((e) =>
      filterFamilyId ? e.familyId === filterFamilyId : true
    );
    if (matchingEdges.length === 0 || moveHistory.length >= 24) {
      if (moveHistory.length > 0) {
        const formatted = formatSanArrayAsPgn(moveHistory);
        const comment = notesTrail.filter(Boolean).slice(-1)[0];
        linesOut.push(comment ? `${formatted} { ${comment.replace(/[{}]/g, "")} }` : formatted);
      }
      return;
    }

    let branched = false;
    for (const edge of matchingEdges) {
      const key = `${normFen}->${edge.uci}`;
      if (visitedEdges.has(key)) continue;
      visitedEdges.add(key);
      branched = true;
      dfs(edge.nextNormFen, [...moveHistory, edge.san], [...notesTrail, edge.note]);
    }
    if (!branched && moveHistory.length > 0) {
      linesOut.push(formatSanArrayAsPgn(moveHistory));
    }
  }

  dfs(startNorm, [], []);

  const title = filterFamilyId ? `ChessVault Repertoire (${filterFamilyId})` : "ChessVault Full Repertoire";
  return linesOut
    .slice(0, 60)
    .map(
      (line, idx) =>
        `[Event "${title} #${idx + 1}"]\n[Site "ChessVault OS"]\n[Result "*"]\n\n${line} *\n`
    )
    .join("\n");
}

function formatSanArrayAsPgn(moves: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      parts.push(`${Math.floor(i / 2) + 1}. ${moves[i]}`);
    } else {
      parts.push(moves[i]);
    }
  }
  return parts.join(" ");
}
