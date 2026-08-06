import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  async redirects() {
    return [
      { source: "/lieferanten", destination: "/suppliers", permanent: true },
      { source: "/produkte", destination: "/products", permanent: true },
      { source: "/komponenten", destination: "/components", permanent: true },
      { source: "/haendler", destination: "/dealers", permanent: true },
      { source: "/einstellungen", destination: "/settings", permanent: true },
      { source: "/chargen", destination: "/batches", permanent: true },
      { source: "/chargen/neu", destination: "/batches/new", permanent: true },
      {
        source: "/chargen/:id",
        destination: "/batches/:id",
        permanent: true,
      },
      { source: "/vergleich", destination: "/compare", permanent: true },
      { source: "/gemeinkosten", destination: "/overhead", permanent: true },
      { source: "/", destination: "/overview", permanent: false },
    ];
  },
};

export default nextConfig;
