import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { calculatePrice, type PriceBreakdownItem } from "../../lib/pricing/calculate";
import { priceInfluenceFactors } from "../../lib/pricing/factors";
import { directoryGroup } from "../../lib/search/list-services";
import { searchServices } from "../../lib/search/services";
import type { Answer } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";

const asOf = "2026-11-20";
const cities = ["beijing", "guangzhou", "shenzhen", "hangzhou"] as const;

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

it("第二批样本只落在来源写明的地区，不把上海或全国价复制成其他城市价", async () => {
  const { catalog, samples, service } = await formal();
  const wave = ["ac-cleaning", "smart-lock-install", "bathroom-fixture-install", "faucet-valve-install", "switch-outlet-install"];
  for (const id of wave) {
    const item = service(id);
    expect(item.demo).toBe(false);
    expect(item.status).toBe("active");
    expect(() => priceInfluenceFactors(item, catalog.regions)).not.toThrow();
  }
  const owned = samples.filter((sample) => wave.includes(sample.serviceId));
  expect(owned).toHaveLength(118);
  expect(owned.every((sample) => sample.verified && sample.demo === false && sample.currency === "CNY")).toBe(true);
  expect(owned.every((sample) => sample.collectedAt === "2026-11-20" && sample.source.includes("https://"))).toBe(true);
  expect(owned.some((sample) => /10\.8|2\.4|13\.2|26\.4|316\.25|70 元起|平均值|1\.5 元/.test(sample.source))).toBe(false);
  expect(new Set(owned.map((sample) => sample.price))).not.toContain(42);
  expect(new Set(owned.map((sample) => sample.price))).not.toContain(240);
  const cityCopies = owned.filter((sample) => cities.includes(sample.regionId as (typeof cities)[number]));
  expect(cityCopies.map((sample) => sample.id).sort()).toEqual([
    "bath-arrow-dry-beijing",
    "bath-arrow-dry-guangzhou",
    "bath-arrow-dry-hangzhou",
    "bath-arrow-dry-shenzhen",
  ]);
  expect(cityCopies.every((sample) => sample.price === 50)).toBe(true);
  expect(service("smart-lock-install").scope.excluded.join("\n")).toMatch(/传统机械锁应急开锁/);
  expect(service("smart-lock-install").scope.excluded.join("\n")).toMatch(/换锁芯/);
  expect(service("smart-lock-install").description).toMatch(/不是开锁价|不能当成开锁价/);
});

