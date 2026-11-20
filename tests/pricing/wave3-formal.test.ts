import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { calculatePrice, type PriceBreakdownItem } from "../../lib/pricing/calculate";
import { priceInfluenceFactors } from "../../lib/pricing/factors";
import { directoryGroup } from "../../lib/search/list-services";
import { searchServices } from "../../lib/search/services";
import type { Service } from "../../schemas/service.schema";

const asOf = "2026-11-20";
const cities = ["beijing", "shanghai", "guangzhou", "shenzhen", "hangzhou"] as const;
const wave = ["small-moving", "furniture-assembly", "home-cleaning", "home-appliance-cleaning"] as const;

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
  const service = (id: string) => {
    const found = catalog.services.find((item) => item.id === id);
    if (!found) throw new Error("缺少 " + id);
    return found;
  };
  const regions = catalog.regions;
  const samples = catalog["price-samples"];
  const quote = (item: Service, input: Record<string, unknown>, regionId: string, on = asOf) =>
    calculatePrice(item, input, regionId, { regions, samples, asOf: on });
  return { catalog, samples, quote, service };
}

it("第三批样本按来源城市入库，小数单价没有被取整", async () => {
  const { catalog, samples, service } = await formal();
  for (const id of wave) {
    const item = service(id);
    expect(item.demo).toBe(false);
    expect(item.status).toBe("active");
    expect(item.keywords?.length).toBeGreaterThan(8);
    expect(() => priceInfluenceFactors(item, catalog.regions)).not.toThrow();
  }
  const owned = samples.filter((sample) => wave.includes(sample.serviceId as (typeof wave)[number]));
  expect(owned).toHaveLength(249);
  expect(owned.every((sample) => sample.verified && sample.demo === false && sample.currency === "CNY")).toBe(true);
  expect(owned.every((sample) => sample.collectedAt === asOf && sample.source.includes("https://"))).toBe(true);
  expect(owned.every((sample) => Number.isInteger(sample.price) && sample.price >= 0)).toBe(true);
  expect(owned.some((sample) => /2\.85|4\.5|0\.5/.test(String(sample.price)))).toBe(false);
  expect(owned.some((sample) => sample.id === "sm-kg-km-beijing-micro" || sample.id === "sm-kg-km-shanghai-iveco")).toBe(
    false,
  );
  expect(service("small-moving").scope.excluded.join("\n")).toMatch(/2\.85/);
  expect(service("small-moving").scope.excluded.join("\n")).toMatch(/4\.5/);
  expect(service("small-moving").scope.excluded.join("\n")).toMatch(/0\.5/);
  expect(service("small-moving").scope.excluded.join("\n")).toMatch(/没有写单位/);
  expect(samples.filter((sample) => sample.serviceId === "small-moving").every((sample) => cities.includes(sample.regionId as (typeof cities)[number]))).toBe(true);
  expect(samples.filter((sample) => sample.serviceId === "furniture-assembly").every((sample) => sample.regionId === "cn")).toBe(true);
  expect(
    samples
      .filter((sample) => sample.serviceId === "home-appliance-cleaning")
      .every((sample) => sample.regionId === "shanghai" && sample.sampleType === "public_price"),
  ).toBe(true);
});

