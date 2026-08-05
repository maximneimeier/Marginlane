import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/lieferanten", destination: "/suppliers", permanent: true },
      { source: "/produkte", destination: "/products", permanent: true },
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
      { source: "/", destination: "/overview", permanent: false },
    ];
  },
};

export default nextConfig;
