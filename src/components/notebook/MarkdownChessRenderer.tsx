"use client";

import React from "react";
import Link from "next/link";
import type { PatternFamily } from "@/types/chess";
import { StaticBoardSvg } from "@/components/chess/StaticBoardSvg";

interface MarkdownChessRendererProps {
  markdown: string;
  families?: PatternFamily[];
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Handle **bold**, `code`, and plain text cleanly without dangerouslySetInnerHTML
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i}>{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

export function MarkdownChessRenderer({ markdown, families = [] }: MarkdownChessRendererProps) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push(<div key={i} className="h-2" />);
      continue;
    }

    // Live FEN embed: [[fen:...]]
    const fenMatch = /^\[\[fen:([^\]]+)\]\]$/.exec(trimmed);
    if (fenMatch) {
      const fen = fenMatch[1].trim();
      blocks.push(
        <div
          key={i}
          className="my-3 p-3 rounded-xl border inline-flex flex-col sm:flex-row items-center gap-4 print-only-clean"
          style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <StaticBoardSvg fen={fen} size={184} />
          <div className="space-y-2 text-xs max-w-xs">
            <div className="font-semibold uppercase tracking-wide text-emerald-400">
              Embedded Board Snapshot
            </div>
            <div className="font-mono break-all text-[11px]" style={{ color: "var(--muted)" }}>
              {fen}
            </div>
            <Link
              href={`/openings?fen=${encodeURIComponent(fen)}`}
              className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 no-print"
            >
              Open in Opening Explorer →
            </Link>
          </div>
        </div>
      );
      continue;
    }

    // Family Comparison Embed: [[family:...]]
    const famMatch = /^\[\[family:([^\]]+)\]\]$/.exec(trimmed);
    if (famMatch) {
      const famId = famMatch[1].trim();
      const fam = families.find((f) => f.id === famId);
      blocks.push(
        <div
          key={i}
          className="my-3 p-4 rounded-xl border print-only-clean"
          style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                Pattern Family Blueprint
              </div>
              <div className="text-sm font-bold mt-0.5">{fam?.name || famId}</div>
            </div>
            <Link
              href={`/openings?family=${encodeURIComponent(famId)}`}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 no-print"
            >
              Explore & Drill Family →
            </Link>
          </div>
          {fam && (
            <ul className="mt-2 space-y-1 text-xs list-disc pl-4" style={{ color: "var(--muted)" }}>
              {fam.sharedBlueprint.map((bp, idx) => (
                <li key={idx}>{bp}</li>
              ))}
            </ul>
          )}
        </div>
      );
      continue;
    }

    // Line link embed: [[line:...]]
    const lineMatch = /^\[\[line:([^\]]+)\]\]$/.exec(trimmed);
    if (lineMatch) {
      const openingId = lineMatch[1].trim();
      blocks.push(
        <div
          key={i}
          className="my-2 px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs"
          style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <span>
            Linked Opening Branch: <strong className="font-mono">{openingId}</strong>
          </span>
          <Link
            href={`/practice?opening=${encodeURIComponent(openingId)}`}
            className="text-emerald-400 hover:underline no-print"
          >
            Drill This Line →
          </Link>
        </div>
      );
      continue;
    }

    // Game link embed: [[game:...]]
    const gameMatch = /^\[\[game:([^\]]+)\]\]$/.exec(trimmed);
    if (gameMatch) {
      const gameRef = gameMatch[1].trim();
      const [gameId, ply] = gameRef.split("#");
      blocks.push(
        <div
          key={i}
          className="my-2 px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs"
          style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          <span>
            Linked Game Review: <strong className="font-mono">{gameId}</strong>
            {ply ? ` (Move ${ply})` : ""}
          </span>
          <Link
            href={`/games?game=${encodeURIComponent(gameId)}${ply ? `&ply=${ply}` : ""}`}
            className="text-emerald-400 hover:underline no-print"
          >
            Inspect Game →
          </Link>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={i} className="text-xl font-bold tracking-tight mt-2 mb-2">
          {renderInlineFormatting(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={i} className="text-base font-bold tracking-tight mt-4 mb-1.5 text-emerald-400">
          {renderInlineFormatting(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
          {renderInlineFormatting(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed pl-2">
          <span className="text-emerald-400">•</span>
          <span>{renderInlineFormatting(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const idx = trimmed.indexOf(". ");
      blocks.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed pl-2">
          <span className="font-semibold text-emerald-400">{trimmed.slice(0, idx + 1)}</span>
          <span>{renderInlineFormatting(trimmed.slice(idx + 2))}</span>
        </div>
      );
    } else {
      blocks.push(
        <p key={i} className="text-sm leading-relaxed">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    }
  }

  return <div className="space-y-1">{blocks}</div>;
}
