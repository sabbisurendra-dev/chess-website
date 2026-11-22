import type { ChessComProfile, ChessComStats, PlayerColor, StoredGame } from "@/types/chess";
import { formatEcoSlug, parseGamePgn } from "@/lib/chess/pgn";
import { db, ensureSeeded } from "./db";

interface RawChessComGame {
  url: string;
  pgn?: string;
  time_control?: string;
  end_time: number;
  rated?: boolean;
  time_class?: string;
  rules?: string;
  eco?: string;
  white: {
    username: string;
    rating: number;
    result: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
  };
}

const WIN_RESULTS = new Set(["win"]);
const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

function mapChessComGame(raw: RawChessComGame, targetUsername: string, yearMonth: string): StoredGame | null {
  if (!raw.pgn || (raw.rules && raw.rules !== "chess")) return null;

  const targetLower = targetUsername.toLowerCase();
  const isWhite = raw.white?.username?.toLowerCase() === targetLower;
  const isBlack = raw.black?.username?.toLowerCase() === targetLower;
  if (!isWhite && !isBlack) return null;

  const userColor: PlayerColor = isWhite ? "white" : "black";
  const userSide = isWhite ? raw.white : raw.black;
  const oppSide = isWhite ? raw.black : raw.white;

  let result: "win" | "loss" | "draw" = "loss";
  if (WIN_RESULTS.has(userSide.result)) result = "win";
  else if (DRAW_RESULTS.has(userSide.result)) result = "draw";

  const parsed = parseGamePgn(raw.pgn);
  if (parsed.movesSan.length === 0) return null;

  const eco = formatEcoSlug(raw.eco || parsed.headers.ECOUrl, parsed.headers);
  const gameIdSegment = raw.url?.split("/").pop() || `${raw.end_time}-${oppSide.username}`;
  const timeClassRaw = (raw.time_class || "other").toLowerCase();
  const timeClass: StoredGame["timeClass"] =
    timeClassRaw === "rapid" ||
    timeClassRaw === "blitz" ||
    timeClassRaw === "bullet" ||
    timeClassRaw === "daily"
      ? timeClassRaw
      : "other";

  return {
    id: `${targetLower}-${gameIdSegment}`,
    username: targetLower,
    url: raw.url,
    pgn: raw.pgn,
    endTime: raw.end_time,
    yearMonth,
    timeClass,
    timeControl: raw.time_control || "",
    rated: Boolean(raw.rated),
    rules: raw.rules || "chess",
    userColor,
    userRating: userSide.rating || 0,
    opponentName: oppSide.username || "Opponent",
    opponentRating: oppSide.rating || 0,
    result,
    termination: parsed.headers.Termination || oppSide.result || userSide.result || "",
    ecoSlug: eco.slug,
    ecoName: eco.name,
    openingMovesKey: parsed.openingMovesKey,
    movesSan: parsed.movesSan,
    clocksSec: parsed.clocksSec,
  };
}

export interface SyncProgress {
  phase: "profile" | "archives" | "done";
  completedMonths: number;
  totalMonths: number;
  currentMonthLabel?: string;
  gamesAdded: number;
}

export async function fetchProfileSummary(username: string): Promise<{
  profile: ChessComProfile;
  stats: ChessComStats;
  archives: string[];
}> {
  const clean = username.trim().toLowerCase();
  const res = await fetch(`/api/chesscom/profile?username=${encodeURIComponent(clean)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load Chess.com profile (${res.status})`);
  }
  const data = await res.json();
  await db.profileCache.put({
    username: clean,
    profile: data.profile,
    stats: data.stats,
    archives: data.archives || [],
    updatedAt: Date.now(),
  });
  return data;
}

export async function syncChessComGames(params: {
  username: string;
  mode: "recent" | "full";
  recentMonthCount?: number;
  onProgress?: (p: SyncProgress) => void;
  signal?: AbortSignal;
}): Promise<{ gamesTotal: number; gamesAdded: number }> {
  await ensureSeeded();
  const username = params.username.trim().toLowerCase();
  const recentCount = params.recentMonthCount ?? 3;

  params.onProgress?.({
    phase: "profile",
    completedMonths: 0,
    totalMonths: 1,
    gamesAdded: 0,
  });

  const { archives } = await fetchProfileSummary(username);
  if (archives.length === 0) {
    return { gamesTotal: 0, gamesAdded: 0 };
  }

  // Archives come oldest -> newest from Chess.com; reverse so newest sync first!
  const reversed = [...archives].reverse();
  const targetUrls = params.mode === "recent" ? reversed.slice(0, recentCount) : reversed;

  const settings = await db.settings.get("singleton");
  const alreadySynced = new Set(settings?.syncedMonths || []);
  const currentUtcMonth = `${new Date().getUTCFullYear()}/${String(
    new Date().getUTCMonth() + 1
  ).padStart(2, "0")}`;

  // Always re-fetch the latest/current month, skip historical months already cached unless missing
  const urlsToFetch = targetUrls.filter((u, idx) => {
    const ym = u.split("/").slice(-2).join("/");
    if (idx === 0 || ym === currentUtcMonth) return true;
    return !alreadySynced.has(`${username}:${ym}`);
  });

  let gamesAdded = 0;
  for (let i = 0; i < urlsToFetch.length; i++) {
    if (params.signal?.aborted) break;
    const url = urlsToFetch[i];
    const parts = url.split("/");
    const year = parts[parts.length - 2];
    const month = parts[parts.length - 1];
    const ym = `${year}/${month}`;

    params.onProgress?.({
      phase: "archives",
      completedMonths: i,
      totalMonths: urlsToFetch.length,
      currentMonthLabel: ym,
      gamesAdded,
    });

    const res = await fetch(
      `/api/chesscom/archive?username=${encodeURIComponent(username)}&year=${year}&month=${month}`,
      { signal: params.signal }
    );

    if (res.status === 429) {
      // Respect Chess.com rate limit cleanly with a brief backoff
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) continue;

    const payload = await res.json();
    const rawGames: RawChessComGame[] = payload.games || [];
    const mapped = rawGames
      .map((g) => mapChessComGame(g, username, ym))
      .filter((g): g is StoredGame => g !== null);

    if (mapped.length > 0) {
      // Preserve existing Stockfish analysis if already analyzed!
      const existingRows = await db.games.bulkGet(mapped.map((m) => m.id));
      const existingById = new Map(
        existingRows.filter((r): r is StoredGame => Boolean(r)).map((r) => [r.id, r])
      );
      const merged = mapped.map((m) => {
        const prev = existingById.get(m.id);
        if (prev?.analyzed) {
          return {
            ...m,
            analyzed: prev.analyzed,
            whiteAccuracy: prev.whiteAccuracy,
            blackAccuracy: prev.blackAccuracy,
            userAccuracy: prev.userAccuracy,
            counts: prev.counts,
            reviewMoves: prev.reviewMoves,
          };
        }
        return m;
      });
      await db.games.bulkPut(merged);
      gamesAdded += mapped.length;
    }

    alreadySynced.add(`${username}:${ym}`);

    if (i < urlsToFetch.length - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  const totalForUser = await db.games.where("username").equals(username).count();
  await db.settings.update("singleton", {
    chessComUsername: username,
    lastSyncedAt: Date.now(),
    syncedMonths: [...alreadySynced],
    totalArchivesAvailable: archives.length,
  });

  params.onProgress?.({
    phase: "done",
    completedMonths: urlsToFetch.length,
    totalMonths: urlsToFetch.length,
    gamesAdded,
  });

  return { gamesTotal: totalForUser, gamesAdded };
}
