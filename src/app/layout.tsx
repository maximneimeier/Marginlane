import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { StoreProvider } from "@/context/StoreContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { AppNav, MobileNav } from "@/components/AppNav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marginlane",
  description:
    "Marginlane — Unit Economics und Landed Cost für Importeure und E-Commerce",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <PreferencesProvider>
          <StoreProvider>
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
          </StoreProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
