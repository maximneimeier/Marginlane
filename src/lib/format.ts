export function createId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function formatEuro(value: number, locale = "de-DE"): string {
  return formatMoney(value, "EUR", locale);
}

export function formatMoney(
  value: number,
  currency = "EUR",
  locale = "de-DE",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "EUR",
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(value);
  }
}

/** Restmenge einer Charge nach Multi-Sale */
export function batchRemainingQuantity(quantity: number, soldQuantity: number): number {
  return Math.max(quantity - Math.max(soldQuantity, 0), 0);
}

export function formatPercent(value: number, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatNumber(value: number, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(iso: string | null | undefined, locale = "de-DE"): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}
