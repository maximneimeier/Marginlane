"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Factory,
  Grid2x2,
  LayoutDashboard,
  Layers,
  Package,
  PackageOpen,
  Plus,
  Receipt,
  Scale,
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
import {
  costerraModeFromModule,
  isCosterraAppModule,
  type CosterraMode,
} from "@/lib/costerraMode";

const COSTERRA_MODULES: AppModule[] = ["batches", "batches_wholesale"];

type NavLink = {
  href: string;
  key: MessageKey;
  icon: LucideIcon;
  feature?: keyof typeof FEATURES;
  modules?: AppModule[];
  /** Nur in diesen Costerra-Modi (bei Costerra-Modulen) */
  costerraModes?: CosterraMode[];
  /** Stärkere Darstellung — Hauptarbeitsplatz */
  primary?: boolean;
  /** Nummerierter Schritt in der Wertschöpfung */
  step?: number;
  /** Unterstützende Links (Vergleich, Händler, …) */
  secondary?: boolean;
};

type NavGroupId =
  | "arbeiten"
  | "wertschoepfung"
  | "einkauf"
  | "lagerung"
  | "verkauf"
  | "konsolidiert"
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
  /** Primär-CTA unter den Links (z. B. Neue Charge) */
  cta?: { href: string; key: MessageKey };
};

const INVEST_NAV_GROUPS: NavGroup[] = [
  {
    id: "analyse",
    labelKey: "nav.group.analyse",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest"],
    links: [
      { href: "/overview", key: "nav.overview", icon: LayoutDashboard },
    ],
  },
  {
    id: "firma",
    labelKey: "nav.group.firma",
    collapsible: false,
    defaultOpen: true,
    modules: ["invest"],
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
    modules: ["invest"],
    links: [
      {
        href: "/sales-volume",
        key: "nav.salesVolume",
        icon: BarChart3,
        feature: "salesVolumePlanning",
        modules: ["invest"],
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
        modules: ["invest"],
      },
      {
        href: "/overhead/personnel",
        key: "nav.overheadPersonnel",
        icon: UserRound,
        feature: "overheadTopLevelNav",
      },
    ],
  },
];

/** Costerra: ein Ablauf + Stammdaten + Konsolidiert. */
const COSTERRA_NAV_GROUPS: NavGroup[] = [
  {
    id: "wertschoepfung",
    labelKey: "nav.group.wertschoepfung",
    collapsible: false,
    defaultOpen: true,
    modules: COSTERRA_MODULES,
    links: [
      {
        href: "/batches",
        key: "nav.batches",
        icon: Layers,
        step: 1,
      },
      {
        href: "/inventory",
        key: "nav.inventory",
        icon: PackageOpen,
        step: 2,
      },
      {
        href: "/production",
        key: "nav.production",
        icon: Factory,
        step: 3,
        costerraModes: ["manufacturing"],
      },
      {
        href: "/verkauf",
        key: "nav.abverkauf",
        icon: TrendingUp,
        step: 4,
      },
      {
        href: "/compare",
        key: "nav.compare",
        icon: Scale,
        secondary: true,
      },
    ],
  },
  {
    id: "stammdaten",
    labelKey: "nav.group.stammdaten",
    collapsible: true,
    defaultOpen: false,
    modules: COSTERRA_MODULES,
    links: [
      { href: "/suppliers", key: "nav.suppliers", icon: Users },
      { href: "/products", key: "nav.products", icon: Package },
      {
        href: "/components",
        key: "nav.components",
        icon: Grid2x2,
        costerraModes: ["manufacturing"],
      },
      { href: "/dealers", key: "nav.dealers", icon: Store },
      { href: "/logistics", key: "nav.logistics", icon: Truck },
    ],
  },
  {
    id: "konsolidiert",
    labelKey: "nav.group.konsolidiert",
    collapsible: true,
    defaultOpen: false,
    modules: COSTERRA_MODULES,
    links: [
      { href: "/overview", key: "nav.overview", icon: LayoutDashboard },
      {
        href: "/overhead",
        key: "nav.overheadSimple",
        icon: Receipt,
        feature: "overheadTopLevelNav",
        modules: COSTERRA_MODULES,
      },
      {
        href: "/overhead/personnel",
        key: "nav.overheadPersonnel",
        icon: UserRound,
        feature: "overheadTopLevelNav",
      },
      { href: "/company", key: "nav.company", icon: Building2 },
    ],
  },
];

function NavItemIcon({
  icon: Icon,
  active,
  primary,
}: {
  icon: LucideIcon;
  active: boolean;
  primary?: boolean;
}) {
  return (
    <Icon
      size={primary ? 16 : 15}
      strokeWidth={primary ? 2 : 1.75}
      className={`shrink-0 ${
        active ? "text-accent" : primary ? "text-foreground" : "text-muted-soft"
      }`}
      aria-hidden
    />
  );
}

