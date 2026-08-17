import type { MarginPackageReport } from "./marginPackage";
import { sanitizeFilenamePart } from "./marginPackage";

export type MarginPackageLabels = {
  title: string;
  company: string;
  generatedAt: string;
  currency: string;
  batch: string;
  product: string;
  sku: string;
  quantity: string;
  unit: string;
  supplier: string;
  country: string;
  dealers: string;
  quote: string;
  purchase: string;
  landed: string;
  sell: string;
  revenue: string;
  material: string;
  logistics: string;
  marketing: string;
  salesCosts: string;
  db1: string;
  db2: string;
  db3: string;
  perUnit: string;
  total: string;
  marginPercent: string;
  overhead: string;
  afterOverhead: string;
  partners: string;
  sales: string;
  channel: string;
  waterfall: string;
  overview: string;
  portfolio: string;
  none: string;
};

function stampDate(iso = new Date().toISOString()): string {
  return iso.slice(0, 10);
}

function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function overviewKv(
  report: MarginPackageReport,
  labels: MarginPackageLabels,
): Array<[string, string | number]> {
  const rows: Array<[string, string | number]> = [
    [labels.company, report.companyName],
    [labels.generatedAt, report.generatedAt],
    [labels.currency, report.currency],
    [labels.batch, report.batchLabel],
    [labels.product, report.productName],
    [labels.sku, report.productSku || labels.none],
    [labels.quantity, report.quantity],
    [labels.unit, report.pricingUnit],
    [labels.supplier, report.supplierName || labels.none],
    [labels.country, report.supplierCountry || labels.none],
    [
      labels.dealers,
      report.dealerNames.length > 0
        ? report.dealerNames.join(", ")
        : labels.none,
    ],
    [labels.quote, report.activeQuoteLabel || labels.none],
    [`${labels.purchase} (${labels.perUnit})`, report.purchasePerUnit],
    [`${labels.landed} (${labels.perUnit})`, report.landedCostPerUnit],
    [`${labels.sell} (${labels.perUnit})`, report.sellPricePerUnit],
    [`${labels.revenue} (${labels.total})`, report.revenue],
    [`${labels.material} (${labels.total})`, report.material],
    [`${labels.logistics} (${labels.total})`, report.logistics],
    [`${labels.marketing} (${labels.total})`, report.marketing],
    [`${labels.salesCosts} (${labels.total})`, report.sales],
    [`${labels.db1} (${labels.total})`, report.db1],
    [`${labels.db1} (${labels.perUnit})`, report.db1PerUnit],
    [`${labels.db2} (${labels.total})`, report.db2],
    [`${labels.db2} (${labels.perUnit})`, report.db2PerUnit],
    [`${labels.db3} (${labels.total})`, report.db3],
    [`${labels.db3} (${labels.perUnit})`, report.db3PerUnit],
    [labels.marginPercent, report.marginPercent],
    [`${labels.overhead} (${labels.total})`, report.overheadShare],
  ];
  if (report.afterOverhead != null) {
    rows.push(
      [`${labels.afterOverhead} (${labels.total})`, report.afterOverhead],
      [
        `${labels.afterOverhead} (${labels.perUnit})`,
        report.afterOverheadPerUnit ?? 0,
      ],
    );
  } else {
    rows.push([labels.afterOverhead, labels.none]);
  }
  return rows;
}

function waterfallRows(
  report: MarginPackageReport,
  labels: MarginPackageLabels,
): Array<[string, number, number]> {
  const qty = report.quantity;
  const pu = (n: number) => (qty > 0 ? round2(n / qty) : 0);
  const rows: Array<[string, number, number]> = [
    [labels.revenue, report.revenue, pu(report.revenue)],
    [`− ${labels.material}`, -report.material, -pu(report.material)],
    [labels.db1, report.db1, report.db1PerUnit],
    [`− ${labels.logistics}`, -report.logistics, -pu(report.logistics)],
    [labels.db2, report.db2, report.db2PerUnit],
    [`− ${labels.marketing}`, -report.marketing, -pu(report.marketing)],
    [`− ${labels.salesCosts}`, -report.sales, -pu(report.sales)],
    [labels.db3, report.db3, report.db3PerUnit],
  ];
  if (report.afterOverhead != null) {
    rows.push(
      [
        `− ${labels.overhead}`,
        -report.overheadShare,
        -pu(report.overheadShare),
      ],
      [
        labels.afterOverhead,
        report.afterOverhead,
        report.afterOverheadPerUnit ?? 0,
      ],
    );
  }
  return rows;
}

