import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function countBoardPieces(fen: string): number {
  const board = fen.split(" ")[0] || "";
  let count = 0;
  for (const ch of board) {
    if (/[pnbrqkPNBRQK]/.test(ch)) count++;
  }
  return count;
}

export async function GET(request: NextRequest) {
  const fen = (request.nextUrl.searchParams.get("fen") || "").trim();
  if (!fen || fen.length > 140) {
    return NextResponse.json({ error: "Missing or invalid FEN." }, { status: 400 });
  }

  const pieces = countBoardPieces(fen);
  if (pieces < 2 || pieces > 7) {
    return NextResponse.json({
      supported: false,
      reason: `Syzygy 7-piece tablebase requires <= 7 pieces (board has ${pieces}). Falling back to Stockfish WASM.`,
      pieces,
    });
  }

  try {
    const res = await fetch(
      `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ChessVaultOS/1.0",
        },
        next: { revalidate: 86400 },
      }
    );

    if (res.status === 429) {
      return NextResponse.json(
        { supported: false, rateLimited: true, reason: "Lichess Tablebase rate limited." },
        { status: 429 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { supported: false, reason: `Tablebase returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(
      { supported: true, ...data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { supported: false, reason: "Failed to contact Lichess Tablebase.", detail: String(err) },
      { status: 500 }
    );
  }
}