function visibleLinks(
  links: NavLink[],
  module: AppModule,
  costerraMode: CosterraMode,
): NavLink[] {
  const filtered = links.filter((link) => {
    if (link.feature && !FEATURES[link.feature]) return false;
    if (link.modules && !link.modules.includes(module)) return false;
    if (
      isCosterraAppModule(module) &&
      link.costerraModes &&
      !link.costerraModes.includes(costerraMode)
    ) {
      return false;
    }
    return true;
  });

  // Wertschöpfungs-Schritte nach Filter neu nummerieren (z. B. ohne Produktion)
  let step = 1;
  return filtered.map((link) => {
    if (link.step == null) return link;
    return { ...link, step: step++ };
  });
}

function visibleGroups(
  module: AppModule | null,
  costerraMode: CosterraMode,
): NavGroup[] {
  const active = module ?? "batches_wholesale";
  const source = active === "invest" ? INVEST_NAV_GROUPS : COSTERRA_NAV_GROUPS;
  return source
    .filter((g) => g.modules.includes(active))
    .map((g) => ({
      ...g,
      links: visibleLinks(g.links, active, costerraMode),
    }))
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

function NavLinkRow({ link, pathname }: { link: NavLink; pathname: string }) {
  const { t } = useI18n();
  const active = isActive(pathname, link.href);
  const stepped = link.step != null;
  const primary = Boolean(link.primary) || stepped;
  const secondary = Boolean(link.secondary) && !stepped;
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      className={`group flex items-center gap-2 rounded-[8px] px-2 py-[6px] text-[13px] transition-colors ${
        active
          ? "bg-white font-medium text-foreground shadow-[var(--shadow-sm)]"
          : secondary
            ? "text-muted-soft hover:bg-white/70 hover:text-foreground"
            : "font-medium text-foreground hover:bg-white/70"
      }`}
    >
      {link.step != null ? (
        <span
          className={`flex h-5 shrink-0 items-center gap-1 rounded-[5px] px-1 text-[10px] font-semibold tabular-nums ${
            active
              ? "bg-accent-soft text-accent"
              : "bg-surface-soft text-muted"
          }`}
          aria-hidden
        >
          <span className="w-3 text-center">{link.step}</span>
          <Icon size={12} strokeWidth={2} className="shrink-0" />
        </span>
      ) : (
        <NavItemIcon icon={link.icon} active={active} primary={primary} />
      )}
      <span className="truncate">{t(link.key)}</span>
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const groups = useMemo(
    () =>
      visibleGroups(
        prefs.activeModule,
        costerraModeFromModule(prefs.activeModule),
      ),
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
      : prefs.activeModule === "batches_wholesale"
        ? t("moduleChooser.batchesWholesale.title")
        : prefs.activeModule === "batches"
          ? t("moduleChooser.batchesManufacturing.title")
          : t("moduleChooser.navHint");

  const projectsHref =
    prefs.activeModule != null ? MODULE_PROJECTS[prefs.activeModule] : "/";

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="px-4 pb-2 pt-4">
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3 pt-1">
        {groups.map((group) => {
          const open = isGroupOpen(group);
          const pinBottom = group.id === "konsolidiert";
          const primaryLinks = group.links.filter((l) => !l.secondary);
          const secondaryLinks = group.links.filter((l) => l.secondary);

          return (
            <div
              key={group.id}
              className={
                pinBottom
                  ? "mt-auto border-t border-line pt-2"
                  : "pb-2"
              }
            >
              {group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-white/50"
                  aria-expanded={open}
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t(group.labelKey)}
                  </span>
                  <GroupChevron open={open} />
                </button>
              ) : (
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  {t(group.labelKey)}
                </p>
              )}
              {open ? (
                <div className="flex flex-col gap-0.5">
                  {primaryLinks.map((link) => (
                    <NavLinkRow
                      key={`${link.href}:${link.key}`}
                      link={link}
                      pathname={pathname}
                    />
                  ))}
                  {group.cta ? (
                    <Link
                      href={group.cta.href}
                      className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-accent px-2.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    >
                      <Plus size={14} strokeWidth={2.25} aria-hidden />
                      {t(group.cta.key)}
                    </Link>
                  ) : null}
                  {secondaryLinks.length > 0 ? (
                    <div className="mt-1.5 space-y-0.5 border-t border-line/80 pt-1.5">
                      {secondaryLinks.map((link) => (
                        <NavLinkRow
                          key={`${link.href}:${link.key}`}
                          link={link}
                          pathname={pathname}
                        />
                      ))}
                    </div>
                  ) : null}
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
  const isCosterra = isCosterraAppModule(prefs.activeModule);
  const flatLinks = useMemo(() => {
    const groups = visibleGroups(
      prefs.activeModule,
      costerraModeFromModule(prefs.activeModule),
    );
    return groups.flatMap((g) => g.links).filter((l) => !l.secondary);
  }, [prefs.activeModule]);

  if (flatLinks.length === 0 && !isCosterra) return null;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
      {isCosterra ? (
        <Link
          href="/batches/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-accent px-3 py-1.5 text-[13px] font-medium text-white"
        >
          <Plus size={13} strokeWidth={2.25} aria-hidden />
          {t("nav.newBatch")}
        </Link>
      ) : null}
      {flatLinks.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={`${link.href}:${link.key}`}
            href={link.href}
            className={`shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] ${
              link.primary ? "font-medium" : ""
            } ${
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
