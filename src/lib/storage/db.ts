import Dexie, { type EntityTable } from "dexie";
import { Chess } from "chess.js";
import type {
  BoardArrow,
  BoardCircle,
  ChessComProfile,
  ChessComStats,
  DrillCard,
  NotebookEntry,
  OpeningSummary,
  PatternFamily,
  PersonalBlunderPuzzle,
  PlayerColor,
  PuzzleStatsEntry,
  RepertoireNode,
  StoredGame,
  UserSettings,
} from "@/types/chess";
import { SEED_FAMILIES, SEED_OPENING_LINES, SEED_OPENING_SUMMARIES } from "@/data/seedOpenings";
import { SEED_NOTEBOOK_ENTRIES } from "@/data/seedNotebook";
import { buildGraphFromSeedLines, insertLineIntoMap } from "@/lib/chess/openingGraph";
import { canonicalFullFen, normalizeFen, START_FEN } from "@/lib/chess/fen";
import { createNewDrillCard } from "@/lib/fsrs/scheduler";

export interface ProfileCacheRecord {
  username: string;
  profile: ChessComProfile;
  stats: ChessComStats;
  archives: string[];
  updatedAt: number;
}

class ChessVaultDB extends Dexie {
  settings!: EntityTable<UserSettings, "id">;
  profileCache!: EntityTable<ProfileCacheRecord, "username">;
  games!: EntityTable<StoredGame, "id">;
  families!: EntityTable<PatternFamily, "id">;
  openings!: EntityTable<OpeningSummary, "id">;
  nodes!: EntityTable<RepertoireNode, "normFen">;
  drillCards!: EntityTable<DrillCard, "id">;
  personalBlunders!: EntityTable<PersonalBlunderPuzzle, "id">;
  notes!: EntityTable<NotebookEntry, "id">;
  puzzleStats!: EntityTable<PuzzleStatsEntry, "puzzleId">;

  constructor() {
    super("ChessVaultOS_v1");
    this.version(1).stores({
      settings: "id",
      profileCache: "username",
      games: "id, username, endTime, timeClass, userColor, result, ecoName, yearMonth",
      families: "id, color, createdAt",
      openings: "id, familyId, color",
      nodes: "normFen, updatedAt",
      drillCards: "id, type, color, familyId, openingId, due, normFen",
      personalBlunders: "id, gameId, motif, playedAt",
      notes: "id, path, folder, updatedAt",
      puzzleStats: "puzzleId, motif",
    });
  }
}

export const db = new ChessVaultDB();

let seedPromise: Promise<void> | null = null;

function generateSeedDrillCards(nodesMap: Map<string, RepertoireNode>): DrillCard[] {
  const cards = new Map<string, DrillCard>();
  const openingsById = new Map(SEED_OPENING_SUMMARIES.map((o) => [o.id, o]));

  for (const line of SEED_OPENING_LINES) {
    const chess = new Chess();
    const history: string[] = [];

    for (let i = 0; i < line.movesSan.length; i++) {
      const promptFen = chess.fen();
      const normBefore = normalizeFen(promptFen);
      const mv = chess.move(line.movesSan[i]);
      if (!mv) break;

      const moverColor: PlayerColor = mv.color === "w" ? "white" : "black";
      const uci = `${mv.from}${mv.to}${mv.promotion || ""}`;
      const opening = openingsById.get(line.openingId);
      const oppLast = history.length > 0 ? history[history.length - 1] : undefined;

      if (moverColor === line.color && i >= 2) {
        const cardId = `${line.color}:${normBefore}:${uci}`;
        if (!cards.has(cardId)) {
          const node = nodesMap.get(normBefore);
          const edge = node?.edges.find((e) => e.uci === uci);
          const destNode = nodesMap.get(normalizeFen(chess.fen()));
          cards.set(
            cardId,
            createNewDrillCard({
              id: cardId,
              type: "opening",
              color: line.color,
              familyId: line.familyId,
              openingId: line.openingId,
              openingName: opening?.name || line.openingName,
              promptFen,
              normFen: normBefore,
              expectedUci: uci,
              expectedSan: mv.san,
              opponentLastMoveSan: oppLast,
              lineContextSan: [...history],
              coachHint:
                edge?.note ||
                destNode?.notes ||
                opening?.tagline ||
                `Play the ${line.openingName} continuation.`,
            })
          );
        }
      }
      history.push(mv.san);
    }
  }

  return [...cards.values()];
}

export async function ensureSeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const existingSettings = await db.settings.get("singleton");
    if (!existingSettings) {
      await db.settings.put({
        id: "singleton",
        chessComUsername: "ssaabbbbii",
        theme: "dark",
        boardTheme: "brown",
        syncedMonths: [],
        totalArchivesAvailable: 0,
        completedCourseIds: [],
        completedEndgameIds: [],
      });
    }

    const familyCount = await db.families.count();
    if (familyCount === 0) {
      await db.families.bulkPut(SEED_FAMILIES);
    }

    const openingCount = await db.openings.count();
    if (openingCount === 0) {
      await db.openings.bulkPut(SEED_OPENING_SUMMARIES);
    }

    const nodeCount = await db.nodes.count();
    if (nodeCount === 0) {
      const graph = buildGraphFromSeedLines(SEED_OPENING_LINES);
      await db.nodes.bulkPut([...graph.values()]);
      const drillCount = await db.drillCards.count();
      if (drillCount === 0) {
        const cards = generateSeedDrillCards(graph);
        await db.drillCards.bulkPut(cards);
      }
    }

    const noteCount = await db.notes.count();
    if (noteCount === 0) {
      await db.notes.bulkPut(SEED_NOTEBOOK_ENTRIES);
    }
  })();

  try {
    await seedPromise;
  } catch (err) {
    seedPromise = null;
    throw err;
  }
}

