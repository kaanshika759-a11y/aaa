"use client";

/**
 * Navigation / Sidebar – Desktop Sidebar & Mobile Nav for ApniAwaaz
 * Styled with Slate-950/900 Dark Glassmorphism & Cyan/Blue Neon Accents
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const NAV_ITEMS = [
  { href: "/",           label: "Dashboard",       icon: "🏠" },
  { href: "/coach",      label: "AI Coach",         icon: "🤖" },
  { href: "/translator", label: "Translator",       icon: "🌐" },
  { href: "/practice",   label: "Practice",         icon: "🎯" },
  { href: "/camera",     label: "Camera Practice",  icon: "📷" },
  { href: "/daily",      label: "Daily Challenge",  icon: "🔥" },
  { href: "/vocabulary", label: "Vocabulary",       icon: "📚" },
  { href: "/progress",   label: "Progress",         icon: "📈" },
  { href: "/settings",   label: "Settings",         icon: "⚙️" },
];

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = "" }: NavigationProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!mounted) return null;

  return (
    <>
      {/* ── Desktop / Tablet Fixed Sidebar (Always visible on md, lg, xl, maximized) ── */}
      <aside
        className={`hidden md:flex flex-col w-64 min-h-screen h-full border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-xl sticky top-0 z-40 py-6 px-4 flex-shrink-0 overflow-y-auto select-none ${className}`}
      >
        {/* Brand Logo Component */}
        <div className="px-1 mb-8">
          <Logo size="md" showTagline={true} />
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1.5" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/15 via-blue-600/15 to-transparent text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 hover:border-slate-800/60 border border-transparent"
                  }
                `}
              >
                <span className="text-lg w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info card */}
        <div className="mt-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-center backdrop-blur-sm">
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Speak with confidence.
              <br />
              <span className="text-cyan-400/90">Learn with courage.</span>
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Header (< md) ── */}
      <header className="md:hidden sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" showTagline={false} />

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* ── Mobile Dropdown Menu (< md) ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-[57px]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setMobileOpen(false)}
          />
          {/* Menu panel */}
          <div className="relative bg-slate-950 border-b border-slate-800 p-4 grid grid-cols-3 gap-2 shadow-2xl">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all
                    ${
                      isActive
                        ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export { Navigation as Sidebar };
