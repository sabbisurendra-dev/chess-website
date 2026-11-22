# ChessVault OS — Personal Chess Knowledge, Review & Practice Hub

Built for Chess.com player **`ssaabbbbii`** (switchable to any public Chess.com account). Inspired by **Chessiro**'s unlimited Stockfish game review and plain-English coaching, combined with **pattern-clubbed, transposition-aware opening prep**, **FSRS spaced repetition**, **opening-matched tactics**, **Syzygy endgame play-outs**, and an exportable **Living Markdown Knowledge Tree**.

## Core Modules

1. **Dashboard (`/`)** — Live Chess.com profile & stats sync, incremental monthly archive caching, Due FSRS reviews, Top Opening Leaks ranking, and habit/time-trouble diagnostics.
2. **Games & Review Studio (`/games`)** — Unlimited client-side **Stockfish 19 WASM** analysis, evaluation bar + clickable eval graph, plain-English coach commentary, repertoire deviation diffing, OpeningTree-style personal position stats, batch game scanning, and PGN paste import.
3. **Pattern-Clubbed Opening Prep (`/openings`)** — Groups related openings by shared tactical/structural DNA:
   - **White `1.e4` (`Nc3 + f4` Battering Ram):** Vienna Game/Gambit + Sicilian Grand Prix Attack + Caro-Kann Two Knights
   - **Black vs `1.e4` (`...f5` Counter-Gambit Web):** Latvian Gambit (`2...f5`) ↔ Rousseau Gambit (`3...f5`) linked automatically at their exact shared normalized FEN transposition hub + Jaenisch/Schliemann
   - **Black vs `1.d4` & Flanks:** King's Indian Universal Setup vs `1.d4`, London `2.Bf4`, `1.c4`, `1.b4`
4. **Opening Practice & Sparring (`/practice`)** — `ts-fsrs` spaced-repetition drills (Due Queue, Pattern Family Mix, All Lines) + Play-Out Sparring against your repertoire handing off to Stockfish 19 at configurable ELO.
5. **Knowledge Center (`/knowledge`)** — Interactive courses covering Opening Systems, Middlegame Structures, Tactical Motifs, and Classic Model Games with playable board checkpoints and linked real games.
6. **Tactics Practice (`/tactics`)** — Dual-source trainer featuring Personal Blunder Puzzles auto-extracted from your Chess.com games alongside 36 curated opening-matched puzzles + Motif Accuracy Radar.
7. **Endgame Structures Lab (`/endgames`)** — Guided principles & live play-out drills across King & Pawn, Rook (Philidor, Lucena, Vancura), Minor Piece, and Queen structures powered by **Lichess 7-piece Syzygy Tablebases** with automatic Stockfish 19 fallback.
8. **Living Chess Notebook (`/notebook`)** — Tree-structured Markdown vault (`00-dashboard/` through `06-notebooks/`) supporting live `[[fen:...]]`, `[[family:...]]`, `[[line:...]]`, and `[[game:...]]` widgets, with 1-click export to **Obsidian-ready Markdown `.zip`**, **Printable PDF**, **Annotated PGN**, and **JSON Backup/Restore**.

## Local Development

```bash
npm install
npm run validate   # Verifies all opening transpositions, courses, endgames, tactics & FEN embeds
npm run typecheck
npm run dev
```
