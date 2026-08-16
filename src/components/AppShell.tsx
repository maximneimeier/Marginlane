"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider } from "@/context/StoreContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { AtheniksTopNav } from "@/components/AtheniksTopNav";
import { AppNav, MobileNav } from "@/components/AppNav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChooser = pathname === "/";

  return (
    <PreferencesProvider>
      <StoreProvider>
        <div className="flex min-h-full flex-col bg-background">
          <AtheniksTopNav />
          {isChooser ? (
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
        </div>
      </StoreProvider>
    </PreferencesProvider>
  );
}
