import type { NotebookEntry } from "@/types/chess";

const NOW = 1730000000000;

export const SEED_NOTEBOOK_ENTRIES: NotebookEntry[] = [
  {
    id: "note-roadmap",
    path: "00-dashboard/improvement-roadmap.md",
    folder: "00-dashboard",
    title: "Improvement Roadmap (ssaabbbbii)",
    tags: ["dashboard", "roadmap", "priorities"],
    pinnedFens: [],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Chess Improvement Roadmap — \`ssaabbbbii\`

Welcome to your living **ChessVault OS** notebook. Every game synced from Chess.com, every opening pattern family, every tactical blunder, and every endgame concept links back here.

## Core Priorities
1. **Unify White \`1.e4\` under the \`Nc3 + f4\` Battering Ram:**
   Club your Vienna Game/Gambit and Sicilian Grand Prix Attack together so you spend zero mental energy switching plans between \`1...e5\` and \`1...c5\`.
2. **Master Your \`...f5\` Counter-Gambit Web as Black:**
   Bridge the **Latvian Gambit** (\`2...f5\`) directly into the **Rousseau Gambit** (\`3...f5\`) via the shared transposition node, alongside the **Jaenisch/Schliemann** (\`3.Bb5 f5\`).
3. **Neutralize \`1.d4\` & Flanks with the King's Indian Shell:**
   Play \`...Nf6, ...g6, ...Bg7, ...d6, ...O-O\` uniformly against \`1.d4\`, London \`2.Bf4\`, \`1.c4\`, and \`1.b4\`.
4. **Convert Games Using Your Personal Blunder Bank + Rook Endgames:**
   Every Stockfish-reviewed mistake from your Chess.com games becomes a drill card in \`/tactics\`.

[[family:white-nc3-f4-attack]]
`,
  },
  {
    id: "note-white-family",
    path: "01-openings/white/family-nc3-f4-kingside-attack/_family-overview.md",
    folder: "01-openings/white/family-nc3-f4-kingside-attack",
    title: "White Nc3 + f4 Battering Ram (Family Overview)",
    tags: ["white", "family", "vienna", "grand-prix", "plan"],
    pinnedFens: ["rnbqkbnr/pppp1ppp/8/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3"],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# White \`1.e4\` — \`Nc3 + f4\` Battering Ram System

Instead of memorizing unrelated lines against \`1...e5\` and \`1...c5\`, club **Vienna** + **Grand Prix Attack** together around the exact same piece placement:
- \`Nc3\` controls \`d5\` and \`e4\` without blocking the \`f\`-pawn.
- \`f4\` opens the f-file (after \`fxe5\`) or launches an \`f5\` kingside pawn storm (against Sicilian).
- Your King castles short so the rook lands immediately on the half-open \`f\`-file!

[[family:white-nc3-f4-attack]]

## Key Reference Position (Vienna Gambit \`3.f4\`)
[[fen:rnbqkbnr/pppp1ppp/8/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3]]

## Grand Prix Twin Position (\`1.e4 c5 2.Nc3 Nc6 3.f4\`)
[[fen:r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3]]
`,
  },
  {
    id: "note-vienna",
    path: "01-openings/white/family-nc3-f4-kingside-attack/vienna-game-gambit.md",
    folder: "01-openings/white/family-nc3-f4-kingside-attack",
    title: "Vienna Game & Gambit (vs 1...e5)",
    tags: ["white", "vienna", "traps", "openings"],
    pinnedFens: ["rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 2 3"],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Vienna Game & Gambit

## Golden Rule of Move Orders
- After **1.e4 e5 2.Nc3 Nf6**: play **3.f4!** immediately (Vienna Gambit).
  - If **3...exf4?**: **4.e5!** chases the knight back to \`g8\`.
  - If **3...d5**: **4.fxe5 Nxe4 5.Nf3** opens the f-file with a lead in development.
- After **1.e4 e5 2.Nc3 Nc6**: play **3.Bc4!** first (prevents \`...g5\` tricks) and crush copycats **3...Bc5?** with **4.Qg4!!**.

[[line:vienna-gambit]]

[[fen:rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 2 3]]
`,
  },
  {
    id: "note-grand-prix",
    path: "01-openings/white/family-nc3-f4-kingside-attack/grand-prix-attack.md",
    folder: "01-openings/white/family-nc3-f4-kingside-attack",
    title: "Grand Prix Attack (vs Sicilian 1...c5)",
    tags: ["white", "sicilian", "grand-prix", "openings"],
    pinnedFens: ["r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3"],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Grand Prix Attack (\`1.e4 c5 2.Nc3 Nc6 3.f4\`)

Why it fits your Vienna repertoire like a glove:
1. You completely avoid 20-move theoretical Najdorf & Sveshnikov traps.
2. You develop the same **Nc3 + f4 + Nf3 + Bb5/Bc4 + O-O** setup.
3. The attacking blueprint is crystal clear: **Qe1 -> Qh4**, push **f5**, trade dark-squared bishops with **Bh6**, and crash through on \`f7\`/\`h7\`.

[[line:grand-prix-attack]]

[[fen:r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3]]
`,
  },
  {
    id: "note-black-f5-family",
    path: "01-openings/black/family-f5-counter-gambits/_family-overview.md",
    folder: "01-openings/black/family-f5-counter-gambits",
    title: "Black ...f5 Counter-Gambits (Latvian ↔ Rousseau ↔ Jaenisch)",
    tags: ["black", "family", "latvian", "rousseau", "transposition"],
    pinnedFens: ["r1bqkbnr/pppp2pp/2n5/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4"],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Black \`...f5\` Counter-Gambit & Transposition Complex

All three openings share one fearless idea: strike White's \`e4\` pawn early with **...f5**!

## Live Transposition Bridge
- **Latvian Declined (Mayet Attack):** \`1.e4 e5 2.Nf3 f5 3.Bc4 Nc6\`
- **Rousseau Gambit:** \`1.e4 e5 2.Nf3 Nc6 3.Bc4 f5\`

Both reach the **exact same board position**:
[[fen:r1bqkbnr/pppp2pp/2n5/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4]]

[[family:black-f5-counter-gambits]]

## Why Play Both Together?
- If White plays \`3.exf5\` (against Latvian) or \`4.exf5?\` (against Rousseau), **...e4!** unleashes immediate counterplay.
- Against \`3.Bb5\` (Ruy Lopez), **3...f5** (Jaenisch/Schliemann) keeps the exact same tactical rhythm!
`,
  },
  {
    id: "note-black-kid-family",
    path: "01-openings/black/family-kings-indian-complex/_family-overview.md",
    folder: "01-openings/black/family-kings-indian-complex",
    title: "King's Indian Universal Setup (vs 1.d4, London, 1.c4, 1.b4)",
    tags: ["black", "family", "kings-indian", "structure"],
    pinnedFens: ["rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6"],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# King's Indian Universal Setup

One dark-square shell (**...Nf6, ...g6, ...Bg7, ...d6, ...O-O**) covers:
- Mainline **1.d4 2.c4**
- **London System** (\`2.Bf4\`)
- **English** (\`1.c4\`) & **Reti** (\`1.Nf3\`)
- **Orangutan** (\`1.b4\`) — your \`Bg7\` directly opposes White's \`b2\` bishop!

[[family:black-kings-indian-complex]]

[[fen:rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6]]
`,
  },
  {
    id: "note-pawn-structures",
    path: "02-middlegame-structures/f4-f5-attacking-blueprint.md",
    folder: "02-middlegame-structures",
    title: "The f4–f5 Kingside Pawn Storm Blueprint",
    tags: ["middlegame", "pawn-structure", "attack"],
    pinnedFens: [],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# The \`f4–f5\` Kingside Pawn Storm Blueprint

Notice the unifying thread across your **entire repertoire**:
- **White:** Vienna + Grand Prix Attack push \`f4–f5\` toward \`g6/e6\`.
- **Black:** King's Indian pushes \`...f5–f4\` toward \`g3/e3\`.

## 4 Rules Before Pushing f5 (or ...f4)
1. **Lock or stabilize the center first** so the opponent cannot blow open the d-file while you flank-attack.
2. **Castle first** so your rook immediately stands behind the f-pawn!
3. **Bring the Queen across** (\`Qe1-h4\` as White, \`...Qe8-h5\` as Black) before sacrificing on \`h6\` or \`g5\`.
4. **Watch the weak e6 / e3 square** — keep a knight or bishop ready to recapture cleanly.
`,
  },
  {
    id: "note-tactics-checklist",
    path: "03-tactics/personal-tactics-checklist.md",
    folder: "03-tactics",
    title: "Checks, Captures, Threats — Blunder Prevention",
    tags: ["tactics", "checklist", "habits"],
    pinnedFens: [],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Before Every Move — 5-Second Blunder Filter

Before releasing a piece (especially under 1:00 on the clock):
1. **Opponent's Checks:** Does my move allow a check or discovered check?
2. **Loose Pieces:** What pieces on my side have zero defenders? ("Loose pieces drop off.")
3. **Backward Moves:** Did I remember knights and queens can retreat or fork from behind?
4. **My Checks & Captures:** Never settle for a quiet move before calculating forcing checks and captures first.
`,
  },
  {
    id: "note-endgame-guide",
    path: "06-notebooks/endgame-survival-guide.md",
    folder: "06-notebooks",
    title: "Endgame Survival Cheat Sheet",
    tags: ["endgame", "rook-endings", "king-and-pawn"],
    pinnedFens: [
      "4k3/8/8/4P3/4K3/8/6R1/2r5 b - - 0 1",
      "3K4/3P1k2/8/8/8/8/4R3/3r4 w - - 0 1",
    ],
    createdAt: NOW,
    updatedAt: NOW,
    content: `# Endgame Survival Cheat Sheet

## 1. Philidor Defense (Down a Pawn in Rook Endgame)
Keep your rook on the **3rd/6th rank** until the pawn advances to the 6th, then drop to the back rank and give infinite checks from behind!
[[fen:4k3/8/8/4P3/4K3/8/6R1/2r5 b - - 0 1]]

## 2. Lucena Bridge (Up a Pawn in Rook Endgame)
Push the defending king one file away with a check, lift your rook to the **4th rank**, walk your king out, and shield checks with the rook!
[[fen:3K4/3P1k2/8/8/8/8/4R3/3r4 w - - 0 1]]
`,
  },
];
