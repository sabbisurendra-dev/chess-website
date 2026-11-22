"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileArchive,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { NotebookEntry, PatternFamily } from "@/types/chess";
import { db, ensureSeeded } from "@/lib/storage/db";
import { exportRepertoireToPgn } from "@/lib/chess/openingGraph";
import {
  downloadTextFile,
  exportFullBackupJson,
  exportKnowledgeVaultZip,
} from "@/lib/export/exporters";
import { MarkdownChessRenderer } from "@/components/notebook/MarkdownChessRenderer";
import { ModalDialog } from "@/components/layout/ModalDialog";

const TREE_FOLDERS = [
  "00-dashboard",
  "01-openings",
  "01-openings/white/family-nc3-f4-kingside-attack",
  "01-openings/black/family-f5-counter-gambits",
  "01-openings/black/family-kings-indian-complex",
  "02-middlegame-structures",
  "03-tactics",
  "04-endgame-structures",
  "05-my-games-review/annotated-key-games",
  "06-notebooks",
] as const;

export default function NotebookPage() {
  const [notes, setNotes] = useState<NotebookEntry[]>([]);
  const [families, setFamilies] = useState<PatternFamily[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split");
  const [titleDraft, setTitleDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // New note modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFolder, setNewFolder] = useState<string>("06-notebooks");
  const [newTags, setNewTags] = useState("study, repertoire");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadNotebook = useCallback(async () => {
    await ensureSeeded();
    const [allNotes, fams] = await Promise.all([
      db.notes.orderBy("path").toArray(),
      db.families.toArray(),
    ]);
    setNotes(allNotes);
    setFamilies(fams);
    setSelectedNoteId((prev) => {
      if (prev && allNotes.some((n) => n.id === prev)) return prev;
      return allNotes[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    loadNotebook();
  }, [loadNotebook]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || notes[0],
    [notes, selectedNoteId]
  );

  useEffect(() => {
    if (!activeNote) return;
    setTitleDraft(activeNote.title);
    setTagsDraft(activeNote.tags.join(", "));
    setContentDraft(activeNote.content);
    setDirty(false);
  }, [activeNote]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.path.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, search]);

  const groupedByFolder = useMemo(() => {
    const map = new Map<string, NotebookEntry[]>();
    for (const f of TREE_FOLDERS) map.set(f, []);
    for (const n of filteredNotes) {
      const bucket = map.get(n.folder) || [];
      bucket.push(n);
      map.set(n.folder, bucket);
    }
    return map;
  }, [filteredNotes]);

  const handleSaveNote = async () => {
    if (!activeNote) return;
    const pinnedFens = [...contentDraft.matchAll(/\[\[fen:([^\]]+)\]\]/g)].map((m) => m[1].trim());
    const tags = tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updated: NotebookEntry = {
      ...activeNote,
      title: titleDraft.trim() || activeNote.title,
      tags,
      content: contentDraft,
      pinnedFens,
      updatedAt: Date.now(),
    };
    await db.notes.put(updated);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setDirty(false);
    setToast(`Saved "${updated.title}".`);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const slug = newTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = `note-${slug}-${Date.now().toString().slice(-4)}`;
    const entry: NotebookEntry = {
      id,
      path: `${newFolder}/${slug}.md`,
      folder: newFolder,
      title: newTitle.trim(),
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      content: `# ${newTitle.trim()}\n\nWrite your chess plan, pawn structure notes, or traps below.\n\n[[fen:rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1]]\n`,
      pinnedFens: ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.notes.put(entry);
    setNotes((prev) => [...prev, entry]);
    setSelectedNoteId(entry.id);
    setCreateOpen(false);
    setNewTitle("");
    setToast(`Created note at ${entry.path}`);
  };

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    await db.notes.delete(activeNote.id);
    const remaining = notes.filter((n) => n.id !== activeNote.id);
    setNotes(remaining);
    setSelectedNoteId(remaining[0]?.id || "");
    setToast(`Deleted "${activeNote.title}".`);
  };

  const insertSnippet = (snippet: string) => {
    setContentDraft((prev) => `${prev}\n${snippet}\n`);
    setDirty(true);
  };

  const handleExportVaultZip = async () => {
    const s = await db.settings.get("singleton");
    const nodes = await db.nodes.toArray();
    await exportKnowledgeVaultZip({
      notes,
      families,
      nodes,
      username: s?.chessComUsername || "ssaabbbbii",
    });
    setToast("Downloaded Obsidian-ready Markdown Vault (.zip)!");
  };

  const handleExportFullJson = async () => {
    const [settings, fams, nodes, drillCards, personalBlunders, games] = await Promise.all([
      db.settings.get("singleton"),
      db.families.toArray(),
      db.nodes.toArray(),
      db.drillCards.toArray(),
      db.personalBlunders.toArray(),
      db.games.toArray(),
    ]);
    if (!settings) return;
    exportFullBackupJson({
      settings,
      families: fams,
      nodes,
      drillCards,
      notes,
      personalBlunders,
      games,
    });
    setToast("Exported complete ChessVault OS JSON backup!");
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.settings) await db.settings.put(parsed.settings);
      if (Array.isArray(parsed.families)) await db.families.bulkPut(parsed.families);
      if (Array.isArray(parsed.nodes)) await db.nodes.bulkPut(parsed.nodes);
      if (Array.isArray(parsed.drillCards)) await db.drillCards.bulkPut(parsed.drillCards);
      if (Array.isArray(parsed.notes)) await db.notes.bulkPut(parsed.notes);
      if (Array.isArray(parsed.personalBlunders)) await db.personalBlunders.bulkPut(parsed.personalBlunders);
      if (Array.isArray(parsed.games)) await db.games.bulkPut(parsed.games);
      await loadNotebook();
      setToast("Backup restored cleanly!");
    } catch {
      setToast("Invalid JSON backup file.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Living Chess Notebook &amp; Knowledge Tree</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Tree-structured Markdown vault with live chess board embeds — exportable to Obsidian ZIP, Printable Study PDF, PGN, or JSON backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Note
          </button>
          <button
            type="button"
            onClick={handleExportVaultZip}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <FileArchive className="w-3.5 h-3.5 text-emerald-400" /> Export ZIP Vault
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" /> Print / PDF
          </button>
          <button
            type="button"
            onClick={async () => {
              const nodes = await db.nodes.toArray();
              downloadTextFile(exportRepertoireToPgn(nodes), "chessvault-repertoire.pgn");
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Download className="w-3.5 h-3.5" /> Export PGN
          </button>
          <button
            type="button"
            onClick={handleExportFullJson}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Save className="w-3.5 h-3.5" /> JSON Backup
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload className="w-3.5 h-3.5" /> Restore
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreBackup}
            className="hidden"
          />
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between no-print">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tree + Editor/Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Tree Explorer Sidebar */}
        <aside
          className="lg:col-span-4 xl:col-span-3 rounded-2xl border p-3 space-y-3 h-fit lg:max-h-[78dvh] overflow-y-auto scroller no-print"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 opacity-60" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes & tags..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>

          <div className="space-y-1.5">
            {[...groupedByFolder.entries()].map(([folder, folderNotes]) => {
              const isCollapsed = collapsedFolders.has(folder);
              return (
                <div key={folder} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedFolders((prev) => {
                        const next = new Set(prev);
                        if (next.has(folder)) next.delete(folder);
                        else next.add(folder);
                        return next;
                      })
                    }
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-semibold hover:bg-white/5 cursor-pointer text-left"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {isCollapsed ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-mono">{folder}</span>
                    </span>
                    <span className="font-mono text-[10px]">{folderNotes.length}</span>
                  </button>

                  {!isCollapsed && folderNotes.length > 0 && (
                    <div className="pl-3 space-y-0.5">
                      {folderNotes.map((n) => {
                        const active = n.id === activeNote?.id;
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => setSelectedNoteId(n.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer ${
                              active
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0 opacity-75" />
                            <span className="truncate">{n.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Note Editor + Live Chess Embed Preview */}
        <div
          className="lg:col-span-8 xl:col-span-9 rounded-2xl border p-4 sm:p-5 space-y-4 print-only-clean"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {!activeNote ? (
            <div className="text-sm text-center py-12" style={{ color: "var(--muted)" }}>
              Select or create a note from the Knowledge Tree.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b no-print" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                    {activeNote.path}
                  </div>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => {
                      setTitleDraft(e.target.value);
                      setDirty(true);
                    }}
                    className="w-full text-lg font-bold bg-transparent border-b border-transparent focus:border-emerald-500 outline-none"
                  />
                  <input
                    type="text"
                    value={tagsDraft}
                    onChange={(e) => {
                      setTagsDraft(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Comma-separated tags..."
                    className="w-full text-xs font-mono bg-transparent outline-none"
                    style={{ color: "var(--muted)" }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                    {(
                      [
                        { id: "split", label: "Split" },
                        { id: "edit", label: "Markdown", icon: FileCode2 },
                        { id: "preview", label: "Preview", icon: Eye },
                      ] as const
                    ).map((vm) => (
                      <button
                        key={vm.id}
                        type="button"
                        onClick={() => setViewMode(vm.id)}
                        className={`px-2.5 py-1 text-xs cursor-pointer ${
                          viewMode === vm.id ? "bg-emerald-500/20 text-emerald-300 font-semibold" : ""
                        }`}
                      >
                        {vm.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      dirty
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "border hover:bg-white/5"
                    }`}
                    style={!dirty ? { borderColor: "var(--border)" } : undefined}
                  >
                    <Save className="w-3.5 h-3.5" /> {dirty ? "Save*" : "Saved"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteNote}
                    aria-label="Delete note"
                    className="p-1.5 rounded-lg border hover:bg-rose-500/15 text-rose-400 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick-Insert Embed Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] no-print">
                <span style={{ color: "var(--muted)" }}>Insert Chess Widget:</span>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet("[[fen:rnbqkbnr/pppp1ppp/8/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3]]")
                  }
                  className="px-2 py-1 rounded border hover:bg-white/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  + FEN Board
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("[[family:white-nc3-f4-attack]]")}
                  className="px-2 py-1 rounded border hover:bg-white/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  + Pattern Family Card
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("[[line:vienna-gambit]]")}
                  className="px-2 py-1 rounded border hover:bg-white/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  + Opening Drill Link
                </button>
              </div>

              {/* Split Editor & Live Preview */}
              <div
                className={`grid gap-4 ${
                  viewMode === "split" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                }`}
              >
                {viewMode !== "preview" && (
                  <textarea
                    rows={22}
                    value={contentDraft}
                    onChange={(e) => {
                      setContentDraft(e.target.value);
                      setDirty(true);
                    }}
                    className="w-full rounded-xl border p-3.5 text-xs font-mono leading-relaxed scroller no-print"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  />
                )}

                {viewMode !== "edit" && (
                  <div
                    className="rounded-xl border p-4 max-h-[65dvh] overflow-y-auto scroller print-only-clean"
                    style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
                  >
                    <MarkdownChessRenderer markdown={contentDraft} families={families} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Knowledge Note">
        <form onSubmit={handleCreateNote} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Knowledge Tree Folder
            </label>
            <select
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs font-mono"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              {TREE_FOLDERS.map((f) => (
                <option key={f} value={f}>
                  {f}/
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Note Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Pre-Tournament 1.e4 Checklist"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs font-mono"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
            >
              Create Note
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
