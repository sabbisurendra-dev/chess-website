import JSZip from "jszip";
import type {
  DrillCard,
  NotebookEntry,
  PatternFamily,
  PersonalBlunderPuzzle,
  RepertoireNode,
  StoredGame,
  UserSettings,
} from "@/types/chess";
import { exportRepertoireToPgn } from "@/lib/chess/openingGraph";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadTextFile(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

export async function exportKnowledgeVaultZip(params: {
  notes: NotebookEntry[];
  families: PatternFamily[];
  nodes: RepertoireNode[];
  username: string;
}) {
  const { notes, families, nodes, username } = params;
  const zip = new JSZip();
  const root = zip.folder("chess-vault")!;

  // Write every notebook entry to its canonical path with YAML frontmatter
  for (const note of notes) {
    const safePath = note.path.replace(/^\/+/, "");
    const frontmatter = [
      "---",
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      `tags: [${note.tags.map((t) => `"${t}"`).join(", ")}]`,
      `updatedAt: "${new Date(note.updatedAt).toISOString()}"`,
      "---",
      "",
    ].join("\n");
    root.file(safePath, `${frontmatter}${note.content}`);
  }

  // Also include transposition index & full PGN repertoire inside 01-openings/
  const transpositionNodes = nodes
    .filter((n) => n.transpositionNames.length > 1)
    .map((n) => ({
      normFen: n.normFen,
      openings: n.transpositionNames,
      notes: n.notes,
    }));

  root.file(
    "01-openings/_transposition-index.json",
    JSON.stringify(
      {
        username,
        exportedAt: new Date().toISOString(),
        families: families.map((f) => ({ id: f.id, name: f.name, color: f.color })),
        transpositions: transpositionNodes,
      },
      null,
      2
    )
  );

  root.file("01-openings/_repertoire-full.pgn", exportRepertoireToPgn(nodes));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `chess-vault-${username}-${new Date().toISOString().slice(0, 10)}.zip`);
}

export function exportFullBackupJson(payload: {
  settings: UserSettings;
  families: PatternFamily[];
  nodes: RepertoireNode[];
  drillCards: DrillCard[];
  notes: NotebookEntry[];
  personalBlunders: PersonalBlunderPuzzle[];
  games: StoredGame[];
}) {
  const json = JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...payload,
    },
    null,
    2
  );
  downloadTextFile(
    json,
    `chessvault-backup-${payload.settings.chessComUsername}-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json;charset=utf-8"
  );
}
