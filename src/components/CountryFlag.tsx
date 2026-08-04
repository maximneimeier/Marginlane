import type { ImgHTMLAttributes } from "react";

/** Flaggen-CDN (ISO 3166-1 alpha-2), ohne Emojis */
export function flagUrl(code: string, width = 40): string | null {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

type FlagProps = {
  code: string;
  title?: string;
  size?: "sm" | "md";
  className?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;

export function CountryFlag({
  code,
  title,
  size = "sm",
  className = "",
  ...props
}: FlagProps) {
  const url = flagUrl(code, size === "md" ? 80 : 40);
  const dim = size === "md" ? "h-4 w-6" : "h-3.5 w-[21px]";

  if (!url) {
    return (
      <span
        className={`inline-block rounded-[2px] bg-surface-soft ${dim} ${className}`}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={title || code}
      title={title || code}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(28,29,31,0.08)] ${dim} ${className}`}
      {...props}
    />
  );
}
