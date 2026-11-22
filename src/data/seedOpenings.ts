import type { OpeningSummary, PatternFamily } from "@/types/chess";
import type { SeedLineInput } from "@/lib/chess/openingGraph";

export const SEED_FAMILIES: PatternFamily[] = [
  {
    id: "white-nc3-f4-attack",
    name: "White 1.e4 — Nc3 + f4 Battering Ram",
    color: "white",
    subtitle: "Vienna Game/Gambit + Grand Prix Attack + Two Knights Caro-Kann + French Nc3",
    dnaSummary:
      "One attacking philosophy against every Black reply to 1.e4: withhold Nf3 early so you can launch f2-f4 behind Nc3, clamp down on e4/d5, and unleash a kingside attack via Bc4/Bb5, Nf3, O-O, and Qe1-h4.",
    sharedBlueprint: [
      "Delay Nf3 on move 2 and develop Nc3 first so the f-pawn isn't blocked.",
      "Push f4 early to challenge e5 or gain kingside space and open the f-file after castling.",
      "Target f7/h7 with Bc4 (or pin c6 with Bb5 in Grand Prix) and swing Qe1-h4.",
      "If Black strikes the center with ...d5, respond cleanly with fxe5 or exd5 followed by d4/Bb5.",
    ],
    keyBenefits: [
      "Drastically cuts study load: one middlegame attacking plan works vs 1...e5 AND 1...c5.",
      "Pulls Sicilian and 1...e5 opponents out of dry main-line Ruy Lopez / Najdorf theory by move 2–3.",
      "Produces consistent tactical patterns: f5 breaks, Bxh6/Bxf7+ sacrifices, and Rf3-h3 lifts.",
    ],
    comparisonRows: [
      {
        aspect: "Move Order",
        columns: {
          "Vienna (vs 1...e5)": "1.e4 e5 2.Nc3 Nf6 3.f4",
          "Grand Prix (vs 1...c5)": "1.e4 c5 2.Nc3 Nc6 3.f4",
          "Caro-Kann / French": "1.e4 c6/e6 2.Nc3 d5 3.Nf3",
        },
      },
      {
        aspect: "Key Bishop",
        columns: {
          "Vienna (vs 1...e5)": "Bc4 eyeing f7 (or Bg5)",
          "Grand Prix (vs 1...c5)": "Bb5 pinning Nc6 + doubling c-pawns",
          "Caro-Kann / French": "Be2 / Bd3 supporting e5/f4",
        },
      },
      {
        aspect: "Core Pawn Break",
        columns: {
          "Vienna (vs 1...e5)": "3.f4 (vs 2...Nc6, Bc4!) & d4",
          "Grand Prix (vs 1...c5)": "f4-f5 kingside storm after O-O",
          "Caro-Kann / French": "d3 + e5 or f4 space grab",
        },
      },
      {
        aspect: "Main Danger to Watch",
        columns: {
          "Vienna (vs 1...e5)": "Never play 3.f4 vs 2...Nc6 without checking 3...exf4 4.Nf3 g5; prefer 3.Bc4 first!",
          "Grand Prix (vs 1...c5)": "Premature f5 before Qe1/O-O lets Black counter on d4 or ...b5.",
          "Caro-Kann / French": "Don't lose the d4 square without counterplay on the kingside.",
        },
      },
    ],
    openingsIncluded: [
      "vienna-gambit",
      "vienna-bc4",
      "grand-prix-attack",
      "caro-kann-two-knights",
    ],
    createdAt: 1730000000000,
  },
  {
    id: "black-f5-counter-gambits",
    name: "Black vs 1.e4 — ...f5 Counter-Gambit & Transposition Web",
    color: "black",
    subtitle: "Latvian Gambit ↔ Rousseau Gambit ↔ Jaenisch/Schliemann Gambit",
    dnaSummary:
      "Fight fire with fire against 1.e4 e5 2.Nf3 by striking immediately with ...f5! Whether played on move 2 (Latvian), move 3 after Bc4 (Rousseau), or move 3 after Bb5 (Jaenisch/Schliemann), every branch shares reversed King's Gambit tactics, open f-file rooks, and massive trap potential.",
    sharedBlueprint: [
      "Challenge White's e4 anchor immediately with ...f5 instead of passive defense.",
      "When White declines with Bc4 (Mayet Attack vs Latvian), 3...Nc6 transposes directly into the Rousseau Gambit.",
      "After White castles short, aim for ...f4 (if White plays d3) or ...O-O + ...Rf6-h6 / ...Qe8-h5.",
      "Watch the diagonal a7-g1 and always keep ...Bc5 / ...d6 ready to neutralize Nf3-g5.",
    ],
    keyBenefits: [
      "Transposition mastery: knowing the shared position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 f5 covers BOTH Latvian Declined and Rousseau.",
      "Opponents at 700–1600 Blitz/Rapid routinely blunder into ...Qf6 or ...fxe4 forks by move 5.",
      "Mirrors the exact f-file attacking geometry you already play as White in the Vienna/Grand Prix!",
    ],
    comparisonRows: [
      {
        aspect: "Move Order",
        columns: {
          "Latvian Gambit": "1.e4 e5 2.Nf3 f5",
          "Rousseau Gambit": "1.e4 e5 2.Nf3 Nc6 3.Bc4 f5",
          "Jaenisch / Schliemann": "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5",
        },
      },
      {
        aspect: "Transposition Bridge",
        columns: {
          "Latvian Gambit": "3.Bc4 Nc6 → equals Rousseau!",
          "Rousseau Gambit": "Reached from Italian 3.Bc4 f5",
          "Jaenisch / Schliemann": "Reached vs Ruy Lopez 3.Bb5",
        },
      },
      {
        aspect: "If White Captures",
        columns: {
          "Latvian Gambit": "3.exf5 e4! / 3.Nxe5 Qf6!",
          "Rousseau Gambit": "4.exf5 e4! or 4.d3 Nf6",
          "Jaenisch / Schliemann": "4.Nc3 fxe4 5.Nxe4 d5!",
        },
      },
      {
        aspect: "Strategic Soundness",
        columns: {
          "Latvian Gambit": "Hyper-sharp gambit; massive blitz score",
          "Rousseau Gambit": "Trap-heavy; avoids 3.Nxe5 mainline",
          "Jaenisch / Schliemann": "Most reputable of the three; sound counterattack",
        },
      },
    ],
    openingsIncluded: ["latvian-gambit", "rousseau-gambit", "jaenisch-schliemann"],
    createdAt: 1730000001000,
  },
  {
    id: "black-kings-indian-complex",
    name: "Black vs 1.d4 & Flanks — King's Indian Universal Complex",
    color: "black",
    subtitle: "King's Indian Defense vs 1.d4, vs London (2.Bf4), vs 1.c4 / 1.Nf3 / 1.b4",
    dnaSummary:
      "A near-universal dark-square fianchetto shell (...Nf6, ...g6, ...Bg7, ...d6, ...O-O) that works cleanly against 1.d4, the London System, the English (1.c4), Reti (1.Nf3), and flank openings like 1.b4 without memorizing separate defenses.",
    sharedBlueprint: [
      "Build the ironclad shell first: ...Nf6, ...g6, ...Bg7, ...d6, ...O-O.",
      "Strike the center with ...e5 (classic KID) or ...c5 depending on White's setup.",
      "Once the center locks (d4-d5), launch the signature ...f5–f4–g5 kingside pawn avalanche.",
      "Against flank 1.b4 or London 2.Bf4, maintain calm development and strike early with ...c5 or ...e5.",
    ],
    keyBenefits: [
      "Zero panic against tricky 1.d4 / 1.c4 / 1.Nf3 / 1.b4 move orders — your first 5 moves stay almost identical.",
      "Creates dynamic, double-edged battles where the better tactician wins instead of symmetrical draws.",
      "Reuses the exact same f-pawn kingside storm motifs as your White repertoire.",
    ],
    comparisonRows: [
      {
        aspect: "Target Opponent",
        columns: {
          "Classic KID (vs d4+c4)": "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6",
          "vs London System (2.Bf4)": "1.d4 Nf6 2.Bf4 g6 3.e3 Bg7 4.Nf3 O-O",
          "vs Flank (1.c4 / 1.b4)": "1.b4 Nf6 2.Bb2 g6 3.e3 Bg7",
        },
      },
      {
        aspect: "Central Break",
        columns: {
          "Classic KID (vs d4+c4)": "6...e5! (or 6...c5)",
          "vs London System (2.Bf4)": "Early ...d6 + ...c5 or ...e5 after ...Nbd7",
          "vs Flank (1.c4 / 1.b4)": "Strike ...c5 / ...d5 / ...a5 to undermine b4",
        },
      },
      {
        aspect: "Middlegame Target",
        columns: {
          "Classic KID (vs d4+c4)": "White's castled king via ...f5, ...f4, ...g5",
          "vs London System (2.Bf4)": "Exchange off London bishop or claim dark squares",
          "vs Flank (1.c4 / 1.b4)": "Win overextended b4 pawn & dominate long diagonal",
        },
      },
    ],
    openingsIncluded: ["kings-indian-main", "kings-indian-vs-london", "kings-indian-vs-b4"],
    createdAt: 1730000002000,
  },
];

