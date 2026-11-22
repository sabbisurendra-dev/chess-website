"use client";

import React, { useEffect, useState } from "react";
import type { BoardArrow, BoardCircle, OpeningSummary, PatternFamily, PlayerColor } from "@/types/chess";
import { ModalDialog } from "@/components/layout/ModalDialog";
import { db, ensureSeeded, saveQuickPrepLine } from "@/lib/storage/db";

interface QuickSavePrepModalProps {
  open: boolean;
  onClose: () => void;
  movesSan: string[];
  defaultColor?: PlayerColor;
  defaultNote?: string;
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
  onSaved?: (msg: string) => void;
}

export function QuickSavePrepModal({
  open,
  onClose,
  movesSan,
  defaultColor = "white",
  defaultNote = "",
  arrows = [],
  circles = [],
  onSaved,
}: QuickSavePrepModalProps) {
  const [families, setFamilies] = useState<PatternFamily[]>([]);
  const [openings, setOpenings] = useState<OpeningSummary[]>([]);
  const [color, setColor] = useState<PlayerColor>(defaultColor);
  const [familyId, setFamilyId] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [customOpeningName, setCustomOpeningName] = useState("");
  const [note, setNote] = useState(defaultNote);
  const [selectedTags, setSelectedTags] = useState<string[]>(["#plan"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setColor(defaultColor);
    setNote(defaultNote);
    setError("");
    (async () => {
      await ensureSeeded();
      const [fams, ops] = await Promise.all([db.families.toArray(), db.openings.toArray()]);
      setFamilies(fams);
      setOpenings(ops);
      const matchingFam = fams.find((f) => f.color === defaultColor) || fams[0];
      if (matchingFam) {
        setFamilyId(matchingFam.id);
        const op = ops.find((o) => o.familyId === matchingFam.id);
        if (op) setOpeningId(op.id);
      }
    })();
  }, [open, defaultColor, defaultNote]);

  const familyOpenings = openings.filter((o) => o.familyId === familyId);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (movesSan.length === 0) {
      setError("Play or select at least 1 move on the board before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const useCustom = openingId === "__custom__";
      const chosenOp = openings.find((o) => o.id === openingId);
      const finalName = useCustom
        ? customOpeningName.trim() || "Custom Prep Line"
        : chosenOp?.name || "Custom Prep Line";
      const finalId = useCustom
        ? finalName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : chosenOp?.id || "custom-line";

      const res = await saveQuickPrepLine({
        movesSan,
        color,
        familyId,
        openingId: finalId,
        openingName: finalName,
        note: note.trim(),
        tags: selectedTags,
        arrows,
        circles,
      });

      const msg = `Saved ${movesSan.length} plies to "${finalName}" (+${res.drillCardsAdded} FSRS drill cards${
        res.transpositionDetected ? " · Transposition linked!" : ""
      }).`;
      onSaved?.(msg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save line.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title="Quick-Save Line to Opening Prep">
      <form onSubmit={handleSave} className="space-y-4">
        <div
          className="rounded-lg p-3 border text-xs font-mono leading-relaxed"
          style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          {movesSan.length > 0 ? movesSan.join(" ") : "(Starting position — play moves first)"}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Repertoire Color
            </label>
            <select
              value={color}
              onChange={(e) => {
                const c = e.target.value as PlayerColor;
                setColor(c);
                const fam = families.find((f) => f.color === c);
                if (fam) {
                  setFamilyId(fam.id);
                  const op = openings.find((o) => o.familyId === fam.id);
                  setOpeningId(op ? op.id : "__custom__");
                }
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <option value="white">White Repertoire</option>
              <option value="black">Black Repertoire</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Pattern Family Club
            </label>
            <select
              value={familyId}
              onChange={(e) => {
                setFamilyId(e.target.value);
                const op = openings.find((o) => o.familyId === e.target.value);
                setOpeningId(op ? op.id : "__custom__");
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
            Opening Branch
          </label>
          <select
            value={openingId}
            onChange={(e) => setOpeningId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            {familyOpenings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            <option value="__custom__">+ Create New Opening Branch in Family...</option>
          </select>
        </div>

        {openingId === "__custom__" && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              New Opening Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Sicilian Grand Prix 4.Bb5 Sideline"
              value={customOpeningName}
              onChange={(e) => setCustomOpeningName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {["#plan", "#trap", "#must-know", "#sideline", "#transposition"].map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${
                    active ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : ""
                  }`}
                  style={!active ? { borderColor: "var(--border)" } : undefined}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
            Coach Plan / Trap Note (shown during FSRS drills)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this move works, key targets, or opponent traps..."
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Queue FSRS"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
