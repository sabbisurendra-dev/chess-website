import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fen = (request.nextUrl.searchParams.get("fen") || "").trim();
  const requestedSource =
    request.nextUrl.searchParams.get("source") === "lichess" ? "lichess" : "masters";
  const ratings = request.nextUrl.searchParams.get("ratings") || "1000,1200,1400,1600";
  const speeds = request.nextUrl.searchParams.get("speeds") || "blitz,rapid,classical";
  const token =
    request.headers.get("x-lichess-token")?.trim() ||
    process.env.LICHESS_API_TOKEN?.trim() ||
    "";

  if (!fen || fen.length > 140) {
    return NextResponse.json({ error: "Missing or invalid FEN." }, { status: 400 });
  }

  const buildUrl = (src: "masters" | "lichess") =>
    src === "masters"
      ? `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=10`
      : `https://explorer.lichess.ovh/lichess?variant=standard&fen=${encodeURIComponent(
          fen
        )}&speeds=${encodeURIComponent(speeds)}&ratings=${encodeURIComponent(ratings)}&moves=10`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "ChessVaultOS/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    let res = await fetch(buildUrl(requestedSource), {
      headers,
      next: { revalidate: 3600 },
    });

    let actualSource: "masters" | "lichess" = requestedSource;
    let authRequiredForClub = false;

    if (requestedSource === "lichess" && res.status === 401) {
      authRequiredForClub = true;
      actualSource = "masters";
      res = await fetch(buildUrl("masters"), {
        headers: { Accept: "application/json", "User-Agent": "ChessVaultOS/1.0" },
        next: { revalidate: 3600 },
      });
    }

    if (res.status === 429) {
      return NextResponse.json(
        { error: "Lichess Explorer rate limit hit. Wait 60s before querying again.", rateLimited: true },
        { status: 429 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Lichess Explorer unavailable (${res.status}).`, unavailable: true },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(
      {
        ...data,
        sourceUsed: actualSource,
        authRequiredForClub,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to contact Lichess Explorer.", detail: String(err), unavailable: true },
      { status: 500 }
    );
  }
}