export const SEED_OPENING_SUMMARIES: OpeningSummary[] = [
  {
    id: "vienna-gambit",
    name: "Vienna Gambit (vs 2...Nf6)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    eco: "C29",
    tagline: "1.e4 e5 2.Nc3 Nf6 3.f4 — Immediate f4 break punishing passive replies",
    startMovesSan: ["e4", "e5", "Nc3", "Nf6", "f4"],
    benefits: ["Explosive f-file play after Nf3/O-O", "Punishes 3...exf4?! with 4.e5!"],
  },
  {
    id: "vienna-bc4",
    name: "Vienna Game — 3.Bc4 Copycat Punisher",
    familyId: "white-nc3-f4-attack",
    color: "white",
    eco: "C25",
    tagline: "1.e4 e5 2.Nc3 Nc6 3.Bc4 — Safe move order before f4",
    startMovesSan: ["e4", "e5", "Nc3", "Nc6", "Bc4"],
    benefits: ["Avoids ...g5 complications", "Crushes copycat 3...Bc5 with 4.Qg4!"],
  },
  {
    id: "grand-prix-attack",
    name: "Grand Prix Attack (vs Sicilian)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    eco: "B23",
    tagline: "1.e4 c5 2.Nc3 Nc6 3.f4 — Same Nc3+f4 DNA against the Sicilian",
    startMovesSan: ["e4", "c5", "Nc3", "Nc6", "f4"],
    benefits: ["Sidesteps all Najdorf/Sveshnikov theory", "Automatic Qe1-h4 kingside attack"],
  },
  {
    id: "caro-kann-two-knights",
    name: "Caro-Kann Two Knights (2.Nc3)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    eco: "B11",
    tagline: "1.e4 c6 2.Nc3 d5 3.Nf3 — Practical piece pressure & tactical traps",
    startMovesSan: ["e4", "c6", "Nc3", "d5", "Nf3"],
    benefits: ["Keeps tension vs Caro-Kann", "Avoids dry Exchange/Advance symmetry"],
  },
  {
    id: "latvian-gambit",
    name: "Latvian Gambit (2...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    eco: "C40",
    tagline: "1.e4 e5 2.Nf3 f5 — Immediate counter-gambit; transposes to Rousseau vs 3.Bc4",
    startMovesSan: ["e4", "e5", "Nf3", "f5"],
    benefits: ["Maximal shock value on move 2", "Transposes to Rousseau after 3.Bc4 Nc6"],
  },
  {
    id: "rousseau-gambit",
    name: "Rousseau Gambit (3...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    eco: "C50",
    tagline: "1.e4 e5 2.Nf3 Nc6 3.Bc4 f5 — Italian counter-gambit sharing Latvian DNA",
    startMovesSan: ["e4", "e5", "Nf3", "Nc6", "Bc4", "f5"],
    benefits: ["Shares exact position with Latvian 3.Bc4 Nc6", "Devastating 4.exf5? e4! counter"],
  },
  {
    id: "jaenisch-schliemann",
    name: "Jaenisch / Schliemann Gambit (vs Ruy Lopez)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    eco: "C63",
    tagline: "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5 — Soundest ...f5 strike against the Spanish",
    startMovesSan: ["e4", "e5", "Nf3", "Nc6", "Bb5", "f5"],
    benefits: ["Sound alternative to Ruy Lopez sidelines", "Strong center + open f-file"],
  },
  {
    id: "kings-indian-main",
    name: "King's Indian Defense (vs 1.d4)",
    familyId: "black-kings-indian-complex",
    color: "black",
    eco: "E60",
    tagline: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 — Classical kingside counterattack",
    startMovesSan: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
    benefits: ["Rich attacking chances with ...e5 and ...f5", "Consistent dark-square bishop power"],
  },
  {
    id: "kings-indian-vs-london",
    name: "KID Setup vs London System",
    familyId: "black-kings-indian-complex",
    color: "black",
    eco: "A48",
    tagline: "1.d4 Nf6 2.Bf4 g6 3.e3 Bg7 — Neutralize the London with ...d6 & ...c5/...e5",
    startMovesSan: ["d4", "Nf6", "Bf4", "g6", "e3", "Bg7"],
    benefits: ["Stops sleepy London plans immediately", "Easy ...e5 or ...c5 central break"],
  },
  {
    id: "kings-indian-vs-b4",
    name: "KID Setup vs 1.b4 (Orangutan)",
    familyId: "black-kings-indian-complex",
    color: "black",
    eco: "A00",
    tagline: "1.b4 Nf6 2.Bb2 g6 3.e3 Bg7 — Rock-solid fianchetto contesting the long diagonal",
    startMovesSan: ["b4", "Nf6", "Bb2", "g6", "e3", "Bg7"],
    benefits: ["Blunts White's b2 bishop immediately", "Prepares ...d6, ...O-O, ...e5 or ...a5"],
  },
];

