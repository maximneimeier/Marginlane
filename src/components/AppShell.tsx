"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider } from "@/context/StoreContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { AppNav, MobileNav } from "@/components/AppNav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChooser = pathname === "/";

  return (
    <PreferencesProvider>
      <StoreProvider>
        {isChooser ? (
          <div className="flex min-h-full flex-col">
            <header className="border-b border-line px-4 py-4 sm:px-8">
              <div className="mx-auto flex max-w-3xl items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-foreground text-[11px] font-semibold tracking-tight text-white">
                  ML
                </span>
                <p className="text-[13px] font-semibold tracking-tight text-foreground">
                  Marginlane
                </p>
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-8 sm:py-7">
              {children}
            </main>
          </div>
        ) : (
          <div className="flex min-h-full">
            <AppNav />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-line px-4 py-3 md:hidden">
                <p className="text-[13px] font-semibold tracking-tight">
                  Marginlane
                </p>
              </div>
              <MobileNav />
              <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-8 sm:py-7">
                {children}
              </main>
            </div>
          </div>
        )}
      </StoreProvider>
    </PreferencesProvider>
  );
}
