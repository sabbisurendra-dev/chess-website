import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CHESSCOM_HEADERS = {
  "User-Agent": "ChessVaultOS/1.0 (github.com/sabbisurendra-dev/chess-website)",
  Accept: "application/json",
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{2,40}$/;
const YEAR_RE = /^(20\d{2})$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  const username = (request.nextUrl.searchParams.get("username") || "ssaabbbbii").trim().toLowerCase();
  const year = (request.nextUrl.searchParams.get("year") || "").trim();
  const month = (request.nextUrl.searchParams.get("month") || "").trim().padStart(2, "0");

  if (!USERNAME_RE.test(username) || !YEAR_RE.test(year) || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Invalid username, year, or month." }, { status: 400 });
  }

  const now = new Date();
  const isCurrentMonth =
    Number(year) === now.getUTCFullYear() && Number(month) === now.getUTCMonth() + 1;

  try {
    const res = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${month}`,
      {
        headers: CHESSCOM_HEADERS,
        next: { revalidate: isCurrentMonth ? 60 : 86400 },
      }
    );

    if (res.status === 404) {
      return NextResponse.json({ games: [] });
    }
    if (res.status === 429) {
      return NextResponse.json({ error: "Chess.com rate limit reached. Retry shortly." }, { status: 429 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Chess.com returned status ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(
      { games: Array.isArray(data?.games) ? data.games : [] },
      {
        headers: {
          "Cache-Control": isCurrentMonth
            ? "public, s-maxage=60, stale-while-revalidate=120"
            : "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch archive games.", detail: String(err) },
      { status: 500 }
    );
  }
}