it("空调清洗：上海标准项、海尔柜挂和家中机三套口径互不占用", async () => {
  const { quote, service } = await formal();
  const ac = service("ac-cleaning");
  const shanghai = quote(ac, { job: "shanghai", "sh-item": "wall", "sh-qty": 1 }, "shanghai");
  expect(shanghai).toMatchObject({
    status: "estimated",
    demo: false,
    currency: "CNY",
    region: { id: "shanghai" },
    range: { min: 99, max: 99 },
    typical: 99,
    sampleCount: 1,
    assumptions: ["使用上海数据"],
    warnings: ["数据样本有限，结果仅供粗略参考"],
  });
  expect(shanghai.status === "estimated" && replay(shanghai.breakdown)).toEqual({ min: 99, max: 99 });
  expect(shanghai.status === "estimated" && shanghai.breakdown.map((line) => line.label)).toEqual(["挂机空调清洗"]);
  expect(quote(ac, { job: "shanghai", "sh-item": "wall", "sh-qty": 2 }, "shanghai")).toMatchObject({
    range: { min: 198, max: 198 },
    typical: 99,
    region: { id: "shanghai" },
  });
  expect(quote(ac, { job: "shanghai", "sh-item": "floor", "sh-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 128, max: 128 },
  });
  expect(quote(ac, { job: "shanghai", "sh-item": "cassette", "sh-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 115, max: 115 },
  });
  expect(quote(ac, { job: "shanghai", "sh-item": "central", "sh-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 115, max: 115 },
    typical: 115,
  });
  for (const city of cities) {
    expect(quote(ac, { job: "shanghai", "sh-item": "wall", "sh-qty": 1 }, city).status).toBe("insufficient_data");
  }

  const deep = quote(ac, { job: "haier-wall", "wall-item": "deep-wall", "wall-qty": 1 }, "beijing");
  expect(deep).toMatchObject({
    region: { id: "cn" },
    range: { min: 99, max: 99 },
    typical: 99,
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(deep.status === "estimated" && deep.breakdown.map((line) => line.label)).toEqual(["深度清洗内机（挂机）"]);
  expect(quote(ac, { job: "haier-wall", "wall-item": "deep-wall", "wall-qty": 1 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 99, max: 99 },
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(quote(ac, { job: "haier-wall", "wall-item": "deep-square", "wall-qty": 1 }, "guangzhou")).toMatchObject({
    range: { min: 149, max: 149 },
  });
  expect(quote(ac, { job: "haier-wall", "wall-item": "deep-cylinder", "wall-qty": 1 }, "shenzhen")).toMatchObject({
    range: { min: 189, max: 189 },
  });
  expect(quote(ac, { job: "haier-wall", "wall-item": "deep-twin", "wall-qty": 1 }, "hangzhou")).toMatchObject({
    range: { min: 229, max: 229 },
  });
  expect(quote(ac, { job: "haier-wall", "wall-item": "plain-in-cabinet", "wall-qty": 2 }, "cn")).toMatchObject({
    range: { min: 100, max: 100 },
    typical: 50,
    assumptions: ["使用全国数据"],
  });
  expect(quote(ac, { job: "haier-wall", "wall-item": "plain-out-wall", "wall-qty": 1 }, "beijing")).toMatchObject({
    range: { min: 70, max: 70 },
  });

  expect(quote(ac, { job: "haier-central", "central-item": "indoor-basic", "central-qty": 1 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 99, max: 99 },
    typical: 99,
    sampleCount: 1,
  });
  expect(quote(ac, { job: "haier-central", "central-item": "indoor-deep", "central-qty": 1 }, "beijing")).toMatchObject({
    range: { min: 499, max: 499 },
    typical: 499,
  });
  expect(quote(ac, { job: "haier-central", "central-item": "outdoor", "central-qty": 1 }, "hangzhou")).toMatchObject({
    range: { min: 299, max: 299 },
  });
  expect(quote(ac, { job: "haier-central", "central-item": "indoor-deep", "central-qty": 1 }, "shanghai", "2026-11-19").status).toBe(
    "insufficient_data",
  );
  const once = quote(ac, { job: "shanghai", "sh-item": "wall", "sh-qty": 1 }, "shanghai");
  expect(once).toEqual(quote(ac, { job: "shanghai", "sh-item": "wall", "sh-qty": 1 }, "shanghai"));
});

it("空调高空、远程和上门费只按各自年度表单列，不叠加到清洗价", async () => {
  const { quote, service } = await formal();
  const ac = service("ac-cleaning");
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "high", "high-sets": 3 }, "shenzhen")).toMatchObject({
    region: { id: "cn" },
    range: { min: 300, max: 300 },
    typical: 100,
  });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "high", "high-sets": 4 }, "shenzhen").status).toBe("invalid_input");
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "high-cap" }, "beijing")).toMatchObject({ range: { min: 300, max: 300 } });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "special", "special-sets": 2 }, "shanghai")).toMatchObject({
    range: { min: 600, max: 600 },
    typical: 300,
  });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "special-cap" }, "cn")).toMatchObject({ range: { min: 600, max: 600 } });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "visit" }, "guangzhou")).toMatchObject({ range: { min: 50, max: 50 } });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "remote-mid" }, "hangzhou")).toMatchObject({
    range: { min: 50, max: 50 },
    typical: 50,
  });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "remote-far" }, "beijing")).toMatchObject({ range: { min: 100, max: 100 } });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "gas-small" }, "shanghai")).toMatchObject({ range: { min: 140, max: 140 } });
  expect(quote(ac, { job: "wall-fee", "wall-fee-item": "gas-large" }, "cn")).toMatchObject({ range: { min: 200, max: 200 } });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "mid", "mid-sets": 2 }, "beijing")).toMatchObject({
    range: { min: 200, max: 200 },
    typical: 100,
  });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "mid-cap" }, "shanghai")).toMatchObject({ range: { min: 200, max: 200 } });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "high-floor" }, "shenzhen")).toMatchObject({
    range: { min: 200, max: 200 },
    typical: 200,
  });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "balcony" }, "hangzhou")).toMatchObject({
    range: { min: 0, max: 0 },
    typical: 0,
  });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "louver", "louver-qty": 2 }, "beijing")).toMatchObject({
    range: { min: 40, max: 40 },
    typical: 20,
  });
  expect(quote(ac, { job: "central-fee", "central-fee-item": "grille", "grille-qty": 1 }, "cn")).toMatchObject({
    range: { min: 70, max: 70 },
  });
  const cleaning = quote(ac, { job: "haier-wall", "wall-item": "deep-twin", "wall-qty": 1 }, "beijing");
  expect(cleaning.status === "estimated" && cleaning.breakdown.some((line) => line.label.includes("高空"))).toBe(false);
  expect(cleaning.status === "estimated" && cleaning.breakdown.some((line) => line.label.includes("远程"))).toBe(false);
});

