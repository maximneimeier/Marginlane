/** Costerra-Variante: Großhandel vs. Fertigung. */
export const COSTERRA_MODES = ["wholesale", "manufacturing"] as const;
export type CosterraMode = (typeof COSTERRA_MODES)[number];

/** Workspace-/App-Module für Costerra (getrennte Projektdatenbanken). */
export const COSTERRA_APP_MODULES = ["batches", "batches_wholesale"] as const;
export type CosterraAppModule = (typeof COSTERRA_APP_MODULES)[number];

export function isCosterraAppModule(
  value: string | null | undefined,
): value is CosterraAppModule {
  return value === "batches" || value === "batches_wholesale";
}

export function costerraModeFromModule(
  module: string | null | undefined,
): CosterraMode {
  return module === "batches_wholesale" ? "wholesale" : "manufacturing";
}

export function moduleFromCosterraMode(mode: CosterraMode): CosterraAppModule {
  return mode === "wholesale" ? "batches_wholesale" : "batches";
}

export function normalizeCosterraMode(value: unknown): CosterraMode {
  return value === "manufacturing" ? "manufacturing" : "wholesale";
}

export function isCosterraModule(
  prefs: { activeModule: string | null } | string | null,
): boolean {
  const module =
    prefs && typeof prefs === "object" && "activeModule" in prefs
      ? prefs.activeModule
      : prefs;
  return isCosterraAppModule(module);
}

export function isCosterraWholesale(prefs: {
  activeModule: string | null;
}): boolean {
  return prefs.activeModule === "batches_wholesale";
}

export function isCosterraManufacturing(prefs: {
  activeModule: string | null;
}): boolean {
  return prefs.activeModule === "batches";
}
