/**
 * `/` is redirected to `/overview` via `next.config.ts`.
 * Avoid `redirect()` here — in Next.js 16 + Turbopack it can race the
 * client router during HMR ("Router action dispatched before initialization").
 */
export default function HomePage() {
  return null;
}