it("智能门锁只使用官方安装价，免费安装不拉低后续收费", async () => {
  const { quote, service } = await formal();
  const lock = service("smart-lock-install");
  expect(quote(lock, { job: "xiaomi", "xiaomi-item": "first", "xiaomi-qty": 1 }, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 0, max: 0 },
    typical: 0,
    sampleCount: 2,
  });
  expect(quote(lock, { job: "xiaomi", "xiaomi-item": "later", "xiaomi-qty": 2 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 340, max: 340 },
    typical: 170,
    sampleCount: 2,
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(quote(lock, { job: "xiaomi", "xiaomi-item": "later-x", "xiaomi-qty": 1 }, "hangzhou")).toMatchObject({
    range: { min: 200, max: 200 },
    typical: 200,
    sampleCount: 1,
  });
  expect(quote(lock, { job: "xiaomi", "xiaomi-item": "remove", "xiaomi-qty": 1 }, "guangzhou")).toMatchObject({
    range: { min: 50, max: 50 },
  });
  expect(quote(lock, { job: "xiaomi", "xiaomi-item": "move", "xiaomi-qty": 1 }, "shenzhen")).toMatchObject({
    range: { min: 220, max: 220 },
  });
  expect(quote(lock, { job: "bull", "bull-item": "install", "bull-qty": 1 }, "cn")).toMatchObject({
    range: { min: 150, max: 150 },
    typical: 150,
    assumptions: ["使用全国数据"],
  });
  expect(quote(lock, { job: "bull", "bull-item": "repair" }, "beijing")).toMatchObject({ range: { min: 120, max: 120 } });
  expect(quote(lock, { job: "bull-extra", "extra-item": "hole", "hole-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 100, max: 100 },
  });
  expect(quote(lock, { job: "bull-extra", "extra-item": "strip", "strip-qty": 2 }, "beijing")).toMatchObject({
    range: { min: 60, max: 60 },
    typical: 30,
  });
  expect(quote(lock, { job: "kaadas", "kaadas-official": true }, "shanghai")).toMatchObject({
    range: { min: 0, max: 0 },
    typical: 0,
    sampleCount: 1,
  });
  expect(quote(lock, { job: "kaadas", "kaadas-official": false }, "shanghai").status).toBe("insufficient_data");
  for (const city of ["beijing", "shanghai", "guangzhou", "shenzhen", "hangzhou", "cn"]) {
    expect(quote(lock, { job: "xiaomi", "xiaomi-item": "later", "xiaomi-qty": 1 }, city).status).not.toBe("invalid_input");
  }
  expect(quote(lock, {}, "beijing").status).toBe("invalid_input");
});

it("水电卫浴按 2026 版、协会整数项和品牌基础价分开，不混算", async () => {
  const { quote, service } = await formal();
  const bath = service("bathroom-fixture-install");
  const faucet = service("faucet-valve-install");
  const outlet = service("switch-outlet-install");

  expect(quote(bath, { job: "toilet", "toilet-item": "hotline-replace", "toilet-qty": 1 }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 260, max: 260 },
    typical: 260,
    assumptions: ["使用上海数据"],
  });
  expect(quote(bath, { job: "toilet", "toilet-item": "hotline-parts", "toilet-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 80, max: 80 },
  });
  expect(quote(bath, { job: "toilet", "toilet-item": "hotline-install", "toilet-qty": 1 }, "beijing").status).toBe(
    "insufficient_data",
  );
  expect(
    quote(bath, { job: "toilet", "toilet-item": "assoc-install", "over-toilet": false, "toilet-qty": 1 }, "shanghai"),
  ).toMatchObject({ range: { min: 96, max: 96 }, typical: 96, sampleCount: 1 });
  expect(
    quote(bath, { job: "toilet", "toilet-item": "assoc-install", "over-toilet": true, "toilet-qty": 1 }, "shanghai").status,
  ).toBe("insufficient_data");
  expect(quote(bath, { job: "toilet", "toilet-item": "assoc-remove", "toilet-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 20, max: 20 },
  });
  expect(quote(bath, { job: "basin", "basin-item": "hotline-install", "basin-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 130, max: 130 },
  });
  expect(
    quote(bath, { job: "basin", "basin-item": "assoc-stand", "over-stand": false, "basin-qty": 1 }, "guangzhou").status,
  ).toBe("insufficient_data");
  expect(quote(bath, { job: "unclog", "unclog-item": "manual", "unclog-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 80, max: 80 },
  });
  expect(quote(bath, { job: "unclog", "unclog-item": "machine", "unclog-qty": 1 }, "hangzhou").status).toBe("insufficient_data");
  expect(quote(bath, { job: "leak", "leak-qty": 2 }, "shanghai")).toMatchObject({ range: { min: 240, max: 240 }, typical: 120 });

  expect(quote(bath, { job: "ikea", "ikea-item": "full", "ikea-qty": 1 }, "shenzhen")).toMatchObject({
    region: { id: "cn" },
    range: { min: 200, max: 200 },
    typical: 200,
  });
  expect(quote(bath, { job: "ikea", "ikea-item": "removal", "ikea-qty": 1 }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 299, max: 299 },
  });
  expect(quote(bath, { job: "ikea", "ikea-item": "glass-two", "ikea-qty": 1 }, "cn")).toMatchObject({
    range: { min: 279, max: 279 },
    assumptions: ["使用全国数据"],
  });

  const arrowToilet = {
    job: "arrow",
    "arrow-action": "install",
    "arrow-product": "toilet",
    "arrow-qty": 1,
  } satisfies Record<string, Answer>;
  expect(quote(bath, arrowToilet, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 70, max: 70 },
    typical: 70,
    assumptions: ["本地数据不足，使用全国参考数据"],
  });
  expect(quote(bath, { ...arrowToilet, "arrow-action": "remove" }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 35, max: 35 },
  });
  expect(quote(bath, { ...arrowToilet, "arrow-product": "concealed", "arrow-qty": 1 }, "hangzhou")).toMatchObject({
    range: { min: 300, max: 300 },
  });
  expect(quote(bath, { job: "arrow-visit", "visit-item": "minimum" }, "guangzhou")).toMatchObject({
    range: { min: 50, max: 50 },
    typical: 50,
  });
  expect(quote(bath, arrowToilet, "beijing")).toMatchObject({ range: { min: 70, max: 70 } });
  for (const city of ["beijing", "shanghai", "guangzhou", "shenzhen", "hangzhou"]) {
    expect(quote(bath, { job: "arrow-visit", "visit-item": "dry" }, city)).toMatchObject({
      region: { id: city },
      range: { min: 50, max: 50 },
      typical: 50,
      assumptions: [`使用${city === "beijing" ? "北京" : city === "shanghai" ? "上海" : city === "guangzhou" ? "广州" : city === "shenzhen" ? "深圳" : "杭州"}数据`],
    });
  }
  expect(quote(bath, { job: "arrow-visit", "visit-item": "dry" }, "cn")).toMatchObject({
    region: { id: "cn" },
    range: { min: 40, max: 40 },
    typical: 40,
    assumptions: ["使用全国数据"],
  });
  expect(quote(bath, { job: "arrow-visit", "visit-item": "drill", "drill-qty": 50 }, "beijing")).toMatchObject({
    range: { min: 100, max: 100 },
    typical: 2,
  });
  expect(quote(bath, { job: "arrow-visit", "visit-item": "drill", "drill-qty": 51 }, "beijing").status).toBe("invalid_input");
  expect(quote(bath, { job: "toto", "toto-official": true }, "shanghai")).toMatchObject({
    region: { id: "cn" },
    range: { min: 0, max: 0 },
    typical: 0,
    sampleCount: 1,
  });
  expect(quote(bath, { job: "toto", "toto-official": false }, "shanghai").status).toBe("insufficient_data");
  expect(quote(bath, { job: "toilet", "toilet-item": "hotline-install", "toilet-qty": 1 }, "shanghai")).toMatchObject({
    typical: 150,
    sampleCount: 1,
  });

  expect(quote(faucet, { job: "hotline", "hotline-item": "cold", "hotline-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 80, max: 80 },
    typical: 80,
    region: { id: "shanghai" },
  });
  expect(quote(faucet, { job: "hotline", "hotline-item": "mixer", "hotline-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 120, max: 120 },
  });
  expect(quote(faucet, { job: "hotline", "hotline-item": "washer", "hotline-qty": 1 }, "beijing").status).toBe("insufficient_data");
  expect(
    quote(faucet, { job: "association", "assoc-item": "basin", "over-basin": false, "assoc-qty": 1 }, "shanghai"),
  ).toMatchObject({ range: { min: 30, max: 30 } });
  expect(
    quote(faucet, { job: "association", "assoc-item": "bath", "over-bath": true, "assoc-qty": 1 }, "shanghai").status,
  ).toBe("insufficient_data");
  expect(quote(faucet, { job: "association", "assoc-item": "angle", "assoc-qty": 1 }, "shanghai")).toMatchObject({
    range: { min: 12, max: 12 },
  });
  expect(quote(faucet, { job: "ikea", "ikea-qty": 1 }, "hangzhou")).toMatchObject({ range: { min: 50, max: 50 }, region: { id: "cn" } });
  expect(quote(faucet, { job: "arrow", "arrow-item": "install", "arrow-qty": 1 }, "beijing")).toMatchObject({
    region: { id: "cn" },
    range: { min: 35, max: 35 },
    typical: 35,
  });
  expect(quote(faucet, { job: "arrow", "arrow-item": "hardware-install", "arrow-qty": 1 }, "shenzhen")).toMatchObject({
    range: { min: 70, max: 70 },
  });

  expect(quote(outlet, { job: "install", "install-qty": 4 }, "shanghai")).toMatchObject({
    region: { id: "shanghai" },
    range: { min: 200, max: 200 },
    typical: 50,
  });
  expect(quote(outlet, { job: "replace", "replace-qty": 1 }, "shanghai")).toMatchObject({ range: { min: 50, max: 50 } });
  expect(quote(outlet, { job: "install", "install-qty": 1 }, "guangzhou").status).toBe("insufficient_data");
  expect(quote(outlet, { job: "circuit" }, "shanghai")).toMatchObject({ range: { min: 120, max: 120 } });
  expect(quote(outlet, { job: "box" }, "beijing").status).toBe("insufficient_data");
  expect(quote(outlet, { job: "arrow" }, "hangzhou")).toMatchObject({
    region: { id: "cn" },
    range: { min: 198, max: 198 },
    typical: 198,
  });
});

it("第二批关键词能单独命中，不把原有灯具和窗帘搜乱", async () => {
  const { catalog } = await formal();
  const group = directoryGroup(catalog, false);
  const ids = (keyword: string) => searchServices(group.services, group.categories, { keyword }).map((hit) => hit.service.id);
  expect(ids("空调清洗")).toEqual(["ac-cleaning"]);
  expect(ids("挂机清洗")).toEqual(["ac-cleaning"]);
  expect(ids("指纹锁")).toEqual(["smart-lock-install"]);
  expect(ids("换水龙头")).toEqual(["faucet-valve-install"]);
  expect(ids("马桶安装")).toEqual(["bathroom-fixture-install"]);
  expect(ids("换插座")).toEqual(["switch-outlet-install"]);
  expect(ids("装灯")).toEqual(["ceiling-light-install"]);
  expect(ids("窗帘杆")).toEqual(["curtain-install"]);
});