it("快狗五城起步价和整数超里程只命中该城页面", async () => {
  const { quote, service } = await formal();
  const moving = service("small-moving");
  const beijingVan = quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-van" }, "beijing");
  expect(beijingVan).toMatchObject({
    status: "estimated",
    demo: false,
    currency: "CNY",
    region: { id: "beijing" },
    range: { min: 30, max: 30 },
    typical: 30,
    sampleCount: 1,
    assumptions: ["使用北京数据"],
  });
  expect(beijingVan.status === "estimated" && replay(beijingVan.breakdown)).toEqual({ min: 30, max: 30 });
  expect(beijingVan.status === "estimated" && beijingVan.breakdown.map((line) => line.label)).toEqual(["起步价（含 5 公里）"]);
  expect(beijingVan.status === "estimated" && beijingVan.matchedSamples[0]?.source).toContain("cityId=1");
  for (const city of ["shanghai", "guangzhou", "shenzhen", "hangzhou", "cn"] as const) {
    expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-van" }, city).status).toBe(
      "insufficient_data",
    );
  }

  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-bread" }, "guangzhou")).toMatchObject({
    region: { id: "guangzhou" },
    range: { min: 36, max: 36 },
    typical: 36,
    assumptions: ["使用广州数据"],
  });
  const guangzhouBread = quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-bread" }, "guangzhou");
  expect(guangzhouBread.status === "estimated" && guangzhouBread.breakdown.map((line) => line.label)).toEqual([
    "起步价（含 7 公里）",
  ]);
  expect(guangzhouBread.status === "estimated" && guangzhouBread.matchedSamples[0]?.source).toContain("cityId=3");
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-bread" }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 30, max: 30 },
  });
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-bread" }, "hangzhou")).toMatchObject({
    region: { id: "hangzhou" },
    range: { min: 29, max: 29 },
  });
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-bread" }, "beijing").status).toBe(
    "insufficient_data",
  );
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "mid-bread" }, "shenzhen")).toMatchObject({
    region: { id: "shenzhen" },
    range: { min: 55, max: 55 },
    typical: 55,
  });
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "m68" }, "beijing")).toMatchObject({
    range: { min: 260, max: 260 },
    sampleCount: 1,
  });
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "m68" }, "guangzhou")).toMatchObject({
    region: { id: "guangzhou" },
    range: { min: 280, max: 280 },
    sampleCount: 1,
  });
  expect(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "iveco" }, "shanghai")).toMatchObject({
    range: { min: 68, max: 68 },
    region: { id: "shanghai" },
  });

  const beijingKm = quote(
    moving,
    { channel: "kuaigou-km", "kg-km-vehicle": "m76", "kg-km": 2 },
    "beijing",
  );
  expect(beijingKm).toMatchObject({ region: { id: "beijing" }, range: { min: 12, max: 12 }, typical: 6, sampleCount: 1 });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "m76", "kg-km": 2 }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 10, max: 10 },
    typical: 5,
  });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "m76", "kg-km": 2 }, "hangzhou")).toMatchObject({
    region: { id: "hangzhou" },
    range: { min: 10, max: 10 },
    typical: 5,
  });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "small-van", "kg-km": 4 }, "beijing")).toMatchObject({
    range: { min: 12, max: 12 },
    typical: 3,
  });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "errand", "kg-km": 2 }, "beijing")).toMatchObject({
    range: { min: 6, max: 6 },
    typical: 3,
  });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "micro", "kg-km": 2 }, "beijing").status).toBe(
    "insufficient_data",
  );
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "micro", "kg-km": 2 }, "shenzhen").status).toBe(
    "insufficient_data",
  );
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "iveco", "kg-km": 2 }, "shanghai").status).toBe(
    "insufficient_data",
  );
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "iveco", "kg-km": 2 }, "hangzhou")).toMatchObject({
    range: { min: 8, max: 8 },
    typical: 4,
  });
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "m76", "kg-km": 0 }, "beijing").status).toBe(
    "invalid_input",
  );
  expect(quote(moving, { channel: "kuaigou-km", "kg-km-vehicle": "m76", "kg-km": 501 }, "beijing").status).toBe(
    "invalid_input",
  );

  expect(quote(moving, { channel: "kuaigou-wait", "wait-tier": "block-15-10", "wait-blocks": 2 }, "beijing")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 20, max: 20 },
    typical: 10,
  });
  expect(quote(moving, { channel: "kuaigou-wait", "wait-tier": "block-10-5", "wait-blocks": 2 }, "guangzhou")).toMatchObject({
    region: { id: "guangzhou" },
    range: { min: 10, max: 10 },
    typical: 5,
  });
  expect(quote(moving, { channel: "kuaigou-wait", "wait-tier": "block-10-5", "wait-blocks": 2 }, "beijing").status).toBe(
    "insufficient_data",
  );
  expect(quote(moving, { channel: "kuaigou-wait", "wait-tier": "block-30-40", "wait-blocks": 1 }, "shenzhen")).toMatchObject({
    range: { min: 40, max: 40 },
    typical: 40,
  });
  const repeated = quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-van" }, "beijing");
  expect(repeated).toEqual(quote(moving, { channel: "kuaigou-start", "kg-start-vehicle": "small-van" }, "beijing"));
});

