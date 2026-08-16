"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Grid2x2,
  LayoutDashboard,
  Layers,
  Package,
  PackageOpen,
  Receipt,
  Store,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { MODULE_PROJECTS, usePrefs, type AppModule } from "@/context/PreferencesContext";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { FEATURES } from "@/lib/features";

type NavLink = {
  href: string;
  key: MessageKey;
  icon: LucideIcon;
  feature?: keyof typeof FEATURES;
  modules?: AppModule[];
};

type NavGroupId =
  | "analyse"
  | "planung"
  | "umsatz"
  | "firma"
  | "stammdaten"
  | "abwicklung"
  | "gemeinkosten";

type NavGroup = {
  id: NavGroupId;
  labelKey: MessageKey;
  collapsible: boolean;
  defaultOpen: boolean;
  modules: AppModule[];
  links: NavLink[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "analyse",
    labelKey: "nav.group.analyse",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest", "batches"],
    links: [
      { href: "/overview", key: "nav.overview", icon: LayoutDashboard },
    ],
  },
  {
    id: "firma",
    labelKey: "nav.group.firma",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest", "batches"],
    links: [{ href: "/company", key: "nav.company", icon: Building2 }],
  },
  {
    id: "umsatz",
    labelKey: "nav.group.umsatz",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest"],
    links: [{ href: "/revenue", key: "nav.revenue", icon: TrendingUp }],
  },
  {
    id: "planung",
    labelKey: "nav.group.planung",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest", "batches"],
    links: [
      {
        href: "/sales-volume",
        key: "nav.salesVolume",
        icon: BarChart3,
        feature: "salesVolumePlanning",
        modules: ["invest"],
      },
      {
        href: "/compare",
        key: "nav.compare",
        icon: Layers,
        modules: ["batches"],
      },
    ],
  },
  {
    id: "gemeinkosten",
    labelKey: "nav.group.gemeinkosten",
    collapsible: true,
    defaultOpen: true,
    modules: ["invest"],
    links: [
      {
        href: "/cogs",
        key: "nav.cogs",
        icon: PackageOpen,
        modules: ["invest"],
      },
      {
        href: "/overhead",
        key: "nav.overheadPositions",
        icon: Receipt,
        feature: "overheadTopLevelNav",
      },
      {
        href: "/overhead/personnel",
        key: "nav.overheadPersonnel",
        icon: UserRound,
        feature: "overheadTopLevelNav",
      },
    ],
  },
  {
    id: "stammdaten",
    labelKey: "nav.group.stammdaten",
    collapsible: true,
    defaultOpen: true,
    modules: ["batches"],
    links: [
      { href: "/products", key: "nav.products", icon: Package },
      { href: "/components", key: "nav.components", icon: Grid2x2 },
      { href: "/suppliers", key: "nav.suppliers", icon: Users },
      { href: "/logistics", key: "nav.logistics", icon: Truck },
      { href: "/dealers", key: "nav.dealers", icon: Store },
    ],
  },
  {
    id: "abwicklung",
    labelKey: "nav.group.abwicklung",
    collapsible: false,
    defaultOpen: true,
    modules: ["batches"],
    links: [{ href: "/batches", key: "nav.batches", icon: Layers }],
  },
];

function NavItemIcon({
  icon: Icon,
  active,
}: {
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Icon
      size={15}
      strokeWidth={1.75}
      className={`shrink-0 ${active ? "text-accent" : "text-muted-soft"}`}
      aria-hidden
    />
  );
}

function visibleLinks(links: NavLink[], module: AppModule): NavLink[] {
  return links.filter((link) => {
    if (link.feature && !FEATURES[link.feature]) return false;
    if (link.modules && !link.modules.includes(module)) return false;
    return true;
  });
}

function visibleGroups(module: AppModule | null): NavGroup[] {
  const active = module ?? "batches";
  return NAV_GROUPS.filter((g) => g.modules.includes(active))
    .map((g) => ({ ...g, links: visibleLinks(g.links, active) }))
    .filter((g) => g.links.length > 0);
}

const NAV_OPEN_STORAGE_KEY = "marginlane-nav-open";

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/overhead") return false;
  return pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, group: NavGroup) {
  return group.links.some((link) => isActive(pathname, link.href));
}

function readOpenState(): Partial<Record<NavGroupId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NAV_OPEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<NavGroupId, boolean>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function AppNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const groups = useMemo(
    () => visibleGroups(prefs.activeModule),
    [prefs.activeModule],
  );

  const [openMap, setOpenMap] = useState<Partial<Record<NavGroupId, boolean>>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpenMap(readOpenState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setOpenMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of groups) {
        if (groupHasActive(pathname, group) && next[group.id] === false) {
          next[group.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, hydrated, groups]);

  function isGroupOpen(group: NavGroup) {
    if (!group.collapsible) return true;
    if (groupHasActive(pathname, group)) return true;
    if (!hydrated) return group.defaultOpen;
    return openMap[group.id] ?? group.defaultOpen;
  }

  function toggleGroup(group: NavGroup) {
    if (!group.collapsible) return;
    if (groupHasActive(pathname, group)) return;
    setOpenMap((prev) => {
      const currently = prev[group.id] ?? group.defaultOpen;
      const next = { ...prev, [group.id]: !currently };
      try {
        localStorage.setItem(NAV_OPEN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const moduleLabel =
    prefs.activeModule === "invest"
      ? t("moduleChooser.invest.title")
      : prefs.activeModule === "batches"
        ? t("moduleChooser.batches.title")
        : t("moduleChooser.navHint");

  const projectsHref =
    prefs.activeModule != null ? MODULE_PROJECTS[prefs.activeModule] : "/";

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="px-4 pb-1 pt-4">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
          {moduleLabel}
        </p>
        {prefs.activeProjectName ? (
          <Link
            href={projectsHref}
            className="mt-0.5 block truncate text-[12px] font-medium text-foreground hover:text-accent"
            title={prefs.activeProjectName}
          >
            {prefs.activeProjectName}
          </Link>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3 pt-1">
        {groups.map((group) => {
          const open = isGroupOpen(group);
          return (
            <div key={group.id}>
              {group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between rounded-[6px] px-2 py-1 text-left transition-colors hover:bg-white/50"
                  aria-expanded={open}
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t(group.labelKey)}
                  </span>
                  <GroupChevron open={open} />
                </button>
              ) : (
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  {t(group.labelKey)}
                </p>
              )}
              {open ? (
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = isActive(pathname, link.href);
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
                        <NavItemIcon icon={link.icon} active={active} />
                        {t(link.key)}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const flatLinks = useMemo(
    () => visibleGroups(prefs.activeModule).flatMap((g) => g.links),
    [prefs.activeModule],
  );

  if (flatLinks.length === 0) return null;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
      {flatLinks.map((link) => {
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
    </nav>
  );
}

function GroupChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={12}
      strokeWidth={2}
      className={`shrink-0 text-muted-soft transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden
    />
  );
}
