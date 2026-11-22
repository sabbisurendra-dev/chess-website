import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const binDir = path.join(rootDir, "node_modules", "stockfish", "bin");
const outDir = path.join(rootDir, "public", "engine");

if (!fs.existsSync(binDir)) {
  console.warn("[copy-stockfish] node_modules/stockfish/bin not found; skipping.");
  process.exit(0);
}

const files = fs.readdirSync(binDir);
const jsFile = files.find((f) => /lite-single\.js$/.test(f)) || files.find((f) => /single\.js$/.test(f));
const wasmFile = jsFile ? jsFile.replace(/\.js$/, ".wasm") : null;

if (!jsFile || !wasmFile || !fs.existsSync(path.join(binDir, wasmFile))) {
  console.error("[copy-stockfish] Could not locate single-threaded lite Stockfish JS/WASM pair in", binDir);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(binDir, jsFile), path.join(outDir, "stockfish.js"));
fs.copyFileSync(path.join(binDir, wasmFile), path.join(outDir, "stockfish.wasm"));

console.log(`[copy-stockfish] Copied ${jsFile} -> public/engine/stockfish.js`);
console.log(`[copy-stockfish] Copied ${wasmFile} -> public/engine/stockfish.wasm`);