it("蓝犀牛五城起步价、超公里和日式搬家按各城页面命中", async () => {
  const { quote, service } = await formal();
  const moving = service("small-moving");
  const start = (city: string, vehicle: string, day: string) =>
    quote(moving, { channel: "lxn-start", "lxn-vehicle": vehicle, "lxn-day": day }, city);

  expect(start("beijing", "xiaomian", "weekday")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 106, max: 106 },
    typical: 106,
    sampleCount: 1,
    assumptions: ["使用北京数据"],
  });
  expect(start("shanghai", "xiaomian", "weekend")).toMatchObject({ region: { id: "shanghai" }, range: { min: 118, max: 118 } });
  expect(start("guangzhou", "xiaomian", "weekday")).toMatchObject({ region: { id: "guangzhou" }, range: { min: 106, max: 106 } });
  expect(start("shenzhen", "xiaomian", "weekend")).toMatchObject({ region: { id: "shenzhen" }, range: { min: 118, max: 118 } });
  expect(start("hangzhou", "xiaomian", "weekday")).toMatchObject({ region: { id: "hangzhou" }, range: { min: 102, max: 102 } });
  expect(start("hangzhou", "xiaomian", "weekend")).toMatchObject({
    region: { id: "hangzhou" },
    range: { min: 102, max: 102 },
    sampleCount: 1,
  });
  expect(start("beijing", "zhongmian", "weekend")).toMatchObject({ range: { min: 186, max: 186 } });
  expect(start("hangzhou", "zhongmian", "weekday")).toMatchObject({ range: { min: 176, max: 176 } });
  expect(start("hangzhou", "xiaoxiang", "weekend")).toMatchObject({ range: { min: 298, max: 298 } });
  expect(start("beijing", "xianghuo", "weekend")).toMatchObject({ range: { min: 428, max: 428 }, region: { id: "beijing" } });
  expect(start("guangzhou", "xianghuo", "weekend")).toMatchObject({ range: { min: 428, max: 428 }, region: { id: "guangzhou" } });
  expect(start("shanghai", "xianghuo", "weekday")).toMatchObject({ range: { min: 368, max: 368 } });
  const shenzhenWeekend = start("shenzhen", "xianghuo", "weekend");
  expect(shenzhenWeekend).toMatchObject({
    region: { id: "shenzhen" },
    range: { min: 448, max: 448 },
    typical: 448,
    sampleCount: 1,
  });
  expect(shenzhenWeekend.status === "estimated" && shenzhenWeekend.matchedSamples[0]?.source).toContain("/price/440300");
  expect(shenzhenWeekend.status === "estimated" && shenzhenWeekend.matchedSamples[0]?.source).not.toContain("/price/110100");
  expect(start("hangzhou", "xianghuo", "weekend")).toMatchObject({ region: { id: "hangzhou" }, range: { min: 348, max: 348 } });

  expect(quote(moving, { channel: "lxn-km", "lxn-km-vehicle": "xianghuo", "lxn-km": 3 }, "shenzhen")).toMatchObject({
    region: { id: "shenzhen" },
    range: { min: 21, max: 21 },
    typical: 7,
    sampleCount: 1,
  });
  expect(quote(moving, { channel: "lxn-km", "lxn-km-vehicle": "xiaomian", "lxn-km": 4 }, "beijing")).toMatchObject({
    range: { min: 20, max: 20 },
    typical: 5,
  });
  expect(quote(moving, { channel: "lxn-km", "lxn-km-vehicle": "xiaoxiang", "lxn-km": 2 }, "guangzhou")).toMatchObject({
    region: { id: "guangzhou" },
    range: { min: 12, max: 12 },
    typical: 6,
  });

  const japanese = quote(moving, { channel: "lxn-jp", "jp-style": "full" }, "hangzhou");
  expect(japanese).toMatchObject({
    region: { id: "hangzhou" },
    range: { min: 1400, max: 1400 },
    typical: 1400,
    assumptions: ["使用杭州数据"],
    sampleCount: 1,
  });
  expect(japanese.status === "estimated" && japanese.matchedSamples[0]?.source).toContain("/price/330100");
  expect(quote(moving, { channel: "lxn-jp", "jp-style": "half" }, "beijing")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 1150, max: 1150 },
    typical: 1150,
  });
  expect(quote(moving, { channel: "lxn-jp", "jp-style": "full" }, "cn").status).toBe("insufficient_data");
  expect(quote(moving, { channel: "lxn-cube", "cube-style": "half", cubes: 2 }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 460, max: 460 },
    typical: 230,
  });
  expect(quote(moving, { channel: "lxn-jp", "jp-style": "full" }, "beijing", "2026-11-19").status).toBe("insufficient_data");
  expect(quote(moving, {}, "beijing").status).toBe("invalid_input");
  expect(quote(moving, { channel: "lxn-start", "lxn-vehicle": "xiaomian", "lxn-day": "weekday" }, "unknown").status).toBe(
    "invalid_input",
  );
});

