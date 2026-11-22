export type PlayerColor = "white" | "black";

export type MoveClassification =
  | "brilliant"
  | "best"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface BoardArrow {
  orig: string;
  dest: string;
  brush: "green" | "red" | "blue" | "yellow";
}

export interface BoardCircle {
  orig: string;
  brush: "green" | "red" | "blue" | "yellow";
}

export interface ChessComStats {
  chess_rapid?: {
    last?: { rating: number; date: number; rd: number };
    best?: { rating: number; date: number; game?: string };
    record?: { win: number; loss: number; draw: number };
  };
  chess_blitz?: {
    last?: { rating: number; date: number; rd: number };
    best?: { rating: number; date: number; game?: string };
    record?: { win: number; loss: number; draw: number };
  };
  chess_bullet?: {
    last?: { rating: number; date: number; rd: number };
    best?: { rating: number; date: number; game?: string };
    record?: { win: number; loss: number; draw: number };
  };
  chess_daily?: {
    last?: { rating: number; date: number; rd: number };
    best?: { rating: number; date: number; game?: string };
    record?: { win: number; loss: number; draw: number };
  };
  tactics?: {
    highest?: { rating: number; date: number };
    lowest?: { rating: number; date: number };
  };
}

export interface ChessComProfile {
  username: string;
  avatar?: string;
  url?: string;
  title?: string;
  country?: string;
  followers?: number;
  joined?: number;
  last_online?: number;
}

export interface StoredGame {
  id: string; // e.g., chess.com game UUID or URL hash
  username: string;
  url: string;
  pgn: string;
  endTime: number; // unix seconds
  yearMonth: string; // e.g., "2026/11"
  timeClass: "rapid" | "blitz" | "bullet" | "daily" | "other";
  timeControl: string;
  rated: boolean;
  rules: string;
  userColor: PlayerColor;
  userRating: number;
  opponentName: string;
  opponentRating: number;
  result: "win" | "loss" | "draw";
  termination: string;
  ecoSlug: string;
  ecoName: string;
  openingMovesKey: string; // first 6 plies SAN normalized
  movesSan: string[];
  clocksSec: number[]; // remaining seconds at each ply if [%clk] present
  analyzed?: boolean;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  userAccuracy?: number;
  counts?: {
    brilliant: number;
    best: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  reviewMoves?: AnalyzedPly[];
}

export interface AnalyzedPly {
  ply: number; // 1-based ply index
  moveSan: string;
  moveUci: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number; // from White's POV (clamped +/- 10000 for mate)
  evalAfterCp: number;
  mateBefore?: number | null; // moves to mate from White's POV (+ White mates, - Black mates)
  mateAfter?: number | null;
  bestMoveUci: string;
  bestMoveSan: string;
  pvSan: string[];
  cpLoss: number;
  classification: MoveClassification;
  coachExplanation: string;
  clockRemainingSec?: number;
  phase: "opening" | "middlegame" | "endgame";
}

export interface PatternFamily {
  id: string;
  name: string;
  color: PlayerColor;
  subtitle: string;
  dnaSummary: string;
  sharedBlueprint: string[];
  keyBenefits: string[];
  comparisonRows: {
    aspect: string;
    columns: Record<string, string>;
  }[];
  openingsIncluded: string[]; // opening slugs/ids
  createdAt: number;
}

export interface RepertoireMoveEdge {
  san: string;
  uci: string;
  nextNormFen: string;
  openingId: string;
  openingName: string;
  familyId: string;
  isMainLine: boolean;
  tags: string[]; // #plan, #trap, #sideline, #must-know, #transposition
  note: string;
  arrows: BoardArrow[];
  circles: BoardCircle[];
}

export interface RepertoireNode {
  normFen: string; // first 4 FEN fields
  fullFen: string; // canonical full FEN (default 0 1)
  edges: RepertoireMoveEdge[];
  transpositionNames: string[]; // distinct opening names reaching this FEN
  notes: string;
  arrows: BoardArrow[];
  circles: BoardCircle[];
  updatedAt: number;
}

export interface OpeningSummary {
  id: string;
  name: string;
  familyId: string;
  color: PlayerColor;
  eco: string;
  tagline: string;
  startMovesSan: string[];
  benefits: string[];
}

export interface DrillCard {
  id: string; // `${color}:${normFen}:${uci}`
  type: "opening" | "blunder";
  color: PlayerColor;
  familyId?: string;
  openingId?: string;
  openingName?: string;
  promptFen: string;
  normFen: string;
  expectedUci: string;
  expectedSan: string;
  opponentLastMoveSan?: string;
  lineContextSan: string[];
  coachHint: string;
  // ts-fsrs serialized card fields
  due: string; // ISO date
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface PersonalBlunderPuzzle {
  id: string;
  gameId: string;
  gameUrl: string;
  playedAt: number;
  userColor: PlayerColor;
  fen: string;
  bestMoveUci: string;
  bestMoveSan: string;
  playedMoveSan: string;
  pvSan: string[];
  cpLoss: number;
  motif: string;
  openingName: string;
  coachExplanation: string;
  solvedCount: number;
  failedCount: number;
  lastAttemptAt?: number;
}

export interface CuratedPuzzle {
  id: string;
  title: string;
  fen: string;
  movesUci: string[]; // solution sequence; index 0 is player's 1st move (FEN turn plays first!)
  rating: number;
  motif: string;
  secondaryMotifs: string[];
  openingFamily:
    | "Vienna Game"
    | "Grand Prix / Sicilian"
    | "Latvian / Rousseau"
    | "King's Indian"
    | "Endgame & General";
  explanation: string;
  hint: string;
}

export interface CourseStep {
  title: string;
  fen: string;
  movesFromStartSan?: string[];
  explanation: string;
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
  checkpointPrompt?: string;
  checkpointAnswerUci?: string;
  checkpointAnswerSan?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  category: "Opening Systems" | "Middlegame Structures" | "Tactical Motifs" | "Classic Model Games";
  level: "Core" | "Intermediate" | "Sharp";
  familyId?: string;
  ecoFilter?: string[];
  summary: string;
  keyTakeaways: string[];
  steps: CourseStep[];
}

export interface EndgameStructure {
  id: string;
  title: string;
  category: "King & Pawn" | "Rook Endings" | "Minor Piece" | "Queen & Heavy";
  goal: "Win" | "Draw" | "Convert";
  difficulty: "Essential" | "Intermediate" | "Advanced";
  fen: string;
  playerColor: PlayerColor;
  keyRules: string[];
  demoLineSan: string[];
  demoAnnotations: string[];
  arrows?: BoardArrow[];
  successHint: string;
}

export interface NotebookEntry {
  id: string;
  path: string; // e.g. "01-openings/white/family-nc3-f4-kingside-attack/vienna-game-gambit.md"
  folder: string; // e.g. "01-openings/white/family-nc3-f4-kingside-attack"
  title: string;
  tags: string[];
  content: string; // Markdown with [[fen:...]], [[line:...]], [[family:...]], [[game:...]]
  pinnedFens: string[];
  updatedAt: number;
  createdAt: number;
}

export interface PuzzleStatsEntry {
  puzzleId: string;
  motif: string;
  solved: number;
  failed: number;
  totalTimeMs: number;
  lastSolvedAt?: number;
}

export interface UserSettings {
  id: "singleton";
  chessComUsername: string;
  theme: "dark" | "light" | "system";
  boardTheme: "brown" | "slate" | "green";
  lastSyncedAt?: number;
  syncedMonths: string[];
  totalArchivesAvailable: number;
  completedCourseIds: string[];
  completedEndgameIds: string[];
}
