import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";
import type { DrillCard, PlayerColor } from "@/types/chess";

const scheduler = fsrs();

export type DrillGrade = "again" | "hard" | "good" | "easy";

const GRADE_TO_RATING: Record<DrillGrade, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function createNewDrillCard(params: {
  id: string;
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
}): DrillCard {
  const empty = createEmptyCard(new Date());
  return {
    ...params,
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: 0,
    scheduled_days: empty.scheduled_days,
    learning_steps: empty.learning_steps,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state,
    last_review: empty.last_review ? empty.last_review.toISOString() : undefined,
  };
}

function toFsrsCard(dc: DrillCard): Card {
  return {
    due: new Date(dc.due),
    stability: dc.stability,
    difficulty: dc.difficulty,
    scheduled_days: dc.scheduled_days,
    learning_steps: dc.learning_steps ?? 0,
    reps: dc.reps,
    lapses: dc.lapses,
    state: (dc.state as State) ?? State.New,
    last_review: dc.last_review ? new Date(dc.last_review) : undefined,
  };
}

export function gradeDrillCard(card: DrillCard, grade: DrillGrade, now = new Date()): DrillCard {
  const fCard = toFsrsCard(card);
  const result = scheduler.repeat(fCard, now);
  const rating = GRADE_TO_RATING[grade];
  const updated = (result as unknown as Record<number, { card: Card }>)[rating].card;

  return {
    ...card,
    due: updated.due.toISOString(),
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsed_days: 0,
    scheduled_days: updated.scheduled_days,
    learning_steps: updated.learning_steps,
    reps: updated.reps,
    lapses: updated.lapses,
    state: updated.state,
    last_review: updated.last_review ? updated.last_review.toISOString() : now.toISOString(),
  };
}

export function previewNextIntervals(card: DrillCard, now = new Date()): Record<DrillGrade, string> {
  const fCard = toFsrsCard(card);
  const result = scheduler.repeat(fCard, now) as unknown as Record<number, { card: Card }>;

  const formatDelta = (due: Date): string => {
    const mins = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.round(hrs / 24);
    return `${days}d`;
  };

  return {
    again: formatDelta(result[Rating.Again].card.due),
    hard: formatDelta(result[Rating.Hard].card.due),
    good: formatDelta(result[Rating.Good].card.due),
    easy: formatDelta(result[Rating.Easy].card.due),
  };
}

export function isCardDue(card: DrillCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}