it("宜家组装公式、拆运和厨卫拆装记在全国参考，不互相加总", async () => {
  const { quote, service } = await formal();
  const furniture = service("furniture-assembly");
  const display = quote(furniture, { job: "formula", "formula-item": "display" }, "beijing");
  expect(display).toMatchObject({
    region: { id: "cn" },
    range: { min: 59, max: 59 },
    typical: 59,
    assumptions: ["本地数据不足，使用全国参考数据"],
    sampleCount: 1,
  });
  expect(display.status === "estimated" && display.matchedSamples[0]?.source).toContain("assembly-intro");
  expect(quote(furniture, { job: "formula", "formula-item": "display" }, "cn")).toMatchObject({
    region: { id: "cn" },
    range: { min: 59, max: 59 },
    assumptions: ["使用全国数据"],
  });
  expect(quote(furniture, { job: "formula", "formula-item": "base" }, "shanghai")).toMatchObject({
    range: { min: 49, max: 49 },
    typical: 49,
  });
  expect(quote(furniture, { job: "formula", "formula-item": "minute", minutes: 6 }, "guangzhou")).toMatchObject({
    region: { id: "cn" },
    range: { min: 12, max: 12 },
    typical: 2,
  });
  expect(quote(furniture, { job: "formula", "formula-item": "minute", minutes: 0 }, "beijing").status).toBe(
    "invalid_input",
  );
  expect(quote(furniture, { job: "wall", "wall-qty": 2 }, "shenzhen")).toMatchObject({
    range: { min: 60, max: 60 },
    typical: 30,
  });
  expect(quote(furniture, { job: "removal", "removal-item": "sofa", "removal-qty": 1 }, "hangzhou")).toMatchObject({
    range: { min: 149, max: 149 },
    typical: 149,
  });
  expect(quote(furniture, { job: "removal", "removal-item": "wardrobe", "removal-qty": 2 }, "beijing")).toMatchObject({
    range: { min: 498, max: 498 },
    typical: 249,
  });
  expect(quote(furniture, { job: "removal", "removal-item": "bed", "removal-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 249, max: 249 },
  });
  expect(quote(furniture, { job: "bath-kitchen", "kb-item": "old-kitchen", "kb-qty": 1 }, "guangzhou")).toMatchObject({
    range: { min: 499, max: 499 },
  });
  expect(quote(furniture, { job: "bath-kitchen", "kb-item": "annat", "kb-qty": 1 }, "cn")).toMatchObject({
    range: { min: 169, max: 169 },
    typical: 169,
  });
  expect(quote(furniture, { job: "bath-kitchen", "kb-item": "single", "kb-qty": 2 }, "beijing")).toMatchObject({
    range: { min: 200, max: 200 },
    typical: 100,
  });
  const sofa = quote(furniture, { job: "removal", "removal-item": "sofa", "removal-qty": 1 }, "beijing");
  expect(sofa.status === "estimated" && sofa.breakdown.some((line) => line.label.includes("展示价"))).toBe(false);
  expect(service("furniture-assembly").scope.excluded.join("\n")).toMatch(/万师傅/);
  expect(service("furniture-assembly").scope.excluded.join("\n")).toMatch(/完整厨房安装/);
});

it("自如日常保洁不覆盖广州，深度保洁只限北京，好慷不取区间中点", async () => {
  const { quote, service } = await formal();
  const cleaning = service("home-cleaning");
  expect(quote(cleaning, { job: "ziroom-hour", hours: 2 }, "beijing")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 70, max: 70 },
    typical: 35,
    assumptions: ["使用北京数据"],
    sampleCount: 1,
  });
  expect(quote(cleaning, { job: "ziroom-hour", hours: 3 }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 105, max: 105 },
    typical: 35,
  });
  expect(quote(cleaning, { job: "ziroom-hour", hours: 2 }, "shenzhen")).toMatchObject({
    region: { id: "shenzhen" },
    range: { min: 70, max: 70 },
  });
  expect(quote(cleaning, { job: "ziroom-hour", hours: 2 }, "hangzhou")).toMatchObject({
    region: { id: "hangzhou" },
    range: { min: 70, max: 70 },
  });
  expect(quote(cleaning, { job: "ziroom-hour", hours: 2 }, "guangzhou").status).toBe("insufficient_data");
  expect(quote(cleaning, { job: "ziroom-hour", hours: 2 }, "cn").status).toBe("insufficient_data");
  expect(quote(cleaning, { job: "ziroom-hour", hours: 1 }, "beijing").status).toBe("invalid_input");
  expect(quote(cleaning, { job: "ziroom-area", "area-band": "under-85" }, "shenzhen")).toMatchObject({
    range: { min: 70, max: 70 },
    typical: 70,
  });
  expect(quote(cleaning, { job: "ziroom-area", "area-band": "mid-low" }, "hangzhou")).toMatchObject({
    range: { min: 105, max: 105 },
    typical: 105,
  });
  expect(quote(cleaning, { job: "ziroom-area", "area-band": "mid-high" }, "beijing")).toMatchObject({
    range: { min: 140, max: 140 },
    typical: 140,
  });
  expect(quote(cleaning, { job: "ziroom-area", "area-band": "over-135" }, "shanghai")).toMatchObject({
    range: { min: 175, max: 175 },
    typical: 175,
  });
  expect(quote(cleaning, { job: "ziroom-area", "area-band": "mid-low" }, "guangzhou").status).toBe("insufficient_data");

  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "one" }, "beijing")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 550, max: 550 },
    typical: 550,
    assumptions: ["使用北京数据"],
  });
  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "three-two" }, "beijing")).toMatchObject({
    range: { min: 1100, max: 1100 },
  });
  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "kitchen" }, "beijing")).toMatchObject({
    range: { min: 300, max: 300 },
  });
  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "bath" }, "beijing")).toMatchObject({
    range: { min: 200, max: 200 },
  });
  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "four-rate", "deep-area": 10 }, "beijing")).toMatchObject({
    range: { min: 90, max: 90 },
    typical: 9,
  });
  expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "four-min" }, "beijing")).toMatchObject({
    range: { min: 1200, max: 1200 },
    typical: 1200,
  });
  for (const city of ["shanghai", "guangzhou", "shenzhen", "hangzhou", "cn"] as const) {
    expect(quote(cleaning, { job: "ziroom-deep", "deep-item": "one" }, city).status).toBe("insufficient_data");
    expect(quote(cleaning, { job: "ziroom-kill", "kill-item": "one" }, city).status).toBe("insufficient_data");
  }
  expect(quote(cleaning, { job: "ziroom-kill", "kill-item": "four" }, "beijing")).toMatchObject({
    region: { id: "beijing" },
    range: { min: 480, max: 480 },
    typical: 480,
  });

  const low = quote(cleaning, { job: "homeking", "hk-item": "hour-low" }, "guangzhou");
  expect(low).toMatchObject({
    region: { id: "cn" },
    range: { min: 45, max: 45 },
    typical: 45,
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(low.status === "estimated" && low.typical).not.toBe(50);
  expect(quote(cleaning, { job: "homeking", "hk-item": "hour-high" }, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 55, max: 55 },
    typical: 55,
  });
  expect(quote(cleaning, { job: "homeking", "hk-item": "four-low" }, "shanghai")).toMatchObject({ range: { min: 180, max: 180 } });
  expect(quote(cleaning, { job: "homeking", "hk-item": "four-high" }, "shenzhen")).toMatchObject({
    range: { min: 220, max: 220 },
    typical: 220,
  });
  expect(quote(cleaning, { job: "homeking", "hk-item": "trial" }, "hangzhou")).toMatchObject({ range: { min: 599, max: 599 } });
  expect(quote(cleaning, { job: "homeking", "hk-item": "kitchen", "hk-rooms": 2 }, "cn")).toMatchObject({
    region: { id: "cn" },
    range: { min: 718, max: 718 },
    typical: 359,
    assumptions: ["使用全国数据"],
  });
  expect(low.status === "estimated" && low.matchedSamples[0]?.source).toContain("以下单页");
});

