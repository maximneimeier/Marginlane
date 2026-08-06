"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  initialsFromName,
  usePrefs,
} from "@/context/PreferencesContext";
import { useI18n } from "@/hooks/useI18n";

const links = [
  { href: "/overview", key: "nav.overview" as const, icon: OverviewIcon },
  { href: "/suppliers", key: "nav.suppliers" as const, icon: SuppliersIcon },
  { href: "/products", key: "nav.products" as const, icon: ProductsIcon },
  { href: "/components", key: "nav.components" as const, icon: ComponentsIcon },
  { href: "/overhead", key: "nav.overhead" as const, icon: OverheadIcon },
  { href: "/dealers", key: "nav.dealers" as const, icon: DealersIcon },
  { href: "/batches", key: "nav.batches" as const, icon: BatchesIcon },
  { href: "/compare", key: "nav.compare" as const, icon: CompareIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const settingsActive = pathname.startsWith("/settings");
  const initials = initialsFromName(prefs.displayName);

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
          {t("nav.workspace")}
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
              {t(link.key)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-2">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-[10px] px-2 py-2 transition-colors ${
            settingsActive
              ? "bg-white shadow-[var(--shadow-sm)]"
              : "hover:bg-white/70"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold tracking-tight text-accent">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">
              {prefs.displayName}
            </p>
            <p className="truncate text-[11px] text-muted-soft">
              {t("nav.settings")}
            </p>
          </div>
          <SettingsChevron />
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();

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
            {t(link.key)}
          </Link>
        );
      })}
      <Link
        href="/settings"
        className={`shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] ${
          pathname.startsWith("/settings")
            ? "bg-surface-soft font-medium text-foreground"
            : "text-muted"
        }`}
      >
        {t("nav.settings")}
      </Link>
    </nav>
  );
}

function SettingsChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="shrink-0 text-muted-soft"
      aria-hidden
    >
      <path
        d="M5.25 3.5 8.75 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <rect x="2" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="8.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
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

function ComponentsIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <rect x="2.25" y="2.25" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.25" y="2.25" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2.25" y="8.25" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.25" y="8.25" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function OverheadIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <rect x="2.25" y="2.25" width="10.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 7.5h6M7.5 4.5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

function CompareIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={active ? "text-accent" : "text-muted-soft"}>
      <path d="M3 12V6.5M7.5 12V3.5M12 12V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