export async function downloadMarginPackageExcel(
  reports: MarginPackageReport[],
  labels: MarginPackageLabels,
  filenameHint?: string,
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  if (reports.length === 1) {
    const report = reports[0]!;
    const overviewAoA: Array<Array<string | number>> = [
      ["Feld", "Wert"],
      ...overviewKv(report, labels),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(overviewAoA),
      labels.overview.slice(0, 31),
    );

    const salesAoA: Array<Array<string | number>> = [
      [
        "#",
        labels.dealers,
        labels.channel,
        labels.quantity,
        labels.sell,
        labels.revenue,
        labels.marketing,
        labels.salesCosts,
      ],
      ...report.salesLines.map((line) => [
        line.index,
        line.dealerName || labels.none,
        line.channel || labels.none,
        line.quantity,
        line.sellPricePerUnit,
        line.revenue,
        line.marketing,
        line.sales,
      ]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(salesAoA),
      labels.sales.slice(0, 31),
    );

    const wfAoA: Array<Array<string | number>> = [
      [labels.waterfall, labels.total, labels.perUnit],
      ...waterfallRows(report, labels),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(wfAoA),
      labels.waterfall.slice(0, 31),
    );
  } else {
    const portfolioAoA: Array<Array<string | number>> = [
      [
        labels.batch,
        labels.product,
        labels.supplier,
        labels.dealers,
        labels.quantity,
        labels.revenue,
        labels.db1,
        labels.db2,
        labels.db3,
        labels.marginPercent,
        labels.overhead,
        labels.afterOverhead,
        labels.marketing,
        labels.salesCosts,
        labels.currency,
      ],
      ...reports.map((report) => [
        report.batchLabel,
        report.productName,
        report.supplierName || labels.none,
        report.dealerNames.length > 0
          ? report.dealerNames.join(", ")
          : labels.none,
        report.quantity,
        report.revenue,
        report.db1,
        report.db2,
        report.db3,
        report.marginPercent,
        report.overheadShare,
        report.afterOverhead ?? labels.none,
        report.marketing,
        report.sales,
        report.currency,
      ]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(portfolioAoA),
      labels.portfolio.slice(0, 31),
    );

    const salesAoA: Array<Array<string | number>> = [
      [
        labels.batch,
        "#",
        labels.dealers,
        labels.channel,
        labels.quantity,
        labels.sell,
        labels.revenue,
        labels.marketing,
        labels.salesCosts,
      ],
    ];
    for (const report of reports) {
      for (const line of report.salesLines) {
        salesAoA.push([
          report.batchLabel,
          line.index,
          line.dealerName || labels.none,
          line.channel || labels.none,
          line.quantity,
          line.sellPricePerUnit,
          line.revenue,
          line.marketing,
          line.sales,
        ]);
      }
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(salesAoA),
      labels.partners.slice(0, 31),
    );
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const base =
    filenameHint ??
    (reports.length === 1
      ? `costerra_margenpaket_${sanitizeFilenamePart(reports[0]!.batchLabel)}`
      : `costerra_margenpaket_portfolio`);
  downloadBlob(`${base}_${stampDate()}.xlsx`, blob);
}

export async function downloadMarginPackagePdf(
  reports: MarginPackageReport[],
  labels: MarginPackageLabels,
  filenameHint?: string,
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text(labels.title, margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(
    `${labels.generatedAt}: ${new Date().toLocaleString()}`,
    margin,
    y,
  );
  y += 18;
  doc.setTextColor(0);

  if (reports.length === 1) {
    const report = reports[0]!;
    doc.setFontSize(12);
    doc.text(report.batchLabel, margin, y);

    autoTable(doc, {
      startY: y + 10,
      head: [[labels.overview, ""]],
      body: overviewKv(report, labels).map(([k, v]) => [k, String(v)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: 280 } },
      margin: { left: margin, right: margin },
    });

    const afterOverview = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;

    autoTable(doc, {
      startY: afterOverview + 16,
      head: [
        [
          "#",
          labels.dealers,
          labels.channel,
          labels.quantity,
          labels.sell,
          labels.marketing,
          labels.salesCosts,
        ],
      ],
      body: report.salesLines.map((line) => [
        String(line.index),
        line.dealerName || labels.none,
        line.channel || labels.none,
        String(line.quantity),
        String(line.sellPricePerUnit),
        String(line.marketing),
        String(line.sales),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] },
      margin: { left: margin, right: margin },
    });

    const afterSales = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;

    autoTable(doc, {
      startY: afterSales + 16,
      head: [[labels.waterfall, labels.total, labels.perUnit]],
      body: waterfallRows(report, labels).map(([a, b, c]) => [
        a,
        String(b),
        String(c),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 30, 30] },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setFontSize(12);
    doc.text(labels.portfolio, margin, y);
    autoTable(doc, {
      startY: y + 10,
      head: [
        [
          labels.batch,
          labels.supplier,
          labels.revenue,
          labels.db1,
          labels.db2,
          labels.db3,
          labels.marginPercent,
          labels.afterOverhead,
        ],
      ],
      body: reports.map((r) => [
        r.batchLabel,
        r.supplierName || labels.none,
        String(r.revenue),
        String(r.db1),
        String(r.db2),
        String(r.db3),
        String(r.marginPercent),
        r.afterOverhead != null ? String(r.afterOverhead) : labels.none,
      ]),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] },
      margin: { left: margin, right: margin },
    });
  }

  const base =
    filenameHint ??
    (reports.length === 1
      ? `costerra_margenpaket_${sanitizeFilenamePart(reports[0]!.batchLabel)}`
      : `costerra_margenpaket_portfolio`);
  doc.save(`${base}_${stampDate()}.pdf`);
}
