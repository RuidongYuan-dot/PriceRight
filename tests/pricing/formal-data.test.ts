import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { calculatePrice, type PriceBreakdownItem } from "../../lib/pricing/calculate";
import { priceInfluenceFactors } from "../../lib/pricing/factors";
import { regionChoices } from "../../lib/region/choices";
import { regionCandidates } from "../../lib/region/resolve";
import { directoryGroup } from "../../lib/search/list-services";
import { searchServices } from "../../lib/search/services";
import type { Answer } from "../../schemas/common";

const asOf = "2026-11-20";

function replay(lines: PriceBreakdownItem[]) {
  return lines.reduce(
    (total, line) =>
      line.operation === "replace"
        ? { min: line.range.min, max: line.range.max }
        : { min: total.min + line.range.min, max: total.max + line.range.max },
    { min: 0, max: 0 },
  );
}

async function formal() {
  const catalog = await loadCatalog("data");
  const ceiling = catalog.services.find((service) => service.id === "ceiling-light-install");
  const curtain = catalog.services.find((service) => service.id === "curtain-install");
  if (!ceiling || !curtain) throw new Error("缺少正式服务");
  const regions = catalog.regions;
  const samples = catalog["price-samples"];
  const quote = (
    service: typeof ceiling,
    input: Record<string, unknown>,
    regionId: string,
    on = asOf,
  ) => calculatePrice(service, input, regionId, { regions, samples, asOf: on });
  return { catalog, ceiling, curtain, regions, samples, quote };
}

const ceilingInstall = {
  job: "install",
  "lamp-type": "ceiling",
  quantity: 1,
  "standard-height": true,
  "remove-old": false,
} satisfies Record<string, Answer>;

it("正式目录只加载已核验样本，地区选择器只列出五城和全国回退", async () => {
  const { catalog, samples } = await formal();
  expect(catalog.categories.map((category) => category.id)).toEqual([
    "appliance-cleaning",
    "home-cleaning",
    "home-installation",
    "moving-delivery",
    "plumbing",
  ]);
  expect(catalog.services.map((service) => service.id).sort()).toEqual([
    "ac-cleaning",
    "bathroom-fixture-install",
    "ceiling-light-install",
    "curtain-install",
    "faucet-valve-install",
    "furniture-assembly",
    "home-appliance-cleaning",
    "home-cleaning",
    "small-moving",
    "smart-lock-install",
    "switch-outlet-install",
  ]);
  expect(catalog.services.every((service) => service.demo === false && service.status === "active")).toBe(true);
  expect(samples).toHaveLength(417);
  expect(samples.filter((sample) => sample.serviceId === "ceiling-light-install" || sample.serviceId === "curtain-install")).toHaveLength(50);
  expect(samples.every((sample) => sample.demo === false && sample.verified && sample.currency === "CNY")).toBe(true);
  expect(samples.every((sample) => sample.collectedAt === "2026-11-20" && sample.source.includes("https://"))).toBe(true);
  expect(samples.some((sample) => /合成|demo|港币|HKD|1\.5/.test(sample.source))).toBe(false);
  const wave3 = new Set(["small-moving", "furniture-assembly", "home-cleaning", "home-appliance-cleaning"]);
  const earlier = samples.filter((sample) => !wave3.has(sample.serviceId));
  expect(earlier).toHaveLength(168);
  expect(new Set(earlier.map((sample) => sample.price))).not.toContain(55);
  expect(samples.filter((sample) => sample.price === 55).map((sample) => sample.id).sort()).toEqual([
    "hc-hk-hour-high",
    "sm-kg-start-shenzhen-mid-bread",
  ]);
  expect(regionChoices(catalog.regions)).toEqual([
    { id: "beijing", label: "北京", fallback: false },
    { id: "shanghai", label: "上海", fallback: false },
    { id: "guangzhou", label: "广州", fallback: false },
    { id: "shenzhen", label: "深圳", fallback: false },
    { id: "hangzhou", label: "杭州", fallback: false },
    { id: "cn", label: "我的城市不在列表中（全国参考）", fallback: true },
  ]);
  expect(regionCandidates("beijing", catalog.regions).map((region) => region.id)).toEqual([
    "beijing",
    "beijing-municipality",
    "tier-1",
    "cn",
  ]);
  expect(regionCandidates("hangzhou", catalog.regions).map((region) => region.id)).toEqual([
    "hangzhou",
    "zhejiang",
    "new-tier-1",
    "cn",
  ]);
  expect(() => priceInfluenceFactors(catalog.services[0]!, catalog.regions)).not.toThrow();
});

