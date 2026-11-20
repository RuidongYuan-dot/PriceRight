import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { calculatePrice } from "../../lib/pricing/calculate";
import { loadDemo } from "../demo";

it("显式 asOf 改变过时警告和可信度，相同输入保持稳定", async () => {
  for (const file of ["lib/pricing/calculate.ts", "lib/pricing/confidence.ts"]) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("shanghaiCalendarDate");
  }
  const { service, answers, data } = await loadDemo();
  const current = { ...data, asOf: "2026-11-20" };
  const now = Date.now;
  Date.now = () => {
    throw new Error("Date.now");
  };
  try {
    const first = calculatePrice(service, answers, "beijing", current);
    expect(first).toEqual(calculatePrice(service, answers, "beijing", current));
    expect(first).toMatchObject({ status: "estimated", confidence: "low", typical: 55, range: { min: 80, max: 120 } });
    if (first.status === "estimated") expect(first.warnings).not.toContain("价格数据可能已经过时");
  } finally {
    Date.now = now;
  }

  const priced = structuredClone(service);
  priced.demo = false;
  priced.pricing.minimumSampleCount = 5;
  const samples = Array.from({ length: 15 }, (_, index) => ({
    ...data.samples[0]!,
    id: `fresh-${index}`,
    demo: false,
    sampleType: "actual_transaction" as const,
    price: 40 + index,
    collectedAt: "2026-11-01",
  }));
  const base = { regions: data.regions, samples };
  expect(calculatePrice(priced, answers, "beijing", base)).toMatchObject({ confidence: "medium_high", typical: 47 });
  const recent = calculatePrice(priced, answers, "beijing", { ...base, asOf: "2026-12-01" });
  const stale = calculatePrice(priced, answers, "beijing", { ...base, asOf: "2028-01-01" });
  expect(recent).toMatchObject({ status: "estimated", confidence: "high", typical: 47, sampleCount: 15 });
  expect(stale).toMatchObject({ status: "estimated", confidence: "low", typical: 47, sampleCount: 15 });
  if (recent.status === "estimated") expect(recent.warnings).not.toContain("价格数据可能已经过时");
  if (stale.status === "estimated") expect(stale.warnings).toContain("价格数据可能已经过时");
  expect(recent).toEqual(calculatePrice(priced, answers, "beijing", { ...base, asOf: "2026-12-01" }));

  const early = calculatePrice(priced, answers, "beijing", { ...base, asOf: "2026-01-01" });
  expect(early).toMatchObject({ status: "insufficient_data", sampleCount: 0, range: null });
  expect(early).not.toHaveProperty("typical");

  const mixed = [
    { ...samples[0]!, id: "low", price: 10, collectedAt: "2026-01-01" },
    { ...samples[0]!, id: "high", price: 30, collectedAt: "2026-06-01" },
  ];
  expect(calculatePrice(priced, answers, "beijing", { regions: data.regions, samples: mixed, asOf: "2026-03-01" })).toMatchObject({
    typical: 10,
    sampleCount: 1,
  });
  expect(
    calculatePrice(priced, answers, "beijing", {
      regions: data.regions,
      samples: [
        { ...samples[0]!, id: "a", price: 10 },
        { ...samples[0]!, id: "b", price: 11 },
      ],
      asOf: "2026-12-01",
    }),
  ).toMatchObject({ typical: 11, sampleCount: 2 });
});
