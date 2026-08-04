/** @deprecated use CountryFlag component — kept for URL helpers */
export function flagUrl(code: string, width = 40): string | null {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}
