import { expect, it } from "vitest";
import { calculatePrice, type MatchedSample } from "../../lib/pricing/calculate";
import type { PriceSample } from "../../schemas/price.schema";
import { loadDemo } from "../demo";

const summaryFields = [
  "collectedAt",
  "currency",
  "demo",
  "id",
  "price",
  "regionId",
  "sampleType",
  "source",
  "verified",
];

function requireEstimate(result: ReturnType<typeof calculatePrice>) {
  expect(result.status).toBe("estimated");
  if (result.status !== "estimated") throw new Error("未返回报价");
  return result;
}

it("本地命中只返回该城市的脱敏样本摘要", async () => {
  const { quote } = await loadDemo();
  const result = requireEstimate(quote());
  expect(result.region).toMatchObject({ id: "beijing", name: "北京" });
  expect(result.matchedSamples).toEqual([
    {
      id: "demo-bj",
      price: 55,
      currency: "CNY",
      sampleType: "manual_reference",
      regionId: "beijing",
      source: "合成测试样本（demo）",
      collectedAt: "2026-11-01",
      verified: true,
      demo: true,
    },
  ] satisfies MatchedSample[]);
  expect(Object.keys(result.matchedSamples[0]!).sort()).toEqual(summaryFields);
  expect(result.range).toEqual({ min: 80, max: 120 });
  expect(result.typical).toBe(55);
});

it("地区回退时摘要使用实际命中地区，样本金额不改写区间", async () => {
  const { data, quote } = await loadDemo();
  const base = data.samples[0]!;
  data.samples = [
    { ...base, id: "gd-1", regionId: "guangdong", price: 48, sampleType: "provider_quote" },
    { ...base, id: "cn-1", regionId: "cn", price: 70, sampleType: "public_price" },
  ];
  const province = requireEstimate(quote({}, "guangzhou"));
  expect(province.region).toMatchObject({ id: "guangdong", name: "广东" });
  expect(province.assumptions).toEqual(["本地数据不足，使用广东参考数据"]);
  expect(province.matchedSamples).toEqual([
    expect.objectContaining({ id: "gd-1", regionId: "guangdong", price: 48, sampleType: "provider_quote" }),
  ]);
  expect(province.range).toEqual({ min: 80, max: 120 });
  expect(province.typical).toBe(48);

  data.samples = [data.samples[1]!];
  const national = requireEstimate(quote({}, "beijing"));
  expect(national.region).toMatchObject({ id: "cn", name: "全国" });
  expect(national.assumptions).toEqual(["本地数据不足，使用全国参考数据"]);
  expect(national.matchedSamples.map((sample) => sample.regionId)).toEqual(["cn"]);
  expect(national.range).toEqual({ min: 80, max: 120 });
});

it("没有合格样本时返回空摘要", async () => {
  const { service, data, answers, quote } = await loadDemo();
  expect(quote({}, "guangzhou")).toMatchObject({
    status: "insufficient_data",
    range: null,
    sampleCount: 0,
    sources: [],
    matchedSamples: [],
  });

  data.samples = [{ ...data.samples[0]!, verified: false }];
  expect(quote()).toMatchObject({ status: "insufficient_data", matchedSamples: [] });
  service.status = "draft";
  data.samples = [{ ...data.samples[0]!, verified: true }];
  expect(calculatePrice(service, answers, "beijing", data)).toMatchObject({
    status: "insufficient_data",
    matchedSamples: [],
  });
});

it("摘要按采集日期和 id 稳定排序，且不带隐私或条件字段", async () => {
  const { data, quote } = await loadDemo();
  const base = data.samples[0]!;
  const samples = [
    { ...base, id: "b", collectedAt: "2026-11-02", price: 20, sampleType: "provider_quote" as const },
    { ...base, id: "a", collectedAt: "2026-11-02", price: 10, sampleType: "public_price" as const },
    { ...base, id: "c", collectedAt: "2026-10-01", price: 30, sampleType: "actual_transaction" as const },
  ];
  const tainted = samples.map((sample, index) => ({
    ...sample,
    conditions: { quantity: 2 },
    phone: "13800000000",
    address: "某路1号",
    name: index === 0 ? "张三" : "李四",
  }));
  data.samples = tainted as PriceSample[];
  const forward = requireEstimate(quote());
  expect(forward.sources.map((source) => source.sampleId)).toEqual(["b", "a", "c"]);
  expect(forward.matchedSamples.map((sample) => sample.id)).toEqual(["c", "a", "b"]);
  expect(forward.typical).toBe(20);
  expect(forward.range).toEqual({ min: 80, max: 120 });
  const serialized = JSON.stringify(forward.matchedSamples);
  expect(serialized).not.toContain("13800000000");
  expect(serialized).not.toContain("某路1号");
  expect(serialized).not.toContain("张三");
  expect(serialized).not.toContain("conditions");
  for (const sample of forward.matchedSamples) expect(Object.keys(sample).sort()).toEqual(summaryFields);

  data.samples = [...tainted].reverse() as PriceSample[];
  const backward = requireEstimate(quote());
  expect(backward.matchedSamples).toEqual(forward.matchedSamples);
  expect(backward.sources.map((source) => source.sampleId)).toEqual(["c", "a", "b"]);
  expect(backward.range).toEqual(forward.range);
  expect(backward.typical).toBe(forward.typical);
});
