"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { StoreProvider } from "@/context/StoreContext";
import {
  MODULE_PROJECTS,
  PreferencesProvider,
  usePrefs,
} from "@/context/PreferencesContext";
import { AtheniksTopNav } from "@/components/AtheniksTopNav";
import { AppNav, MobileNav } from "@/components/AppNav";

function isShellChromePath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/projects");
}

function ProjectGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, prefs } = usePrefs();
  const chromeOnly = isShellChromePath(pathname);

  useEffect(() => {
    if (!ready || chromeOnly) return;
    if (!prefs.activeProjectId) {
      const target = prefs.activeModule
        ? MODULE_PROJECTS[prefs.activeModule]
        : "/";
      router.replace(target);
    }
  }, [
    ready,
    chromeOnly,
    prefs.activeProjectId,
    prefs.activeModule,
    router,
  ]);

  if (!chromeOnly && ready && !prefs.activeProjectId) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">
        <p className="text-[13px] text-muted">…</p>
      </main>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chromeOnly = isShellChromePath(pathname);

  return (
    <PreferencesProvider>
      <StoreProvider>
        <div className="flex min-h-full flex-col bg-background">
          <AtheniksTopNav />
          <ProjectGate>
            {chromeOnly ? (
              <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 sm:px-8">
                {children}
              </main>
            ) : (
              <div className="flex min-h-0 flex-1">
                <AppNav />
                <div className="flex min-w-0 flex-1 flex-col">
                  <MobileNav />
                  <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-8 sm:py-7">
                    {children}
                  </main>
                </div>
              </div>
            )}
          </ProjectGate>
        </div>
      </StoreProvider>
    </PreferencesProvider>
  );
}
