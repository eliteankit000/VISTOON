"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FolderKanban, PenLine, Dna, Clapperboard, Image as ImageIcon,
  Library, ListVideo, Settings, ShieldCheck, PanelLeftClose, PanelLeftOpen, Menu,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ToastProvider } from "@/components/ui";
import { signOut } from "@/app/auth/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/script-studio", label: "Script Studio", icon: PenLine },
  { href: "/dna", label: "DNA Analyzer", icon: Dna },
  { href: "/video-studio", label: "Video Studio", icon: Clapperboard },
  { href: "/reference-studio", label: "Reference Studio", icon: ImageIcon },
  { href: "/animation-library", label: "Animation Library", icon: Library },
  { href: "/render-queue", label: "Render Queue", icon: ListVideo },
  { href: "/settings", label: "Settings", icon: Settings },
];
// Hiding the Admin link is cosmetic only. Admin pages and APIs enforce role + MFA on the server (lib/auth/guards.ts).
const adminNav = { href: "/admin", label: "Admin Console", icon: ShieldCheck };

export function AppShell({ children, role, label }: { children: React.ReactNode; role: "user" | "admin"; label: string }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = role === "admin" ? [...nav, adminNav] : nav;

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-sidebar transition-all lg:sticky lg:top-0 lg:h-screen",
          collapsed ? "lg:w-16" : "lg:w-60", "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <div className="flex h-14 items-center gap-2 px-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-sm font-bold text-white">V</div>
            {!collapsed && <span className="text-base font-semibold tracking-tight">VISTOON</span>}
          </div>
          <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
            {items.map(({ href, label, icon: Icon }) => {
              const active = path === href || path.startsWith(href + "/");
              return (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} title={label}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                    active ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink",
                    collapsed && "lg:justify-center lg:px-0")}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </nav>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="m-2 hidden items-center gap-2 rounded px-3 py-2 text-sm text-muted hover:bg-hover lg:flex">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:px-8">
            <button className="rounded p-2 text-muted hover:bg-hover lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden text-sm text-muted lg:block">Cloud studio · controlled beta</div>
            <div className="flex items-center gap-3">
              <span className="max-w-[160px] truncate text-xs text-muted">{label}</span>
              <form action={signOut}><button className="rounded px-2 py-1 text-xs text-muted hover:bg-hover hover:text-ink">Sign out</button></form>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
