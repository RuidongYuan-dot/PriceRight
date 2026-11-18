import type { PriceSample } from "../../schemas/price.schema";
import type { Region } from "../../schemas/region.schema";

const sourceLevels = {
  actual_transaction: "A",
  provider_quote: "B",
  public_price: "C",
  manual_reference: "D",
} as const;

export function describeEvidence(samples: PriceSample[], region: Region, minimum: number, asOf?: string) {
  const sources = samples.map((s) => ({
    sampleId: s.id,
    source: s.source,
    level: sourceLevels[s.sampleType],
    collectedAt: s.collectedAt,
  }));
  const dataUpdatedAt = samples.reduce((date, s) => (s.collectedAt > date ? s.collectedAt : date), "");
  const warnings: string[] = [];
  const year = 365 * 86400000;
  const recent = asOf ? samples.filter((s) => Date.parse(asOf) - Date.parse(s.collectedAt) <= year) : [];
  const stale = Boolean(asOf && !recent.length);
  if (stale) warnings.push("价格数据可能已经过时");
  const limited = samples.length < minimum;
  if (limited) warnings.push("数据样本有限，结果仅供粗略参考");
  const demo = samples.some((s) => s.demo);
  if (demo) warnings.push("demo 测试数据，仅用于验证计算");
  let confidence: "high" | "medium_high" | "medium" | "low" = "low";
  if (!demo && !limited && !stale && region.level !== "city_tier" && region.level !== "national") {
    confidence = "medium";
    const reliable = samples.filter((s) => ["actual_transaction", "provider_quote"].includes(s.sampleType));
    if (region.level === "city" && reliable.length >= minimum) confidence = "medium_high";
    if (
      confidence === "medium_high" &&
      recent.length >= 3 * minimum &&
      recent.some((s) => s.sampleType === "actual_transaction")
    )
      confidence = "high";
  }
  return { sources, dataUpdatedAt, sampleCount: samples.length, confidence, warnings };
}