it("上海冰箱洗衣机油烟机清洗不外借，也不冒充日常保洁", async () => {
  const { quote, service } = await formal();
  const appliance = service("home-appliance-cleaning");
  const fridge = quote(appliance, { item: "fridge-side", qty: 1 }, "shanghai");
  expect(fridge).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 158, max: 158 },
    typical: 158,
    sampleCount: 1,
    assumptions: ["使用上海数据"],
  });
  expect(fridge.status === "estimated" && fridge.matchedSamples[0]?.source).toContain("962121.fgj.sh.gov.cn");
  expect(fridge.status === "estimated" && fridge.matchedSamples[0]?.sampleType).toBe("public_price");
  expect(quote(appliance, { item: "fridge-side", qty: 2 }, "shanghai")).toMatchObject({
    range: { min: 316, max: 316 },
    typical: 158,
  });
  expect(quote(appliance, { item: "fridge-single", qty: 1 }, "shanghai")).toMatchObject({ range: { min: 115, max: 115 } });
  expect(quote(appliance, { item: "washer-drum", qty: 1 }, "shanghai")).toMatchObject({ range: { min: 110, max: 110 } });
  expect(quote(appliance, { item: "washer-full", qty: 1 }, "shanghai")).toMatchObject({ range: { min: 198, max: 198 } });
  expect(quote(appliance, { item: "hood-gas", qty: 1 }, "shanghai")).toMatchObject({ range: { min: 168, max: 168 } });
  expect(quote(appliance, { item: "hood-plain", qty: 1 }, "shanghai")).toMatchObject({ range: { min: 128, max: 128 } });
  for (const city of ["beijing", "guangzhou", "shenzhen", "hangzhou", "cn"] as const) {
    expect(quote(appliance, { item: "fridge-side", qty: 1 }, city).status).toBe("insufficient_data");
  }
  expect(quote(appliance, { item: "hood-full", qty: 0 }, "shanghai").status).toBe("invalid_input");
  expect(service("home-appliance-cleaning").scope.excluded.join("\n")).toMatch(/不是日常保洁/);
  expect(service("home-cleaning").description).not.toMatch(/油烟机清洗/);
});

