import fs from "node:fs";
import path from "node:path";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { Chess } from "chess.js";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = process.cwd();

function loadTsModule(relPath) {
  const fullPath = path.join(root, relPath);
  const src = fs.readFileSync(fullPath, "utf8");
  const js = stripTypeScriptTypes(src, { mode: "transform" })
    // Convert top-level ES exports to CJS for lightweight Node validation
    .replace(/import\s+type\s+[^;]+;/g, "")
    .replace(/export\s+const\s+/g, "exports.")
    .replace(/export\s+function\s+(\w+)/g, "exports.$1 = function $1");

  const mod = { exports: {} };
  const customRequire = (id) => {
    if (id.startsWith("@/")) {
      const target = id.replace(/^@\//, "src/") + ".ts";
      if (fs.existsSync(path.join(root, target))) {
        return loadTsModule(target);
      }
      return {};
    }
    return require(id);
  };

  const wrapper = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) { ${js} })`
  );
  wrapper(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

function normFen(fen) {
  const p = fen.trim().split(/\s+/);
  return `${p[0]} ${p[1]} ${p[2]} ${p[3]}`;
}

let errors = 0;
function fail(msg) {
  console.error("❌ FAIL:", msg);
  errors++;
}

// 1. Validate Seed Openings & Transposition Bridge
const { SEED_OPENING_LINES } = loadTsModule("src/data/seedOpenings.ts");
let latvianNorm = "";
let rousseauNorm = "";

for (const line of SEED_OPENING_LINES) {
  const c = new Chess();
  for (let i = 0; i < line.movesSan.length; i++) {
    const mv = c.move(line.movesSan[i]);
    if (!mv) {
      fail(`Opening "${line.openingName}" illegal move "${line.movesSan[i]}" at ply ${i + 1}`);
      break;
    }
    if (line.openingId === "latvian-gambit" && line.movesSan.includes("Bc4") && i === 5) {
      latvianNorm = normFen(c.fen());
    }
    if (line.openingId === "rousseau-gambit" && line.movesSan.includes("Bc4") && i === 5) {
      rousseauNorm = normFen(c.fen());
    }
  }
}

if (!latvianNorm || latvianNorm !== rousseauNorm) {
  fail(`Latvian (${latvianNorm}) and Rousseau (${rousseauNorm}) transposition FENs did NOT match!`);
} else {
  console.log("✅ Transposition verified: Latvian 3.Bc4 Nc6 === Rousseau 3...f5 ->", latvianNorm);
}

// 2. Validate Seed Courses
const { SEED_COURSES } = loadTsModule("src/data/seedCourses.ts");
for (const course of SEED_COURSES) {
  for (const step of course.steps) {
    try {
      const c = new Chess(step.fen);
      if (step.movesFromStartSan) {
        const start = new Chess();
        for (const san of step.movesFromStartSan) {
          if (!start.move(san)) {
            fail(`Course "${course.id}" step "${step.title}" invalid move "${san}"`);
            break;
          }
        }
        if (normFen(start.fen()) !== normFen(step.fen)) {
          fail(`Course "${course.id}" step "${step.title}" movesFromStartSan FEN (${normFen(start.fen())}) != step.fen (${normFen(step.fen)})`);
        }
      }
      if (step.checkpointAnswerUci) {
        const mv = c.move({
          from: step.checkpointAnswerUci.slice(0, 2),
          to: step.checkpointAnswerUci.slice(2, 4),
          promotion: step.checkpointAnswerUci[4],
        });
        if (!mv) {
          fail(`Course "${course.id}" step "${step.title}" illegal checkpoint UCI "${step.checkpointAnswerUci}"`);
        } else if (step.checkpointAnswerSan && mv.san !== step.checkpointAnswerSan) {
          fail(`Course "${course.id}" step "${step.title}" checkpoint SAN mismatch: got ${mv.san}, expected ${step.checkpointAnswerSan}`);
        }
      }
    } catch (e) {
      fail(`Course "${course.id}" step "${step.title}" invalid FEN: ${e.message}`);
    }
  }
}
console.log(`✅ Verified ${SEED_COURSES.length} Knowledge Center courses.`);

// 3. Validate Seed Endgames
const { SEED_ENDGAMES } = loadTsModule("src/data/seedEndgames.ts");
for (const eg of SEED_ENDGAMES) {
  try {
    const c = new Chess(eg.fen);
    for (let i = 0; i < eg.demoLineSan.length; i++) {
      const mv = c.move(eg.demoLineSan[i]);
      if (!mv) {
        fail(`Endgame "${eg.id}" illegal demo move "${eg.demoLineSan[i]}" at index ${i}`);
        break;
      }
    }
    if (eg.demoLineSan.length !== eg.demoAnnotations.length) {
      fail(`Endgame "${eg.id}" demoLineSan (${eg.demoLineSan.length}) != demoAnnotations (${eg.demoAnnotations.length})`);
    }
  } catch (e) {
    fail(`Endgame "${eg.id}" invalid FEN: ${e.message}`);
  }
}
console.log(`✅ Verified ${SEED_ENDGAMES.length} Endgame Structures.`);

// 4. Validate Seed Tactics
const { SEED_TACTICS } = loadTsModule("src/data/seedTactics.ts");
for (const puz of SEED_TACTICS) {
  try {
    const c = new Chess(puz.fen);
    for (let i = 0; i < puz.movesUci.length; i++) {
      const uci = puz.movesUci[i];
      const mv = c.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (!mv) {
        fail(`Tactic "${puz.id}" illegal move "${uci}" at step ${i} on FEN ${c.fen()}`);
        break;
      }
    }
  } catch (e) {
    fail(`Tactic "${puz.id}" invalid FEN: ${e.message}`);
  }
}
console.log(`✅ Verified ${SEED_TACTICS.length} Tactical Puzzles.`);

// 5. Validate Notebook FEN embeds
const { SEED_NOTEBOOK_ENTRIES } = loadTsModule("src/data/seedNotebook.ts");
let embedCount = 0;
for (const note of SEED_NOTEBOOK_ENTRIES) {
  const matches = [...note.content.matchAll(/\[\[fen:([^\]]+)\]\]/g)];
  for (const m of matches) {
    embedCount++;
    try {
      new Chess(m[1].trim());
    } catch (e) {
      fail(`Notebook "${note.id}" invalid FEN embed "${m[1]}": ${e.message}`);
    }
  }
}
console.log(`✅ Verified ${SEED_NOTEBOOK_ENTRIES.length} Notebook entries (${embedCount} live FEN embeds).`);

if (errors > 0) {
  console.error(`\n❌ Validation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log("\n🎉 ALL SEED CONTENT VALIDATED CLEANLY (0 ERRORS)!");
