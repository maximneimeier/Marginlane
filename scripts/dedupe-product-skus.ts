/**
 * Entfernt doppelte Katalog-SKUs. Bevorzugt Demo-IDs (prd_demo_*).
 * Usage: npx tsx scripts/dedupe-product-skus.ts
 */
import "dotenv/config";
import {
  getWorkspaceData,
  saveWorkspaceData,
} from "../src/lib/db/workspace";
import type { CatalogProduct } from "../src/lib/types";

async function main() {
  const data = await getWorkspaceData();
  console.log("Products before:");
  for (const p of data.catalogProducts) {
    console.log(`  ${p.id} | ${p.sku} | ${p.name}`);
  }

  const seen = new Map<string, CatalogProduct>();
  const drop = new Set<string>();

  for (const p of data.catalogProducts) {
    const key = p.sku.trim().toLowerCase();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
      continue;
    }
    if (p.id.startsWith("prd_demo_") && !existing.id.startsWith("prd_demo_")) {
      drop.add(existing.id);
      seen.set(key, p);
    } else {
      drop.add(p.id);
    }
  }

  const nextProducts = data.catalogProducts.filter((p) => !drop.has(p.id));

  console.log("\nRemoving:", [...drop]);
  await saveWorkspaceData({
    ...data,
    catalogProducts: nextProducts,
    productComponents: (data.productComponents ?? []).filter(
      (pc) => !drop.has(pc.productId),
    ),
    batches: data.batches.filter((b) => !drop.has(b.productId)),
    salesPlan: (data.salesPlan ?? []).filter((c) => !drop.has(c.productId)),
    salesPlanRowMeta: (data.salesPlanRowMeta ?? []).filter(
      (m) => !drop.has(m.productId),
    ),
  });

  const after = await getWorkspaceData();
  console.log("\nProducts after:");
  for (const p of after.catalogProducts) {
    console.log(`  ${p.id} | ${p.sku} | ${p.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