it("第三批关键词单独命中，不干扰原有服务", async () => {
  const { catalog } = await formal();
  const group = directoryGroup(catalog, false);
  const ids = (keyword: string) => searchServices(group.services, group.categories, { keyword }).map((hit) => hit.service.id);
  expect(ids("小型搬家")).toEqual(["small-moving"]);
  expect(ids("蓝犀牛")).toEqual(["small-moving"]);
  expect(ids("58速运")).toEqual(["small-moving"]);
  expect(ids("家具组装")).toEqual(["furniture-assembly"]);
  expect(ids("旧家具拆运")).toEqual(["furniture-assembly"]);
  expect(ids("日常保洁")).toEqual(["home-cleaning"]);
  expect(ids("深度保洁")).toEqual(["home-cleaning"]);
  expect(ids("好慷保洁")).toEqual(["home-cleaning"]);
  expect(ids("油烟机清洗")).toEqual(["home-appliance-cleaning"]);
  expect(ids("洗衣机清洗")).toEqual(["home-appliance-cleaning"]);
  expect(ids("冰箱清洗")).toEqual(["home-appliance-cleaning"]);
  expect(ids("空调清洗")).toEqual(["ac-cleaning"]);
  expect(ids("装灯")).toEqual(["ceiling-light-install"]);
  expect(ids("窗帘杆")).toEqual(["curtain-install"]);
  expect(ids("指纹锁")).toEqual(["smart-lock-install"]);
  expect(ids("换水龙头")).toEqual(["faucet-valve-install"]);
  expect(ids("洗衣机龙头")).toEqual(["faucet-valve-install"]);
  expect(ids("换插座")).toEqual(["switch-outlet-install"]);
  expect(ids("马桶安装")).toEqual(["bathroom-fixture-install"]);
});