it("吸顶灯：上海命中本地公示价，北广深杭回退宜家全国价", async () => {
  const { ceiling, quote } = await formal();
  const shanghai = quote(ceiling, ceilingInstall, "shanghai");
  expect(shanghai).toMatchObject({
    status: "estimated",
    demo: false,
    currency: "CNY",
    region: { id: "shanghai" },
    range: { min: 50, max: 60 },
    typical: 50,
    sampleCount: 6,
    confidence: "medium",
    assumptions: ["使用上海数据"],
    warnings: [],
  });
  expect(shanghai.status === "estimated" && replay(shanghai.breakdown)).toEqual({ min: 50, max: 60 });
  expect(shanghai.status === "estimated" && shanghai.breakdown.some((line) => line.label === "基础价格")).toBe(false);

  for (const city of ["beijing", "guangzhou", "shenzhen", "hangzhou"]) {
    const result = quote(ceiling, ceilingInstall, city);
    expect(result).toMatchObject({
      status: "estimated",
      region: { id: "cn" },
      range: { min: 79, max: 79 },
      typical: 79,
      sampleCount: 1,
      confidence: "low",
      assumptions: ["本地数据不足，使用全国参考数据"],
      warnings: ["数据样本有限，结果仅供粗略参考"],
    });
  }
  expect(quote(ceiling, ceilingInstall, "cn")).toMatchObject({
    region: { id: "cn" },
    range: { min: 79, max: 79 },
    assumptions: ["使用全国数据"],
  });
  expect(quote(ceiling, { ...ceilingInstall, "remove-old": true }, "beijing")).toMatchObject({
    range: { min: 79, max: 79 },
  });
  expect(quote(ceiling, { ...ceilingInstall, quantity: 5 }, "hangzhou")).toMatchObject({
    range: { min: 279, max: 279 },
    typical: 279,
  });
  expect(quote(ceiling, { ...ceilingInstall, quantity: 6 }, "beijing").status).toBe("insufficient_data");
  expect(quote(ceiling, { ...ceilingInstall, quantity: 5 }, "shanghai")).toMatchObject({
    range: { min: 250, max: 300 },
    region: { id: "shanghai" },
  });
  expect(quote(ceiling, { ...ceilingInstall, quantity: 6 }, "shanghai")).toMatchObject({
    range: { min: 240, max: 360 },
    typical: 40,
    sampleCount: 6,
  });
  expect(quote(ceiling, { ...ceilingInstall, "standard-height": false }, "beijing").status).toBe("insufficient_data");
  expect(quote(ceiling, { ...ceilingInstall, "standard-height": false }, "shanghai")).toMatchObject({
    range: { min: 50, max: 60 },
    region: { id: "shanghai" },
  });
  expect(quote(ceiling, ceilingInstall, "shanghai", "2026-11-19").status).toBe("insufficient_data");
  expect(quote(ceiling, ceilingInstall, "shanghai")).toEqual(quote(ceiling, ceilingInstall, "shanghai"));
});

