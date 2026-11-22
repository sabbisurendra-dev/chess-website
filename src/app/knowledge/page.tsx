"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  Swords,
} from "lucide-react";
import type { CourseModule, StoredGame } from "@/types/chess";
import { SEED_COURSES } from "@/data/seedCourses";
import { db, ensureSeeded } from "@/lib/storage/db";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";

const CATEGORIES = [
  "All",
  "Opening Systems",
  "Middlegame Structures",
  "Tactical Motifs",
  "Classic Model Games",
] as const;

export default function KnowledgePage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [selectedCourse, setSelectedCourse] = useState<CourseModule>(SEED_COURSES[0]);
  const [stepIdx, setStepIdx] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [games, setGames] = useState<StoredGame[]>([]);
  const [checkpointState, setCheckpointState] = useState<{ status: "idle" | "ok" | "wrong"; msg: string }>({
    status: "idle",
    msg: "",
  });
  const [toast, setToast] = useState("");

  const loadUserContext = useCallback(async () => {
    await ensureSeeded();
    const s = await db.settings.get("singleton");
    const u = (s?.chessComUsername || "ssaabbbbii").toLowerCase();
    setCompletedIds(s?.completedCourseIds || []);
    const userGames = await db.games.where("username").equals(u).reverse().sortBy("endTime");
    setGames(userGames);
  }, []);

  useEffect(() => {
    loadUserContext();
  }, [loadUserContext]);

  const filteredCourses = useMemo(
    () =>
      category === "All"
        ? SEED_COURSES
        : SEED_COURSES.filter((c) => c.category === category),
    [category]
  );

  const currentStep = selectedCourse.steps[stepIdx] || selectedCourse.steps[0];

  const matchingGames = useMemo(() => {
    if (!selectedCourse.ecoFilter || selectedCourse.ecoFilter.length === 0) return [];
    const tokens = selectedCourse.ecoFilter.map((t) => t.toLowerCase());
    return games
      .filter((g) => {
        const hay = `${g.ecoSlug} ${g.ecoName}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      })
      .slice(0, 6);
  }, [games, selectedCourse]);

  const handleSelectCourse = (c: CourseModule) => {
    setSelectedCourse(c);
    setStepIdx(0);
    setCheckpointState({ status: "idle", msg: "" });
  };

  const handleToggleComplete = async (courseId: string) => {
    const next = completedIds.includes(courseId)
      ? completedIds.filter((id) => id !== courseId)
      : [...completedIds, courseId];
    setCompletedIds(next);
    await db.settings.update("singleton", { completedCourseIds: next });
  };

  const handleCheckpointMove = (mv: { uci: string; san: string }) => {
    if (!currentStep.checkpointAnswerUci) return;
    if (
      mv.uci === currentStep.checkpointAnswerUci ||
      mv.san === currentStep.checkpointAnswerSan
    ) {
      setCheckpointState({
        status: "ok",
        msg: `Spot on! ${mv.san} — ${currentStep.explanation}`,
      });
    } else {
      setCheckpointState({
        status: "wrong",
        msg: `${mv.san} misses the core idea here. Hint: look at ${currentStep.explanation.slice(0, 90)}...`,
      });
    }
  };

  const handleCopyToNotebook = async () => {
    const folder =
      selectedCourse.category === "Opening Systems"
        ? "01-openings"
        : selectedCourse.category === "Tactical Motifs"
          ? "03-tactics"
          : "02-middlegame-structures";
    const md = [
      `# ${selectedCourse.title}`,
      "",
      selectedCourse.summary,
      "",
      "## Key Takeaways",
      ...selectedCourse.keyTakeaways.map((k) => `- ${k}`),
      "",
      ...selectedCourse.steps.flatMap((st) => [
        `## ${st.title}`,
        st.explanation,
        `[[fen:${st.fen}]]`,
        "",
      ]),
    ].join("\n");

    await db.notes.put({
      id: `note-course-${selectedCourse.id}`,
      path: `${folder}/${selectedCourse.id}.md`,
      folder,
      title: selectedCourse.title,
      tags: ["course", selectedCourse.category.toLowerCase().replace(/\s+/g, "-")],
      content: md,
      pinnedFens: selectedCourse.steps.map((s) => s.fen),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setToast(`Saved "${selectedCourse.title}" into Chess Notebook (${folder}/)!`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Knowledge Center &amp; Courses</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Structured Chessly/Chessiro-style lessons on your pattern families, pawn structures, tactical motifs, and classic games.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                category === cat
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "hover:bg-white/5"
              }`}
              style={category !== cat ? { borderColor: "var(--border)" } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Course Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCourses.map((c) => {
          const active = c.id === selectedCourse.id;
          const done = completedIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectCourse(c)}
              className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                active ? "border-emerald-500 bg-emerald-500/10" : "hover:bg-white/5"
              }`}
              style={!active ? { backgroundColor: "var(--surface)", borderColor: "var(--border)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-white/5 font-medium">{c.category}</span>
                {done ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>{c.steps.length} lessons</span>
                )}
              </div>
              <div className="text-sm font-bold mt-2">{c.title}</div>
              <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>
                {c.summary}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Lesson Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div
          className="xl:col-span-5 rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <InteractiveBoard
            fen={currentStep.fen}
            orientation={selectedCourse.familyId?.startsWith("black") ? "black" : "white"}
            interactive={Boolean(currentStep.checkpointAnswerUci && checkpointState.status !== "ok")}
            arrows={
              checkpointState.status === "ok" || !currentStep.checkpointAnswerUci
                ? currentStep.arrows || []
                : []
            }
            circles={currentStep.circles || []}
            onMove={handleCheckpointMove}
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setStepIdx((i) => Math.max(0, i - 1));
                setCheckpointState({ status: "idle", msg: "" });
              }}
              disabled={stepIdx === 0}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer disabled:opacity-40 flex items-center gap-1"
              style={{ borderColor: "var(--border)" }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev Chapter
            </button>
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              {stepIdx + 1} / {selectedCourse.steps.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setStepIdx((i) => Math.min(selectedCourse.steps.length - 1, i + 1));
                setCheckpointState({ status: "idle", msg: "" });
              }}
              disabled={stepIdx === selectedCourse.steps.length - 1}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer disabled:opacity-40 flex items-center gap-1"
              style={{ borderColor: "var(--border)" }}
            >
              Next Chapter <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className="xl:col-span-7 rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> {selectedCourse.category} · {selectedCourse.level}
              </div>
              <h2 className="text-lg font-bold mt-1">{currentStep.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyToNotebook}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" /> Copy to Notebook
              </button>
              <button
                type="button"
                onClick={() => handleToggleComplete(selectedCourse.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  completedIds.includes(selectedCourse.id)
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-emerald-600 text-white"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completedIds.includes(selectedCourse.id) ? "Completed" : "Mark Complete"}
              </button>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{currentStep.explanation}</p>

          {currentStep.checkpointPrompt && (
            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                checkpointState.status === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/15"
                  : checkpointState.status === "wrong"
                    ? "border-rose-500/40 bg-rose-500/15"
                    : "border-sky-500/35 bg-sky-500/10"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Interactive Checkpoint
              </div>
              <div className="text-sm font-medium">{currentStep.checkpointPrompt}</div>
              {checkpointState.status !== "idle" && (
                <div className="text-xs font-semibold">{checkpointState.msg}</div>
              )}
            </div>
          )}

          <div
            className="rounded-xl border p-4 space-y-2"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Core Takeaways for {selectedCourse.title}
            </div>
            <ul className="space-y-1.5 text-xs list-disc pl-4 leading-relaxed">
              {selectedCourse.keyTakeaways.map((kt, idx) => (
                <li key={idx}>{kt}</li>
              ))}
            </ul>
          </div>

          {/* Real ssaabbbbii Games Matching This Lesson */}
          {matchingGames.length > 0 && (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-emerald-400" />
                <span>Your Real Chess.com Games Using This System</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchingGames.map((g) => (
                  <Link
                    key={g.id}
                    href={`/games?game=${encodeURIComponent(g.id)}`}
                    className="rounded-lg border px-3 py-2 text-xs hover:border-emerald-500/50 flex items-center justify-between gap-2"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        vs {g.opponentName} ({g.userColor})
                      </div>
                      <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
                        {g.ecoName} · {g.result.toUpperCase()}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
