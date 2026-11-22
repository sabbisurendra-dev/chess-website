"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Crosshair,
  Crown,
  FileText,
  GitBranch,
  LayoutDashboard,
  Menu,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Swords,
  X,
} from "lucide-react";
import { db, ensureSeeded } from "@/lib/storage/db";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/games", label: "Games & Review", icon: Swords },
  { href: "/openings", label: "Opening Prep", icon: GitBranch },
  { href: "/practice", label: "Opening Practice", icon: Compass },
  { href: "/knowledge", label: "Knowledge Center", icon: BookOpen },
  { href: "/tactics", label: "Tactics Practice", icon: Crosshair },
  { href: "/endgames", label: "Endgame Lab", icon: Crown },
  { href: "/notebook", label: "Chess Notebook", icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [username, setUsername] = useState("ssaabbbbii");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [boardTheme, setBoardTheme] = useState<"brown" | "slate" | "green">("brown");
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await ensureSeeded();
      const s = await db.settings.get("singleton");
      const nowIso = new Date().toISOString();
      const due = await db.drillCards.where("due").belowOrEqual(nowIso).count();
      if (!mounted) return;
      if (s) {
        setUsername(s.chessComUsername || "ssaabbbbii");
        setTheme(s.theme || "dark");
        setBoardTheme(s.boardTheme || "brown");
        applyHtmlTheme(s.theme || "dark", s.boardTheme || "brown");
      }
      setDueCount(due);
    })();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  const applyHtmlTheme = (t: "dark" | "light" | "system", b: "brown" | "slate" | "green") => {
    const html = document.documentElement;
    if (t === "system") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", t);
    }
    html.setAttribute("data-board", b);
  };

  const cycleTheme = async () => {
    const order: ("dark" | "light" | "system")[] = ["dark", "light", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    applyHtmlTheme(next, boardTheme);
    await db.settings.update("singleton", { theme: next }).catch(() => {});
  };

  const cycleBoard = async () => {
    const order: ("brown" | "slate" | "green")[] = ["brown", "slate", "green"];
    const next = order[(order.indexOf(boardTheme) + 1) % order.length];
    setBoardTheme(next);
    applyHtmlTheme(theme, next);
    await db.settings.update("singleton", { boardTheme: next }).catch(() => {});
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div
          className="px-4 py-4 border-b flex items-center justify-between gap-2"
          style={{ borderColor: "var(--border)" }}
        >
          <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              ♞
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight leading-none">ChessVault OS</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Knowledge · Prep · Coach
              </div>
            </div>
          </Link>
        </div>

        <div className="px-3 py-3">
          <div
            className="rounded-lg px-3 py-2 border text-xs flex items-center justify-between"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-mono font-semibold truncate">{username}</span>
            </div>
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Sync
            </Link>
          </div>
        </div>

        <nav className="px-2.5 space-y-0.5" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.href === "/practice" && dueCount > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    {dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={cycleTheme}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            title="Switch theme (Dark / Light / System)"
          >
            {theme === "light" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="capitalize">{theme}</span>
          </button>
          <button
            type="button"
            onClick={cycleBoard}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            title="Switch board palette"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="capitalize">{boardTheme}</span>
          </button>
        </div>
        <div className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
          Stockfish 19 WASM · FSRS · Syzygy
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:block w-64 shrink-0 border-r sticky top-0 h-dvh overflow-y-auto scroller no-print"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <header
        className="lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30 no-print"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-2 font-bold text-sm">
          <span className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            ♞
          </span>
          <span>ChessVault OS</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/15 text-emerald-300">
            {username}
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex no-print"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-68 h-full border-r overflow-y-auto"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
    </div>
  );
}