it("上海吸顶灯数量分档命中对应应急维修样本", async () => {
  const { ceiling, quote } = await formal();
  const within = [
    "ceiling-sh-hp-luwan-50",
    "ceiling-sh-hp-south-50",
    "ceiling-sh-minhang-50",
    "ceiling-sh-pudong-50",
  ];
  const above = [
    "ceiling-sh-hp-luwan-40",
    "ceiling-sh-hp-south-40",
    "ceiling-sh-minhang-40",
    "ceiling-sh-pudong-40",
  ];
  const shared = ["ceiling-sh962121-2026", "ceiling-shxh-ceiling"];
  const cases = [
    { quantity: 1, tier: within, other: above, typical: 50, range: { min: 50, max: 60 } },
    { quantity: 5, tier: within, other: above, typical: 50, range: { min: 250, max: 300 } },
    { quantity: 6, tier: above, other: within, typical: 40, range: { min: 240, max: 360 } },
    { quantity: 8, tier: above, other: within, typical: 40, range: { min: 320, max: 480 } },
    { quantity: 10, tier: above, other: within, typical: 40, range: { min: 400, max: 600 } },
  ];
  for (const item of cases) {
    const result = quote(ceiling, { ...ceilingInstall, quantity: item.quantity }, "shanghai");
    expect(result.status, String(item.quantity)).toBe("estimated");
    if (result.status !== "estimated") throw new Error("未返回报价");
    const ids = result.matchedSamples.map((sample) => sample.id);
    expect(ids, String(item.quantity)).toEqual([...item.tier, ...shared]);
    expect(ids.some((id) => item.other.includes(id)), String(item.quantity)).toBe(false);
    expect(result.sampleCount, String(item.quantity)).toBe(6);
    expect(result.typical, String(item.quantity)).toBe(item.typical);
    expect(result.range, String(item.quantity)).toEqual(item.range);
    const tierPrices = new Set(item.tier.map((id) => result.matchedSamples.find((sample) => sample.id === id)?.price));
    expect(tierPrices, String(item.quantity)).toEqual(new Set([item.quantity <= 5 ? 50 : 40]));
  }
});

it("吊灯、其他灯具和附加费只使用对应来源，不把互斥价目相加", async () => {
  const { ceiling, quote } = await formal();
  const pendant = {
    job: "install",
    "lamp-type": "pendant",
    quantity: 1,
    "standard-height": true,
    premium: false,
    "remove-old": false,
  };
  expect(quote(ceiling, pendant, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 180, max: 180 },
    typical: 180,
  });
  expect(quote(ceiling, pendant, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 79, max: 79 },
    typical: 79,
  });
  expect(quote(ceiling, { ...pendant, premium: true }, "shanghai").status).toBe("insufficient_data");
  expect(quote(ceiling, { ...ceilingInstall, "lamp-type": "decorative" }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 80, max: 80 },
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(quote(ceiling, { ...ceilingInstall, "lamp-type": "fan", quantity: 2 }, "shenzhen")).toMatchObject({
    range: { min: 160, max: 160 },
  });
  expect(quote(ceiling, { ...ceilingInstall, "lamp-type": "smart" }, "guangzhou")).toMatchObject({
    range: { min: 80, max: 80 },
    region: { id: "cn" },
  });
  expect(quote(ceiling, { ...ceilingInstall, "lamp-type": "removal" }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 20, max: 20 },
  });
  expect(quote(ceiling, { ...ceilingInstall, "lamp-type": "removal" }, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 15, max: 15 },
  });
  expect(quote(ceiling, { job: "detail", "detail-item": "unit" }, "hangzhou")).toMatchObject({
    range: { min: 50, max: 50 },
    typical: 50,
  });
  expect(quote(ceiling, { job: "detail", "detail-item": "fee" }, "cn")).toMatchObject({ range: { min: 29, max: 29 } });
  expect(quote(ceiling, { job: "extra", "extra-item": "high", "extra-meters": 2 }, "beijing")).toMatchObject({
    range: { min: 100, max: 100 },
    typical: 50,
  });
  expect(quote(ceiling, { job: "extra", "extra-item": "remote", kilometers: 10 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 20, max: 20 },
    typical: 2,
    sampleCount: 2,
  });
  expect(quote(ceiling, { job: "extra", "extra-item": "cap" }, "beijing")).toMatchObject({ range: { min: 300, max: 300 } });
  expect(quote(ceiling, { job: "extra", "extra-item": "drill", holes: 3 }, "beijing")).toMatchObject({
    range: { min: 15, max: 15 },
  });
  expect(quote(ceiling, { job: "extra", "extra-item": "minimum" }, "beijing")).toMatchObject({ range: { min: 50, max: 50 } });
  expect(quote(ceiling, { job: "extra", "extra-item": "dry-opple" }, "beijing")).toMatchObject({ range: { min: 30, max: 30 } });
  expect(quote(ceiling, { job: "extra", "extra-item": "dry-aqara" }, "beijing")).toMatchObject({ range: { min: 50, max: 50 } });
  expect(
    quote(ceiling, { job: "extra", "extra-item": "over-height", "projection-area": 2 }, "shanghai"),
  ).toMatchObject({ region: { id: "shanghai" }, range: { min: 144, max: 144 } });
  expect(quote(ceiling, { job: "extra", "extra-item": "over-height", "projection-area": 2 }, "beijing").status).toBe(
    "insufficient_data",
  );
  expect(quote(ceiling, {}, "beijing").status).toBe("invalid_input");
  expect(quote(ceiling, ceilingInstall, "unknown").status).toBe("invalid_input");
});

