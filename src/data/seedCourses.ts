import type { CourseModule } from "@/types/chess";

export const SEED_COURSES: CourseModule[] = [
  {
    id: "course-nc3-f4-dna",
    title: "The Nc3 + f4 Attack DNA (Vienna ↔ Grand Prix)",
    category: "Opening Systems",
    level: "Core",
    familyId: "white-nc3-f4-attack",
    ecoFilter: ["Vienna", "Closed-Sicilian", "Grand-Prix", "Caro-Kann-Defense-Two-Knights"],
    summary:
      "Learn how one unified White attacking setup (Nc3 + f4 + Bc4/Bb5 + O-O + Qe1-h4) handles 1...e5 AND the Sicilian 1...c5 while cutting your memorization in half.",
    keyTakeaways: [
      "Delay Nf3 so the f-pawn stays free to march to f4.",
      "In the Vienna Gambit (1.e4 e5 2.Nc3 Nf6 3.f4), meet 3...exf4?! with 4.e5!",
      "Against 2...Nc6, play 3.Bc4 first! Crush 3...Bc5? with 4.Qg4!",
      "In the Sicilian (1.e4 c5 2.Nc3 Nc6 3.f4), shift the bishop to b5 and launch f4–f5 after castling.",
    ],
    steps: [
      {
        title: "1. Why Nc3 Before Nf3?",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2",
        movesFromStartSan: ["e4", "e5", "Nc3"],
        explanation:
          "By playing 2.Nc3 instead of 2.Nf3, you keep the f-file clear for f2-f4 and defend e4 cleanly. Notice this works identically whether Black plays 1...e5 or 1...c5.",
        arrows: [
          { orig: "f2", dest: "f4", brush: "green" },
          { orig: "c3", dest: "d5", brush: "blue" },
        ],
      },
      {
        title: "2. The Vienna Gambit (Punishing 2...Nf6)",
        fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3",
        movesFromStartSan: ["e4", "e5", "Nc3", "Nf6", "f4"],
        explanation:
          "3.f4! challenges e5 right away. If Black greedily takes 3...exf4?, 4.e5! kicks the f6 knight into retreat, leaving White with effortless development and a crushing center.",
        arrows: [
          { orig: "e4", dest: "e5", brush: "green" },
          { orig: "f1", dest: "c4", brush: "blue" },
        ],
      },
      {
        title: "3. Checkpoint: Punish 3...Bc5? in the Copycat Trap",
        fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 4 4",
        movesFromStartSan: ["e4", "e5", "Nc3", "Nc6", "Bc4", "Bc5"],
        explanation:
          "Against 2...Nc6 you wisely played 3.Bc4 first. Now Black blindly mirrored with 3...Bc5?. Find the ruthless queen sortie that hits g7 and breaks Black's setup!",
        checkpointPrompt: "Find White's strongest 4th move against 3...Bc5?:",
        checkpointAnswerUci: "d1g4",
        checkpointAnswerSan: "Qg4",
        arrows: [{ orig: "d1", dest: "g4", brush: "green" }],
      },
      {
        title: "4. Twin Setup: Grand Prix Attack vs Sicilian",
        fen: "r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3",
        movesFromStartSan: ["e4", "c5", "Nc3", "Nc6", "f4"],
        explanation:
          "Notice the exact same White formation against 1...c5! Here White develops Nf3, Bb5 (or Bc4), O-O, and Qe1-h4, pushing f4-f5 to crack open Black's castled king.",
        arrows: [
          { orig: "f1", dest: "b5", brush: "blue" },
          { orig: "d1", dest: "e1", brush: "yellow" },
          { orig: "f4", dest: "f5", brush: "red" },
        ],
      },
    ],
  },
  {
    id: "course-f5-counter-gambits",
    title: "The ...f5 Counter-Gambit Web (Latvian ↔ Rousseau ↔ Jaenisch)",
    category: "Opening Systems",
    level: "Sharp",
    familyId: "black-f5-counter-gambits",
    ecoFilter: ["Latvian", "Rousseau", "Jaenisch", "Ruy-Lopez-Opening-Jaenisch-Gambit"],
    summary:
      "Connect the Latvian Gambit, Rousseau Gambit, and Jaenisch/Schliemann into one transposition-aware attacking system for Black against 1.e4 e5.",
    keyTakeaways: [
      "Latvian 1.e4 e5 2.Nf3 f5 3.Bc4 Nc6 and Rousseau 1.e4 e5 2.Nf3 Nc6 3.Bc4 f5 reach the EXACT SAME position.",
      "After 4.exf5? in the Rousseau, push 4...e4! driving White's knight off the board.",
      "Against 3.Nxe5 in the Latvian, 3...Qf6! hits e5 and prepares ...fxe4.",
      "Against Ruy Lopez 3.Bb5, 3...f5! (Jaenisch) keeps the exact same counter-attacking pressure.",
    ],
    steps: [
      {
        title: "1. The Transposition Hub (Latvian 3.Bc4 Nc6 = Rousseau 3...f5)",
        fen: "r1bqkbnr/pppp2pp/2n5/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4",
        movesFromStartSan: ["e4", "e5", "Nf3", "Nc6", "Bc4", "f5"],
        explanation:
          "Whether you got here via 2...f5 3.Bc4 Nc6 (Latvian Declined) or 2...Nc6 3.Bc4 f5 (Rousseau), the board is identical! White now faces difficult tactical choices.",
        circles: [{ orig: "f5", brush: "green" }, { orig: "c6", brush: "blue" }],
      },
      {
        title: "2. Checkpoint: Punish White's Greed After 4.exf5?",
        fen: "r1bqkbnr/pppp2pp/2n5/4pP2/2B5/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
        movesFromStartSan: ["e4", "e5", "Nf3", "Nc6", "Bc4", "f5", "exf5"],
        explanation:
          "White grabbed your f5 pawn! Find Black's crushing central push that wins immediate initiative.",
        checkpointPrompt: "Play Black's strongest reply to 4.exf5?:",
        checkpointAnswerUci: "e5e4",
        checkpointAnswerSan: "e4",
        arrows: [{ orig: "e5", dest: "e4", brush: "green" }],
      },
      {
        title: "3. Latvian Main Response to 3.Nxe5",
        fen: "rnbqkbnr/pppp2pp/8/4Np2/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
        movesFromStartSan: ["e4", "e5", "Nf3", "f5", "Nxe5"],
        explanation:
          "If White takes on e5 in the Latvian, do NOT panic about Qh5+—bring out 3...Qf6! attacking the knight and eyeing ...fxe4.",
        checkpointPrompt: "Find Black's main-line move after 3.Nxe5:",
        checkpointAnswerUci: "d8f6",
        checkpointAnswerSan: "Qf6",
        arrows: [{ orig: "d8", dest: "f6", brush: "green" }],
      },
      {
        title: "4. Jaenisch / Schliemann vs Ruy Lopez",
        fen: "r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
        movesFromStartSan: ["e4", "e5", "Nf3", "Nc6", "Bb5", "f5"],
        explanation:
          "When White plays the Spanish (3.Bb5), 3...f5! strikes immediately. After 4.Nc3 fxe4 5.Nxe4 d5!, Black seizes central space and active piece play.",
        arrows: [{ orig: "f7", dest: "f5", brush: "green" }],
      },
    ],
  },
  {
    id: "course-kings-indian-blueprint",
    title: "King's Indian Universal Complex (vs 1.d4, London & 1.b4)",
    category: "Opening Systems",
    level: "Core",
    familyId: "black-kings-indian-complex",
    ecoFilter: ["Kings-Indian", "Indian-Game", "Kings-Fianchetto"],
    summary:
      "Use one dark-square fianchetto shell (...Nf6, ...g6, ...Bg7, ...d6, ...O-O) to crush 1.d4, London 2.Bf4, and flank openings like 1.b4 or 1.c4.",
    keyTakeaways: [
      "The Bg7 fianchetto rules the h8-a1 diagonal and protects your king.",
      "Wait until you castle before striking the center with ...e5 (or ...c5).",
      "When White locks the center with d4-d5, respond with ...Ne7 and ...f5–f4 kingside storm!",
    ],
    steps: [
      {
        title: "1. The Universal Shell",
        fen: "rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6",
        movesFromStartSan: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2"],
        explanation:
          "Black has reached the King's Indian base camp: Nf6, g6, Bg7, d6, O-O. Now it's time to strike White's broad center!",
        checkpointPrompt: "Strike White's center with the classic King's Indian pawn break:",
        checkpointAnswerUci: "e7e5",
        checkpointAnswerSan: "e5",
        arrows: [{ orig: "e7", dest: "e5", brush: "green" }],
      },
      {
        title: "2. Locked Center = Kingside Pawn Storm",
        fen: "r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 8",
        movesFromStartSan: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5", "O-O", "Nc6", "d5"],
        explanation:
          "White closed the center with d5! Now Black clears the f6 knight (to e7 or h5) to push ...f5–f4–g5 right at White's castled king.",
        arrows: [
          { orig: "f7", dest: "f5", brush: "red" },
          { orig: "f6", dest: "e8", brush: "blue" },
        ],
      },
    ],
  },
  {
    id: "course-f4-f5-storm",
    title: "Middlegame Pawn Structures: The f4–f5 Attacking Break",
    category: "Middlegame Structures",
    level: "Intermediate",
    summary:
      "Why advancing the f-pawn with a rook behind it is the single highest-yield attacking motif across Vienna, Grand Prix, and King's Indian middlegames.",
    keyTakeaways: [
      "Never push f5 blindly if your center collapses; stabilize d4/e4 first.",
      "Castle kingside BEFORE or immediately after f4 so O-O puts your rook directly onto the f-file.",
      "Use Qe1-h4 (or ...Qe8-h5) to double attacks on h7/f7 along with the dark- or light-squared bishop.",
    ],
    steps: [
      {
        title: "The Grand Prix Battery (Qe1-h4 + f5)",
        fen: "r1bq1rk1/pp1pppbp/2n3p1/2p5/4PP2/2NP1N2/PPP3PP/R1BQ1RK1 w - - 1 8",
        explanation:
          "White has castled, planted pawns on e4/f4/d3, and readies Qe1-h4 followed by f5! Once Black's g6/e6 pawns crack, White's rook on f1 and bishop on c1 flood the kingside.",
        arrows: [
          { orig: "d1", dest: "e1", brush: "blue" },
          { orig: "e1", dest: "h4", brush: "blue" },
          { orig: "f4", dest: "f5", brush: "red" },
        ],
      },
      {
        title: "Checkpoint: Trigger the Break!",
        fen: "r1bq1rk1/pp1n1pbp/3pp1p1/2p5/4PP1Q/2NP1N2/PPP3PP/R1B2RK1 w - - 2 10",
        explanation:
          "Your queen is already poised on h4, your rook sits on f1, and Black hasn't finished queenside counterplay. Trigger the pawn break!",
        checkpointPrompt: "Push the pawn that rips open Black's kingside:",
        checkpointAnswerUci: "f4f5",
        checkpointAnswerSan: "f5",
        arrows: [{ orig: "f4", dest: "f5", brush: "green" }],
      },
    ],
  },
  {
    id: "course-tactical-geometry",
    title: "Tactical Motifs: Forks, Pins & The Greek Gift (Bxh7+)",
    category: "Tactical Motifs",
    level: "Intermediate",
    summary:
      "Master the core tactical geometries that decide 80% of rapid and blitz games: royal knight forks, absolute pins, and the classic Bxh7+ kingside sacrifice.",
    keyTakeaways: [
      "Greek Gift Checklist (Bxh7+): Can Ng5+ follow? Can Qh5 arrive? Is Black's f6 knight or c8 bishop blocking h7/g5?",
      "Pins win material only when you pile ANOTHER attacker onto the pinned piece ('PP on the PP').",
      "Always look for intermediate checks (zwischenzug) before recapturing!",
    ],
    steps: [
      {
        title: "Classic Greek Gift Conditions",
        fen: "r1bq1rk1/pppn1ppp/4pn2/3p4/1b1P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 4 8",
        explanation:
          "Wait—here Black still has a knight on f6 guarding h7 AND h5! Never play Bxh7+ while Nf6 stays on f6. Chase or trade the f6 knight first (e.g. e4-e5).",
        circles: [{ orig: "f6", brush: "red" }, { orig: "h7", brush: "yellow" }],
      },
      {
        title: "Checkpoint: Launch the Greek Gift!",
        fen: "r1bq1rk1/pppn1ppp/4p3/3pP3/3P4/2NB1N2/PP3PPP/R1BQ1RK1 w - - 0 9",
        explanation:
          "Now White pushed e5 and chased away Black's f6 defender! Black's king on g8 is wide open: bishop on d3, knight ready for Ng5+, queen ready for Qh5. Find the winning sacrifice!",
        checkpointPrompt: "Find White's classic sacrifice:",
        checkpointAnswerUci: "d3h7",
        checkpointAnswerSan: "Bxh7+",
        arrows: [
          { orig: "d3", dest: "h7", brush: "green" },
          { orig: "f3", dest: "g5", brush: "blue" },
          { orig: "d1", dest: "h5", brush: "red" },
        ],
      },
    ],
  },
  {
    id: "course-morphy-opera",
    title: "Classic Model Game: Paul Morphy's Opera Game (1858)",
    category: "Classic Model Games",
    level: "Core",
    summary:
      "The greatest lesson in chess history on rapid development, open files, pins, and sacrificing material to keep the enemy king stuck in the center.",
    keyTakeaways: [
      "Develop EVERY piece with tempo before chasing pawns.",
      "When ahead in development, open lines violently—even at the cost of a piece (10.Nxb5!).",
      "Use pins along files and diagonals to freeze defenders (13.Rxd7!).",
    ],
    steps: [
      {
        title: "1. Morphy Sacrifices a Knight to Open All Lines (10.Nxb5!)",
        fen: "rn2kb1r/p3qppp/2p2n2/1p2p1B1/2B1P3/1QN5/PPP2PPP/R3K2R w KQkq - 0 10",
        movesFromStartSan: [
          "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5",
          "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5",
        ],
        explanation:
          "Black just pushed 9...b5 hoping to chase White's bishop. Instead of retreating, Morphy unleashes 10.Nxb5! cxb5 11.Bxb5+ Nbd7 12.O-O-O—pinning everything down!",
        checkpointPrompt: "Play Morphy's fearless 10th move:",
        checkpointAnswerUci: "c3b5",
        checkpointAnswerSan: "Nxb5",
        arrows: [{ orig: "c3", dest: "b5", brush: "green" }],
      },
      {
        title: "2. The Exchange Sacrifice & Immortal Finish (16.Qb8+!)",
        fen: "1n2kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR3R w k - 2 14",
        explanation:
          "After 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7, Morphy played 14.Rd1 Qe6 15.Bxd7+ Nxd7 — and finished with the legendary Queen sacrifice 16.Qb8+!! Nxb8 17.Rd8#!",
        arrows: [
          { orig: "b3", dest: "b8", brush: "red" },
          { orig: "d1", dest: "d8", brush: "green" },
        ],
      },
    ],
  },
];
