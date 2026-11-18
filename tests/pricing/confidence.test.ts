import { expect, it } from "vitest";
import { describeEvidence } from "../../lib/pricing/confidence";
import { loadDemo } from "../demo";

it("样本数、来源、地区和显式评估日期共同限制可信度", async () => {
  const { data } = await loadDemo();
  const samples = Array.from({ length: 15 }, (_, i) => ({
    ...data.samples[0],
    id: String(i),
    sampleType: "actual_transaction" as const,
    demo: false,
  }));
  const city = data.regions[0];
  const current = "2026-12-01";
  expect(describeEvidence(samples.slice(0, 4), city, 5, current).confidence).toBe("low");
  expect(describeEvidence(samples.slice(0, 5), city, 5, current).confidence).toBe("medium_high");
  expect(describeEvidence(samples, city, 5, current).confidence).toBe("high");
  expect(describeEvidence(samples, city, 5).confidence).toBe("medium_high");
  expect(
    describeEvidence(
      samples.map((s) => ({ ...s, sampleType: "public_price" })),
      city,
      5,
      current,
    ).confidence,
  ).toBe("medium");
  expect(describeEvidence(samples, { ...city, level: "city_tier" }, 5, current).confidence).toBe("low");
  expect(describeEvidence(samples, city, 5, "2028-01-01")).toMatchObject({
    confidence: "low",
    warnings: ["价格数据可能已经过时"],
  });
});
