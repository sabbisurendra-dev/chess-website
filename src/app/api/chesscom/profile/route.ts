import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CHESSCOM_HEADERS = {
  "User-Agent": "ChessVaultOS/1.0 (github.com/sabbisurendra-dev/chess-website)",
  Accept: "application/json",
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{2,40}$/;

export async function GET(request: NextRequest) {
  const usernameParam = request.nextUrl.searchParams.get("username") || "ssaabbbbii";
  const username = usernameParam.trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid Chess.com username format." }, { status: 400 });
  }

  try {
    const [profileRes, statsRes, archivesRes] = await Promise.all([
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`, {
        headers: CHESSCOM_HEADERS,
        next: { revalidate: 300 },
      }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`, {
        headers: CHESSCOM_HEADERS,
        next: { revalidate: 300 },
      }),
      fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, {
        headers: CHESSCOM_HEADERS,
        next: { revalidate: 300 },
      }),
    ]);

    if (profileRes.status === 404) {
      return NextResponse.json({ error: `Chess.com player "${username}" not found.` }, { status: 404 });
    }

    if (!profileRes.ok || !statsRes.ok || !archivesRes.ok) {
      return NextResponse.json(
        {
          error: "Chess.com API temporarily unavailable.",
          statuses: {
            profile: profileRes.status,
            stats: statsRes.status,
            archives: archivesRes.status,
          },
        },
        { status: 502 }
      );
    }

    const [profile, stats, archivesData] = await Promise.all([
      profileRes.json(),
      statsRes.json(),
      archivesRes.json(),
    ]);

    return NextResponse.json(
      {
        profile,
        stats,
        archives: Array.isArray(archivesData?.archives) ? archivesData.archives : [],
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch Chess.com profile.", detail: String(err) },
      { status: 500 }
    );
  }
}
