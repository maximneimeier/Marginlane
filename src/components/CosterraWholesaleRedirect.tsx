"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrefs } from "@/context/PreferencesContext";
import { isCosterraWholesale } from "@/lib/costerraMode";

/** Leitet Großhandel-Nutzer von Fertigungs-/BOM-Seiten weg. */
export function CosterraWholesaleRedirect({
  to = "/batches",
}: {
  to?: string;
}) {
  const router = useRouter();
  const { ready, prefs } = usePrefs();

  useEffect(() => {
    if (!ready) return;
    if (isCosterraWholesale(prefs)) {
      router.replace(to);
    }
  }, [ready, prefs, router, to]);

  if (!ready || isCosterraWholesale(prefs)) {
    return (
      <p className="px-4 py-8 text-sm text-muted">…</p>
    );
  }

  return null;
}
