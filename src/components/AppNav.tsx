"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/lieferanten", label: "Lieferanten", icon: SuppliersIcon },
  { href: "/produkte", label: "Produkte", icon: ProductsIcon },
  { href: "/haendler", label: "Händler", icon: DealersIcon },
  { href: "/chargen", label: "Chargen", icon: BatchesIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-foreground text-[11px] font-semibold tracking-tight text-white">
          ML
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            Marginlane
          </p>
          <p className="truncate text-[11px] text-muted-soft">Unit Economics</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-1">
        <p className="px-2 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
          Workspace
        </p>
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13px] transition-colors ${
                active
                  ? "bg-white font-medium text-foreground shadow-[var(--shadow-sm)]"
                  : "text-muted hover:bg-white/70 hover:text-foreground"
              }`}
            >
              <Icon active={active} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <p className="text-[11px] text-muted-soft">Daten lokal im Browser</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] ${
              active
                ? "bg-surface-soft font-medium text-foreground"
                : "text-muted"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SuppliersIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <circle cx="7.5" cy="4.5" r="2.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 12.5c0-2.4 2.1-4.25 5-4.25s5 1.85 5 4.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ProductsIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <path
        d="M2.5 4.2 7.5 1.75 12.5 4.2v6.6L7.5 13.25 2.5 10.8V4.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5V13.1M7.5 7.5 2.7 5.1M7.5 7.5l4.8-2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function DealersIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <path
        d="M2.5 11.5V5.2L7.5 2.5l5 2.7v6.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M5.5 11.5V8h4v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function BatchesIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <path d="M2.5 4.5h10M2.5 7.5h10M2.5 10.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