export async function saveQuickPrepLine(params: {
  movesSan: string[];
  color: PlayerColor;
  familyId: string;
  openingId: string;
  openingName: string;
  note?: string;
  tags?: string[];
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
  targetPlyIndex?: number; // 1-based ply to annotate
}): Promise<{ nodesSaved: number; drillCardsAdded: number; transpositionDetected: boolean }> {
  await ensureSeeded();
  const existingNodes = await db.nodes.toArray();
  const map = new Map(existingNodes.map((n) => [n.normFen, n]));

  if (!map.has(normalizeFen(START_FEN))) {
    map.set(normalizeFen(START_FEN), {
      normFen: normalizeFen(START_FEN),
      fullFen: START_FEN,
      edges: [],
      transpositionNames: [],
      notes: "",
      arrows: [],
      circles: [],
      updatedAt: Date.now(),
    });
  }

  const targetPly = params.targetPlyIndex ?? params.movesSan.length;
  insertLineIntoMap(map, {
    openingId: params.openingId,
    openingName: params.openingName,
    familyId: params.familyId,
    color: params.color,
    movesSan: params.movesSan,
    isMainLine: true,
    tags: params.tags || ["#plan"],
    annotationsByPly: {
      [targetPly]: {
        note: params.note || "",
        tags: params.tags,
        arrows: params.arrows,
        circles: params.circles,
      },
    },
  });

  // Ensure OpeningSummary exists
  const existingOpening = await db.openings.get(params.openingId);
  if (!existingOpening) {
    await db.openings.put({
      id: params.openingId,
      name: params.openingName,
      familyId: params.familyId,
      color: params.color,
      eco: "Custom",
      tagline: params.note || `Custom prep line in ${params.openingName}`,
      startMovesSan: params.movesSan.slice(0, 6),
      benefits: [],
    });
    const fam = await db.families.get(params.familyId);
    if (fam && !fam.openingsIncluded.includes(params.openingId)) {
      fam.openingsIncluded.push(params.openingId);
      await db.families.put(fam);
    }
  }

  const updatedNodes = [...map.values()];
  await db.nodes.bulkPut(updatedNodes);

  // Create drill cards for user's moves in this line
  const chess = new Chess();
  const history: string[] = [];
  let drillCardsAdded = 0;
  let transpositionDetected = false;

  for (let i = 0; i < params.movesSan.length; i++) {
    const promptFen = chess.fen();
    const normBefore = normalizeFen(promptFen);
    const mv = chess.move(params.movesSan[i]);
    if (!mv) break;
    const normAfter = normalizeFen(chess.fen());
    const destNode = map.get(normAfter);
    if (destNode && destNode.transpositionNames.length > 1) {
      transpositionDetected = true;
    }

    const moverColor: PlayerColor = mv.color === "w" ? "white" : "black";
    const uci = `${mv.from}${mv.to}${mv.promotion || ""}`;
    if (moverColor === params.color && i >= 1) {
      const cardId = `${params.color}:${normBefore}:${uci}`;
      const existingCard = await db.drillCards.get(cardId);
      if (!existingCard) {
        await db.drillCards.put(
          createNewDrillCard({
            id: cardId,
            type: "opening",
            color: params.color,
            familyId: params.familyId,
            openingId: params.openingId,
            openingName: params.openingName,
            promptFen,
            normFen: normBefore,
            expectedUci: uci,
            expectedSan: mv.san,
            opponentLastMoveSan: history[history.length - 1],
            lineContextSan: [...history],
            coachHint: params.note || `Play ${mv.san} in ${params.openingName}.`,
          })
        );
        drillCardsAdded++;
      }
    }
    history.push(mv.san);
  }

  return {
    nodesSaved: updatedNodes.length,
    drillCardsAdded,
    transpositionDetected,
  };
}

export async function saveNodeCustomAnnotations(params: {
  normFen: string;
  notes?: string;
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
}) {
  await ensureSeeded();
  const existing = await db.nodes.get(params.normFen);
  if (existing) {
    existing.notes = params.notes ?? existing.notes;
    existing.arrows = params.arrows ?? existing.arrows;
    existing.circles = params.circles ?? existing.circles;
    existing.updatedAt = Date.now();
    await db.nodes.put(existing);
    return existing;
  }
  const fresh: RepertoireNode = {
    normFen: params.normFen,
    fullFen: canonicalFullFen(params.normFen),
    edges: [],
    transpositionNames: [],
    notes: params.notes || "",
    arrows: params.arrows || [],
    circles: params.circles || [],
    updatedAt: Date.now(),
  };
  await db.nodes.put(fresh);
  return fresh;
}