it("正式服务的搜索关键词能单独命中，不靠写死分类名", async () => {
  const { catalog } = await formal();
  const group = directoryGroup(catalog, false);
  const ids = (keyword: string) =>
    searchServices(group.services, group.categories, { keyword }).map((hit) => hit.service.id);
  expect(ids("装灯")).toEqual(["ceiling-light-install"]);
  expect(ids("吊灯")).toEqual(["ceiling-light-install"]);
  expect(ids("窗帘杆")).toEqual(["curtain-install"]);
  expect(ids("电动窗帘")).toEqual(["curtain-install"]);
});

it("窗帘：上海杆轨命中本地价，其他城市回退全国品牌价或数据不足", async () => {
  const { curtain, quote } = await formal();
  const rail = { job: "counted", item: "rail", quantity: 1 };
  expect(quote(curtain, rail, "shanghai")).toMatchObject({
    status: "estimated",
    demo: false,
    region: { id: "shanghai" },
    range: { min: 100, max: 100 },
    typical: 100,
    assumptions: ["使用上海数据"],
  });
  expect(quote(curtain, { ...rail, quantity: 2 }, "shanghai")).toMatchObject({ range: { min: 200, max: 200 } });
  for (const city of ["beijing", "guangzhou", "shenzhen", "hangzhou"]) {
    expect(quote(curtain, rail, city).status).toBe("insufficient_data");
  }
  expect(quote(curtain, { job: "counted", item: "smart-bull", quantity: 1 }, "hangzhou")).toMatchObject({
    region: { id: "cn" },
    range: { min: 100, max: 100 },
    typical: 100,
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(quote(curtain, { job: "counted", item: "smart-aqara", quantity: 2 }, "beijing")).toMatchObject({
    range: { min: 260, max: 260 },
    typical: 130,
  });
  expect(quote(curtain, { job: "counted", item: "measure-window", quantity: 3 }, "guangzhou")).toMatchObject({
    range: { min: 150, max: 150 },
  });
  expect(quote(curtain, { job: "counted", item: "measure-rod", quantity: 1 }, "shenzhen")).toMatchObject({
    range: { min: 80, max: 80 },
  });
  expect(quote(curtain, { job: "counted", item: "alter", quantity: 2 }, "beijing")).toMatchObject({
    range: { min: 78, max: 78 },
  });
  expect(quote(curtain, { job: "fixed", visit: "measure-order" }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 80, max: 80 },
  });
  expect(quote(curtain, { job: "fixed", visit: "mi-first" }, "beijing")).toMatchObject({
    range: { min: 0, max: 0 },
    typical: 0,
  });
  expect(quote(curtain, { job: "fixed", visit: "dry-run" }, "beijing")).toMatchObject({ range: { min: 50, max: 50 } });
  expect(quote(curtain, { job: "pack", "pack-count": 2 }, "hangzhou")).toMatchObject({ range: { min: 138, max: 138 } });
  expect(quote(curtain, { job: "pack", "pack-count": 3 }, "hangzhou").status).toBe("invalid_input");
  expect(quote(curtain, { job: "distance", kilometers: 10 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 20, max: 20 },
    typical: 2,
  });
  expect(quote(curtain, { job: "cap" }, "beijing")).toMatchObject({ range: { min: 300, max: 300 } });
  expect(quote(curtain, { job: "high", "extra-meters": 1 }, "shenzhen")).toMatchObject({ range: { min: 50, max: 50 } });
});
