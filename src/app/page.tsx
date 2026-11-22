"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Compass,
  Crosshair,
  Crown,
  Download,
  FileText,
  GitBranch,
  History,
  RefreshCw,
  Sparkles,
  Swords,
} from "lucide-react";
import type {
  ChessComProfile,
  ChessComStats,
  NotebookEntry,
  PatternFamily,
  PersonalBlunderPuzzle,
  StoredGame,
} from "@/types/chess";
import { db, ensureSeeded } from "@/lib/storage/db";
import { fetchProfileSummary, syncChessComGames, type SyncProgress } from "@/lib/storage/sync";
import { analyzePhaseAndClock, detectOpeningLeaks } from "@/lib/chess/patternMiner";

export default function DashboardPage() {
  const [username, setUsername] = useState("ssaabbbbii");
  const [inputUser, setInputUser] = useState("ssaabbbbii");
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [stats, setStats] = useState<ChessComStats | null>(null);
  const [archivesCount, setArchivesCount] = useState(0);
  const [syncedMonthsCount, setSyncedMonthsCount] = useState(0);
  const [games, setGames] = useState<StoredGame[]>([]);
  const [families, setFamilies] = useState<PatternFamily[]>([]);
  const [dueCards, setDueCards] = useState(0);
  const [blunders, setBlunders] = useState<PersonalBlunderPuzzle[]>([]);
  const [notes, setNotes] = useState<NotebookEntry[]>([]);
  const [syncState, setSyncState] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const loadLocalState = useCallback(async (activeUser?: string) => {
    await ensureSeeded();
    const s = await db.settings.get("singleton");
    const u = (activeUser || s?.chessComUsername || "ssaabbbbii").toLowerCase();
    setUsername(u);
    setInputUser(u);

    const [cached, userGames, fams, bls, allNotes, due] = await Promise.all([
      db.profileCache.get(u),
      db.games.where("username").equals(u).reverse().sortBy("endTime"),
      db.families.toArray(),
      db.personalBlunders.toArray(),
      db.notes.toArray(),
      db.drillCards.where("due").belowOrEqual(new Date().toISOString()).count(),
    ]);

    if (cached) {
      setProfile(cached.profile);
      setStats(cached.stats);
      setArchivesCount(cached.archives.length);
    }
    setSyncedMonthsCount(
      (s?.syncedMonths || []).filter((m) => m.startsWith(`${u}:`)).length
    );
    setGames(userGames);
    setFamilies(fams);
    setBlunders(bls);
    setNotes(allNotes);
    setDueCards(due);

    return { user: u, gameCount: userGames.length, hasCache: Boolean(cached) };
  }, []);

  const runSync = useCallback(
    async (targetUser: string, mode: "recent" | "full") => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSyncError("");
      try {
        await syncChessComGames({
          username: targetUser,
          mode,
          recentMonthCount: 3,
          signal: ctrl.signal,
          onProgress: (p) => setSyncState(p),
        });
        await loadLocalState(targetUser);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSyncError(err instanceof Error ? err.message : "Sync failed.");
        }
      } finally {
        setSyncState(null);
      }
    },
    [loadLocalState]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const info = await loadLocalState();
      if (!mounted) return;
      if (!info.hasCache || info.gameCount === 0) {
        // Fetch live Chess.com profile + latest 3 months automatically on first open
        await runSync(info.user, "recent");
      } else {
        // Refresh profile header silently in background
        fetchProfileSummary(info.user)
          .then((d) => {
            if (!mounted) return;
            setProfile(d.profile);
            setStats(d.stats);
            setArchivesCount(d.archives.length);
          })
          .catch(() => {});
      }
    })();
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, [loadLocalState, runSync]);

  const leaks = useMemo(() => detectOpeningLeaks(games, 2).slice(0, 5), [games]);
  const diagnostics = useMemo(() => analyzePhaseAndClock(games), [games]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputUser.trim().toLowerCase();
    if (!clean) return;
    await db.settings.update("singleton", { chessComUsername: clean });
    await runSync(clean, "recent");
  };

  const rapidRating = stats?.chess_rapid?.last?.rating;
  const rapidRecord = stats?.chess_rapid?.record;
  const blitzRating = stats?.chess_blitz?.last?.rating;
  const blitzPeak = stats?.chess_blitz?.best?.rating;
  const tacticsPeak = stats?.tactics?.highest?.rating;

  return (
    <div className="space-y-6">
      {/* Top Player Sync & Profile Banner */}
      <section
        className="rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Chess.com Connected
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Welcome back, <span className="font-mono text-emerald-400">{username}</span>
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Personal Chess Knowledge OS — unlimited Stockfish WASM review, pattern-clubbed opening prep,
            FSRS drills, tactics, endgames, and your living Markdown vault.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <form onSubmit={handleUsernameSubmit} className="flex gap-1.5">
            <input
              type="text"
              value={inputUser}
              onChange={(e) => setInputUser(e.target.value)}
              aria-label="Chess.com username"
              placeholder="Chess.com ID"
              className="rounded-lg border px-3 py-2 text-sm font-mono w-36"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
            <button
              type="submit"
              disabled={Boolean(syncState)}
              className="px-3 py-2 rounded-lg border text-sm font-medium hover:bg-white/5 cursor-pointer disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              Switch
            </button>
          </form>

          <button
            type="button"
            disabled={Boolean(syncState)}
            onClick={() => runSync(username, "recent")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncState ? "animate-spin" : ""}`} />
            <span>Sync Latest</span>
          </button>

          <button
            type="button"
            disabled={Boolean(syncState)}
            onClick={() => runSync(username, "full")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium hover:bg-white/5 cursor-pointer disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
            title="Fetch all monthly archives from Chess.com"
          >
            <History className="w-4 h-4" />
            <span>Sync All ({archivesCount || "..."})</span>
          </button>
        </div>
      </section>

      {/* Sync Progress / Error */}
      {syncState && (
        <div
          className="rounded-xl border p-3.5 flex items-center justify-between gap-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="space-y-1 flex-1">
            <div className="text-xs font-medium flex items-center justify-between">
              <span>
                {syncState.phase === "profile"
                  ? `Fetching Chess.com archives for ${username}...`
                  : `Syncing month ${syncState.currentMonthLabel || ""} (${syncState.completedMonths}/${syncState.totalMonths}) — ${syncState.gamesAdded} games`}
              </span>
              <span>
                {syncState.totalMonths > 0
                  ? Math.round((syncState.completedMonths / syncState.totalMonths) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{
                  width: `${
                    syncState.totalMonths > 0
                      ? Math.max(8, (syncState.completedMonths / syncState.totalMonths) * 100)
                      : 15
                  }%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="px-3 py-1 rounded-lg border text-xs cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            Pause
          </button>
        </div>
      )}

      {syncError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {syncError}
        </div>
      )}

      {/* KPI Metrics Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Rapid Rating
          </div>
          <div className="text-2xl font-bold mt-1 font-mono">{rapidRating ?? "—"}</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {rapidRecord ? `${rapidRecord.win}W · ${rapidRecord.loss}L · ${rapidRecord.draw}D` : "Chess.com Rapid"}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Blitz Rating
          </div>
          <div className="text-2xl font-bold mt-1 font-mono">{blitzRating ?? "—"}</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            Peak: {blitzPeak ?? "—"}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Tactics Peak
          </div>
          <div className="text-2xl font-bold mt-1 font-mono text-amber-400">{tacticsPeak ?? "—"}</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {blunders.length} personal blunders mined
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Synced Games
          </div>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-400">{games.length}</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {syncedMonthsCount}/{archivesCount || "?"} months cached · {diagnostics.analyzedGames} analyzed
          </div>
        </div>

        <div
          className="rounded-xl border p-4 col-span-2 lg:col-span-1"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            FSRS Due Reviews
          </div>
          <div className="text-2xl font-bold mt-1 font-mono text-sky-400">{dueCards}</div>
          <Link href="/practice" className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 mt-1">
            Start Opening Drill <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* Main Action Grid: Top Opening Leaks + Pattern Diagnostics */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Top Opening Leaks */}
        <div
          className="xl:col-span-2 rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Top Opening Leaks (From Your {games.length} Synced Games)</span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                Ranked by frequency × win-rate deficit so you fix high-impact openings first.
              </p>
            </div>
            <Link
              href="/games?tab=patterns"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              Full Pattern Miner <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {leaks.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
              Sync games above to compute your personal opening leaks and color win rates.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="chess-table responsive-stack">
                <thead>
                  <tr>
                    <th>Opening</th>
                    <th>Color</th>
                    <th>Games</th>
                    <th>W / D / L</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaks.map((leak) => (
                    <tr key={`${leak.userColor}-${leak.ecoName}`}>
                      <th className="font-medium max-w-[260px] truncate" title={leak.ecoName}>
                        {leak.ecoName}
                      </th>
                      <td data-label="Color" className="capitalize">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            leak.userColor === "white"
                              ? "bg-slate-100 text-slate-900"
                              : "bg-slate-800 text-slate-100 border border-slate-600"
                          }`}
                        >
                          {leak.userColor}
                        </span>
                      </td>
                      <td data-label="Games" className="font-mono">
                        {leak.games}
                      </td>
                      <td data-label="W/D/L" className="font-mono text-xs">
                        {leak.wins}-{leak.draws}-{leak.losses}
                      </td>
                      <td data-label="Score">
                        <span
                          className={`font-mono font-semibold ${
                            leak.winRate < 45 ? "text-rose-400" : "text-amber-300"
                          }`}
                        >
                          {leak.winRate}%
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/games?game=${encodeURIComponent(leak.recentGameId)}`}
                            className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                          >
                            Review
                          </Link>
                          <Link
                            href="/openings"
                            className="text-xs px-2 py-1 rounded border hover:bg-white/5"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Prep
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pattern Miner Summary */}
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-base font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Pattern & Habit Snapshot</span>
          </h2>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}>
              <div style={{ color: "var(--muted)" }}>White Score</div>
              <div className="text-lg font-bold font-mono mt-0.5">
                {diagnostics.winsByColor.white.winRate}%
              </div>
              <div style={{ color: "var(--muted)" }}>{diagnostics.winsByColor.white.games} games</div>
            </div>
            <div className="rounded-lg p-3 border" style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}>
              <div style={{ color: "var(--muted)" }}>Black Score</div>
              <div className="text-lg font-bold font-mono mt-0.5">
                {diagnostics.winsByColor.black.winRate}%
              </div>
              <div style={{ color: "var(--muted)" }}>{diagnostics.winsByColor.black.games} games</div>
            </div>
            <div className="rounded-lg p-3 border" style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}>
              <div style={{ color: "var(--muted)" }}>Time-Trouble Losses</div>
              <div className="text-lg font-bold font-mono mt-0.5 text-amber-400">
                {diagnostics.timeTroubleLosses}
              </div>
              <div style={{ color: "var(--muted)" }}>&lt; 20s remaining</div>
            </div>
            <div className="rounded-lg p-3 border" style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}>
              <div style={{ color: "var(--muted)" }}>Quick Losses</div>
              <div className="text-lg font-bold font-mono mt-0.5 text-rose-400">
                {diagnostics.quickLossesUnder20Moves}
              </div>
              <div style={{ color: "var(--muted)" }}>&le; 20 moves</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Coach Insights
            </div>
            {diagnostics.recurringPatterns.length > 0 ? (
              <ul className="space-y-2 text-xs leading-relaxed">
                {diagnostics.recurringPatterns.map((p, i) => (
                  <li
                    key={i}
                    className="p-2.5 rounded-lg border"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Run a quick Stockfish batch scan inside Games &amp; Review to uncover phase-specific blunder rates.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Pattern-Clubbed Opening Families Showcase */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Your Pattern-Clubbed Opening Systems</span>
            </h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Related openings grouped by shared tactical &amp; structural DNA with live transposition bridging.
            </p>
          </div>
          <Link href="/openings" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
            Open Graph Studio <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {families.map((fam) => (
            <Link
              key={fam.id}
              href={`/openings?family=${encodeURIComponent(fam.id)}`}
              className="rounded-2xl border p-4 hover:border-emerald-500/50 transition-colors flex flex-col justify-between gap-3"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      fam.color === "white"
                        ? "bg-slate-100 text-slate-900"
                        : "bg-slate-800 text-slate-100 border border-slate-600"
                    }`}
                  >
                    {fam.color}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                    {fam.openingsIncluded.length} linked openings
                  </span>
                </div>
                <h3 className="text-sm font-bold">{fam.name}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {fam.subtitle}
                </p>
              </div>
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span>Explore Shared Blueprint &amp; Lines</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Complete OS Module Launcher */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/games"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Swords className="w-4 h-4 text-emerald-400" /> Chessiro-Style Game Review
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Unlimited Stockfish 19 WASM review, plain-English coach, &amp; 1-click repertoire capture.
          </p>
        </Link>

        <Link
          href="/knowledge"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-sky-400" /> Knowledge Center
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Interactive opening system courses, middlegame pawn breaks, &amp; classic model games.
          </p>
        </Link>

        <Link
          href="/tactics"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Crosshair className="w-4 h-4 text-amber-400" /> Opening-Matched Tactics
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Train your own Chess.com blunders plus curated Vienna, Grand Prix, Latvian &amp; KID puzzles.
          </p>
        </Link>

        <Link
          href="/endgames"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Crown className="w-4 h-4 text-purple-400" /> Endgame Structures Lab
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Philidor, Lucena, Opposition &amp; Minor Piece fortresses played live vs Syzygy Tablebases.
          </p>
        </Link>

        <Link
          href="/practice"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5 sm:col-span-2"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Compass className="w-4 h-4 text-emerald-400" /> FSRS Opening Practice &amp; Bot Sparring
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Drill due variations ({dueCards} ready now), mix Pattern Families, or spar out of book vs Stockfish.
          </p>
        </Link>

        <Link
          href="/notebook"
          className="rounded-xl border p-4 hover:border-emerald-500/50 transition-colors space-y-1.5 sm:col-span-2"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between font-semibold text-sm">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Living Chess Notebook Tree ({notes.length} notes)
            </span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Markdown ZIP · PDF · PGN
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Organized tree (00-dashboard through 06-notebooks) with live embedded boards and 1-click export.
          </p>
        </Link>
      </section>

      {profile?.url && (
        <div className="text-xs flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <GitBranch className="w-3.5 h-3.5" />
          <span>
            Public Chess.com profile:{" "}
            <a
              href={profile.url}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              {profile.url}
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