export const SEED_OPENING_LINES: SeedLineInput[] = [
  // 1. Vienna Gambit (Main + Accepted Trap)
  {
    openingId: "vienna-gambit",
    openingName: "Vienna Gambit (vs 2...Nf6)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3", "Bc5", "d4", "Bb4", "Bd2"],
    isMainLine: true,
    tags: ["#plan", "#must-know"],
    annotationsByPly: {
      5: {
        note: "3.f4! The core Vienna Gambit strike. Because 2...Nf6 was played, 3...exf4? runs into 4.e5! chasing the knight.",
        arrows: [{ orig: "f2", dest: "f4", brush: "green" }],
        tags: ["#plan"],
      },
      7: {
        note: "4.fxe5! Always take on e5 (not exd5) so the f-file opens for your rook after O-O.",
        arrows: [{ orig: "f1", dest: "f8", brush: "blue" }],
      },
      11: {
        note: "6.d4 builds a massive center while protecting c3/e4 squares.",
        circles: [{ orig: "d4", brush: "green" }, { orig: "e5", brush: "green" }],
      },
    },
  },
  {
    openingId: "vienna-gambit",
    openingName: "Vienna Gambit (vs 2...Nf6)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4", "e5", "Ng8", "Nf3", "d6", "d4", "dxe5", "Qe2"],
    isMainLine: false,
    tags: ["#trap", "#must-know"],
    annotationsByPly: {
      7: {
        note: "TRAP: Black accepted the gambit! 4.e5! kicks the f6 knight all the way back to g8 or into awkward squares.",
        arrows: [{ orig: "e4", dest: "e5", brush: "green" }],
      },
      13: {
        note: "7.Qe2 pins the e-file and prepares Bxf4 with a huge development lead.",
        arrows: [{ orig: "e2", dest: "e8", brush: "red" }],
      },
    },
  },
  // 2. Vienna Bc4 Copycat Punisher
  {
    openingId: "vienna-bc4",
    openingName: "Vienna Game — 3.Bc4 Copycat Punisher",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "e5", "Nc3", "Nc6", "Bc4", "Bc5", "Qg4", "Qf6", "Nd5", "Qxf2+", "Kd1"],
    isMainLine: true,
    tags: ["#trap", "#must-know"],
    annotationsByPly: {
      5: {
        note: "Against 2...Nc6, play 3.Bc4 first! Now if Black copycats with 3...Bc5?, 4.Qg4! wins on the spot.",
        arrows: [{ orig: "c4", dest: "f7", brush: "green" }],
      },
      7: {
        note: "4.Qg4! Hits both g7 and sets up Nd5. Note: against 4...g6, play 5.Qf3 then f4!",
        arrows: [{ orig: "g4", dest: "g7", brush: "red" }],
      },
      9: {
        note: "5.Nd5!! Ignores f2 completely—if 5...Qxf2+, 6.Kd1 leaves White threatening Qxg7 and Nxc7+.",
        arrows: [{ orig: "c3", dest: "d5", brush: "green" }, { orig: "d5", dest: "c7", brush: "red" }],
      },
    },
  },
  {
    openingId: "vienna-bc4",
    openingName: "Vienna Game — 3.Bc4 Copycat Punisher",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "e5", "Nc3", "Nc6", "Bc4", "Nf6", "d3", "Bc5", "f4", "d6", "Nf3"],
    isMainLine: true,
    tags: ["#plan"],
    annotationsByPly: {
      9: {
        note: "With d3 protecting e4, 5.f4! transitions smoothly into our classic Vienna Attack blueprint.",
        arrows: [{ orig: "f2", dest: "f4", brush: "green" }],
      },
    },
  },
  // 3. Grand Prix Attack (Shared Nc3+f4 DNA)
  {
    openingId: "grand-prix-attack",
    openingName: "Grand Prix Attack (vs Sicilian)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "c5", "Nc3", "Nc6", "f4", "g6", "Nf3", "Bg7", "Bb5", "Nd4", "O-O", "a6", "Bc4"],
    isMainLine: true,
    tags: ["#plan", "#must-know"],
    annotationsByPly: {
      5: {
        note: "Grand Prix DNA: exact same Nc3 + f4 shell as the Vienna, now aimed at the Sicilian!",
        arrows: [{ orig: "f2", dest: "f4", brush: "green" }, { orig: "c3", dest: "d5", brush: "blue" }],
      },
      9: {
        note: "5.Bb5 pins or trades the c6 knight while prepping O-O, Qe1-h4, and f5!",
        arrows: [{ orig: "b5", dest: "c6", brush: "yellow" }],
      },
    },
  },
  {
    openingId: "grand-prix-attack",
    openingName: "Grand Prix Attack (vs Sicilian)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "c5", "Nc3", "d6", "f4", "Nc6", "Nf3", "g6", "Bc4", "Bg7", "O-O", "e6", "f5"],
    isMainLine: false,
    tags: ["#plan", "#trap"],
    annotationsByPly: {
      13: {
        note: "7.f5! Signature Grand Prix pawn sacrifice/break ripping open Black's dark squares before Black castles.",
        arrows: [{ orig: "f4", dest: "f5", brush: "red" }, { orig: "c4", dest: "f7", brush: "green" }],
      },
    },
  },
  // 4. Caro-Kann Two Knights
  {
    openingId: "caro-kann-two-knights",
    openingName: "Caro-Kann Two Knights (2.Nc3)",
    familyId: "white-nc3-f4-attack",
    color: "white",
    movesSan: ["e4", "c6", "Nc3", "d5", "Nf3", "Bg4", "h3", "Bxf3", "Qxf3", "e6", "d3"],
    isMainLine: true,
    tags: ["#plan"],
    annotationsByPly: {
      9: {
        note: "With the bishop pair and dark-square control, White aims for g3/Bg2 or Be3 + O-O-O + f4-g4 attack.",
        arrows: [{ orig: "f3", dest: "b7", brush: "blue" }],
      },
    },
  },
  // 5. Latvian Gambit -> Transposes into Rousseau Gambit!
  {
    openingId: "latvian-gambit",
    openingName: "Latvian Gambit (2...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    movesSan: ["e4", "e5", "Nf3", "f5", "Bc4", "Nc6", "d3", "Nf6", "Ng5", "d5", "exd5", "Na5"],
    isMainLine: true,
    tags: ["#transposition", "#must-know"],
    annotationsByPly: {
      4: {
        note: "2...f5! The Latvian Gambit strikes White's center immediately on move 2.",
        arrows: [{ orig: "f7", dest: "f5", brush: "green" }],
      },
      6: {
        note: "TRANSPOSITION BRIDGE: When White declines with 3.Bc4 (Mayet Attack), 3...Nc6 transposes directly into the Rousseau Gambit!",
        circles: [{ orig: "c6", brush: "blue" }, { orig: "f5", brush: "green" }],
        tags: ["#transposition"],
      },
      10: {
        note: "5...d5! Counter-strikes in the center when White jumps Ng5 toward f7.",
        arrows: [{ orig: "d7", dest: "d5", brush: "green" }],
      },
    },
  },
  {
    openingId: "latvian-gambit",
    openingName: "Latvian Gambit (2...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    movesSan: ["e4", "e5", "Nf3", "f5", "Nxe5", "Qf6", "d4", "d6", "Nc4", "fxe4", "Nc3", "Qg6"],
    isMainLine: true,
    tags: ["#plan", "#must-know"],
    annotationsByPly: {
      6: {
        note: "3...Qf6! Attacks the e5 knight while threatening ...fxe4 and central counterplay.",
        arrows: [{ orig: "f6", dest: "e5", brush: "red" }, { orig: "f5", dest: "e4", brush: "green" }],
      },
      12: {
        note: "6...Qg6 targets g2 and prepares ...Nf6, ...c6, ...d5 for a healthy central pawn chain.",
        arrows: [{ orig: "g6", dest: "g2", brush: "blue" }],
      },
    },
  },
  // 6. Rousseau Gambit (Exact shared position with Latvian 3.Bc4 Nc6!)
  {
    openingId: "rousseau-gambit",
    openingName: "Rousseau Gambit (3...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    movesSan: ["e4", "e5", "Nf3", "Nc6", "Bc4", "f5", "d3", "Nf6", "Ng5", "d5", "exd5", "Na5"],
    isMainLine: true,
    tags: ["#transposition", "#plan"],
    annotationsByPly: {
      6: {
        note: "3...f5! Rousseau Gambit — IDENTICAL board position to the Latvian Gambit Declined (1.e4 e5 2.Nf3 f5 3.Bc4 Nc6)!",
        circles: [{ orig: "f5", brush: "green" }, { orig: "c6", brush: "blue" }],
        tags: ["#transposition"],
      },
    },
  },
  {
    openingId: "rousseau-gambit",
    openingName: "Rousseau Gambit (3...f5)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    movesSan: ["e4", "e5", "Nf3", "Nc6", "Bc4", "f5", "exf5", "e4", "Qe2", "Qe7", "Ng1", "Nf6"],
    isMainLine: false,
    tags: ["#trap"],
    annotationsByPly: {
      8: {
        note: "TRAP: If White accepts with 4.exf5?, push 4...e4! White's knight is completely short of safe squares!",
        arrows: [{ orig: "e5", dest: "e4", brush: "green" }, { orig: "e4", dest: "f3", brush: "red" }],
      },
    },
  },
  // 7. Jaenisch / Schliemann Gambit
  {
    openingId: "jaenisch-schliemann",
    openingName: "Jaenisch / Schliemann Gambit (vs Ruy Lopez)",
    familyId: "black-f5-counter-gambits",
    color: "black",
    movesSan: ["e4", "e5", "Nf3", "Nc6", "Bb5", "f5", "Nc3", "fxe4", "Nxe4", "d5", "Nxe5", "dxe4"],
    isMainLine: true,
    tags: ["#plan", "#must-know"],
    annotationsByPly: {
      6: {
        note: "3...f5! The Jaenisch/Schliemann Gambit — same ...f5 strike adapted to the Ruy Lopez.",
        arrows: [{ orig: "f7", dest: "f5", brush: "green" }],
      },
      10: {
        note: "5...d5! Claims space immediately in the center while activating the light-squared bishop.",
        arrows: [{ orig: "d7", dest: "d5", brush: "green" }],
      },
    },
  },
  // 8. King's Indian Complex
  {
    openingId: "kings-indian-main",
    openingName: "King's Indian Defense (vs 1.d4)",
    familyId: "black-kings-indian-complex",
    color: "black",
    movesSan: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5", "O-O", "Nc6", "d5", "Ne7"],
    isMainLine: true,
    tags: ["#plan", "#must-know"],
    annotationsByPly: {
      12: {
        note: "6...e5! Strikes White's d4/e4 center at the exact moment White threatens e5 or Be3.",
        arrows: [{ orig: "e7", dest: "e5", brush: "green" }],
      },
      16: {
        note: "8...Ne7! Classic Mar del Plata maneuver: clears the f-pawn so Black immediately launches ...Nh5 / ...f5–f4!",
        arrows: [{ orig: "f7", dest: "f5", brush: "red" }, { orig: "f6", dest: "h5", brush: "blue" }],
      },
    },
  },
  {
    openingId: "kings-indian-vs-london",
    openingName: "KID Setup vs London System",
    familyId: "black-kings-indian-complex",
    color: "black",
    movesSan: ["d4", "Nf6", "Bf4", "g6", "e3", "Bg7", "Nf3", "O-O", "Be2", "d6", "O-O", "Nbd7", "h3", "Qe8"],
    isMainLine: true,
    tags: ["#plan"],
    annotationsByPly: {
      14: {
        note: "7...Qe8 (or 7...c5 / 7...Re8) prepares a forced ...e5 central break that kicks the f4 London bishop.",
        arrows: [{ orig: "e7", dest: "e5", brush: "green" }],
      },
    },
  },
  {
    openingId: "kings-indian-vs-b4",
    openingName: "KID Setup vs 1.b4 (Orangutan)",
    familyId: "black-kings-indian-complex",
    color: "black",
    movesSan: ["b4", "Nf6", "Bb2", "g6", "e3", "Bg7", "Nf3", "O-O", "c4", "d6", "Be2", "e5"],
    isMainLine: true,
    tags: ["#plan"],
    annotationsByPly: {
      6: {
        note: "Your dark-squared bishop on g7 neutralizes White's b2 sniper along the a1-h8 diagonal!",
        arrows: [{ orig: "g7", dest: "b2", brush: "blue" }],
      },
      12: {
        note: "6...e5 grabs the center cleanly while leaving White's b4 pawn loose to future ...a5 breaks.",
        arrows: [{ orig: "e7", dest: "e5", brush: "green" }, { orig: "a7", dest: "a5", brush: "yellow" }],
      },
    },
  },
];
