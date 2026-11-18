import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { validateCatalog, type Catalog } from "../../lib/data/validator";
import { priceSampleSchema, pricingConfigSchema } from "../../schemas/price.schema";
import { questionSchema, serviceSchema } from "../../schemas/service.schema";
import { loadDemo } from "../demo";

it("正式数据加载路径排除 fixtures", async () => {
  const production = await loadCatalog(resolve("data"));
  expect(production.services.every((s) => !s.demo)).toBe(true);
  expect(production["price-samples"].every((s) => !s.demo)).toBe(true);
  expect((await loadDemo()).service.demo).toBe(true);
});

const invalid: [string, (data: Catalog) => void][] = [
  [
    "类别",
    (d) => {
      d.categories = [];
    },
  ],
  [
    "样本服务",
    (d) => {
      d["price-samples"][0].serviceId = "missing";
    },
  ],
  [
    "样本地区",
    (d) => {
      d["price-samples"][0].regionId = "missing";
    },
  ],
  [
    "地区规则",
    (d) => {
      d.services[0].pricing.regionRules[0].regionId = "missing";
    },
  ],
  [
    "所属省份",
    (d) => {
      d.regions[0].parentId = "beijing";
    },
  ],
  [
    "重复服务",
    (d) => {
      d.services.push(d.services[0]);
    },
  ],
  [
    "重复样本",
    (d) => {
      d["price-samples"].push(d["price-samples"][0]);
    },
  ],
  [
    "重复 slug",
    (d) => {
      d.services.push({ ...d.services[0], id: "other" });
    },
  ],
  [
    "向后或循环引用",
    (d) => {
      d.services[0].questions[1].visibility![0].questionId = "quantity";
    },
  ],
  [
    "条件操作符",
    (d) => {
      d.services[0].questions[1].visibility![0].operator = "contains";
    },
  ],
  [
    "未知数量",
    (d) => {
      d.services[0].pricing.unitQuestionId = "absent";
    },
  ],
  [
    "附加费引用",
    (d) => {
      d.services[0].pricing.modifiers[0].conditions![0].questionId = "absent";
    },
  ],
  [
    "无效样本条件",
    (d) => {
      d["price-samples"][0].conditions = { quantity: -1 };
    },
  ],
  [
    "demo 混入",
    (d) => {
      d.services[0].demo = false;
    },
  ],
];
it.each(invalid)("拒绝无效引用或数据集：%s", async (_, mutate) => {
  const { catalog } = await loadDemo();
  mutate(catalog);
  expect(validateCatalog(catalog, true).length).toBeGreaterThan(0);
});

it("价格、日期、来源与样本类型严格校验", async () => {
  const { data, service } = await loadDemo();
  for (const extra of [
    { price: -1 },
    { price: 1.5 },
    { currency: "USD" },
    { source: " " },
    { collectedAt: "2025-02-29" },
    { sampleType: "unknown" },
    { phone: "example" },
  ]) {
    expect(priceSampleSchema.safeParse({ ...data.samples[0], ...extra }).success).toBe(false);
  }
  for (const extra of [
    { basePrice: { min: 2, max: 1 } },
    { minimumPrice: -1 },
    { modifiers: [{ label: "例", type: "fixed", min: 1, max: -1 }] },
    { regionRules: [{ regionId: "cn", multiplier: -1 }] },
    { model: "area", unitQuestionId: undefined },
  ]) {
    expect(pricingConfigSchema.safeParse({ ...service.pricing, ...extra }).success).toBe(false);
  }
  expect(
    serviceSchema.safeParse({ ...service, questions: [...service.questions, service.questions[0]] }).success,
  ).toBe(false);
  const q = service.questions[0];
  expect(questionSchema.safeParse({ ...q, options: [q.options![0], q.options![0]] }).success).toBe(false);
});

it("递归发现数据文件：损坏 JSON、无效 Schema、错误位置均报告文件路径", async () => {
  const root = await mkdtemp(join(tmpdir(), "priceright-data-"));
  try {
    const dir = join(root, "services", "nested");
    await mkdir(dir, { recursive: true });
    const path = join(dir, "bad.json");
    for (const content of ["{", "{}"]) {
      await writeFile(path, content);
      await expect(loadCatalog(root)).rejects.toThrow(path);
    }
    await rm(path);
    await writeFile(join(root, "misplaced.json"), "[]");
    await expect(loadCatalog(root)).rejects.toThrow("misplaced.json");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
