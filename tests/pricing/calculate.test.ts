import { describe, expect, it } from "vitest";
import { calculatePrice } from "../../lib/pricing/calculate";
import { loadDemo } from "../demo";

describe("确定性定价", () => {
  it("吸顶灯北京与上海，可重复且输入不变", async () => {
    const { service, answers, data, quote } = await loadDemo();
    const before = structuredClone({ service, answers, data });
    const result = quote();
    expect(result).toMatchObject({
      status: "estimated",
      currency: "CNY",
      range: { min: 80, max: 120 },
      demo: true,
      sampleCount: 1,
      confidence: "low",
      dataUpdatedAt: "2026-11-01",
      sources: [{ sampleId: "demo-bj", level: "D" }],
      typical: 55,
      warnings: expect.arrayContaining(["数据样本有限，结果仅供粗略参考"]),
      breakdown: [
        { source: "base", range: { min: 40, max: 60 } },
        { source: "quantity", operation: "replace", range: { min: 80, max: 120 } },
      ],
    });
    expect(quote()).toEqual(result);
    expect(quote({}, "shanghai")).toMatchObject({ range: { min: 100, max: 150 }, typical: 65 });
    expect({ service, answers, data }).toEqual(before);
  });
  it.each([
    [1, 50, 60],
    [10, 400, 600],
  ])("数量 %i 与最低收费", async (quantity, min, max) => {
    expect((await loadDemo()).quote({ quantity })).toMatchObject({ range: { min, max } });
  });
  it.each([0, -1, 11, 1.5, Infinity, "2"])("拒绝非法数量 %s", async (quantity) => {
    expect((await loadDemo()).quote({ quantity }).status).toBe("invalid_input");
  });
  it("空答案和无效地区不能产生参考价", async () => {
    const { service, data, quote } = await loadDemo();
    expect(calculatePrice(service, {}, "beijing", data).status).toBe("invalid_input");
    expect(quote({}, "unknown").status).toBe("invalid_input");
  });
  it("组合计件和固定附加费，改选后隐藏项不再收费", async () => {
    const { quote } = await loadDemo();
    expect(quote({ "lamp-type": "pendant", heavy: true, "remove-old": true })).toMatchObject({
      range: { min: 100, max: 156 },
    });
    expect(quote({ heavy: true, "remove-old": true })).toMatchObject({ range: { min: 90, max: 136 } });
  });
  it.each(["area", "distance", "hourly", "per_unit"] as const)(
    "%s 按小数用量逐项舍入，支持零用量",
    async (model) => {
      const { service, quote } = await loadDemo();
      const q = service.questions.find((q) => q.id === "quantity")!;
      q.type = model === "area" || model === "distance" ? model : "number";
      q.validation = { min: 0 };
      service.pricing.model = model;
      service.pricing.minimumPrice = 0;
      expect(quote({ quantity: 0.1125 })).toMatchObject({ range: { min: 5, max: 7 } });
      expect(quote({ quantity: 0 })).toMatchObject({ range: { min: 0, max: 0 } });
    },
  );
  it("多选附加费与百分比按固定顺序计算", async () => {
    const { service, quote } = await loadDemo();
    service.questions.push({
      id: "extras",
      type: "multiple",
      required: false,
      title: "测试选项",
      options: [
        {
          id: "extra",
          label: "固定",
          value: 0,
          priceModifier: [{ type: "fixed", label: "固定", min: 10, max: 20 }],
        },
        {
          id: "percent",
          label: "百分比",
          value: false,
          priceModifier: [{ type: "percentage", label: "比例", value: 10 }],
        },
      ],
    });
    service.pricing.modifiers.push({ type: "percentage", label: "比例二", value: 5 });
    expect(quote({ extras: [false, 0] })).toMatchObject({ range: { min: 104, max: 161 } });
    expect(quote({ extras: [false, 0] })).toEqual(quote({ extras: [0, false] }));
  });
  it("按城市、省、等级、全国回退，规则与样本取同一个地区", async () => {
    const { service, data, quote } = await loadDemo();
    data.samples = ["guangzhou", "guangdong", "first-tier", "cn"].map((regionId, i) => {
      service.pricing.regionRules.push({ regionId, priceOverride: { min: 60 + i, max: 70 + i } });
      return { ...data.samples[0], id: String(i), regionId };
    });
    for (let i = 0; i < 4; i++) {
      const { regionId } = data.samples[0];
      expect(quote({}, "guangzhou")).toMatchObject({
        region: { id: regionId },
        sampleCount: 1,
        range: { min: 120 + 2 * i, max: 140 + 2 * i },
      });
      data.samples.shift();
    }
    expect(quote({}, "guangzhou")).toMatchObject({
      status: "insufficient_data",
      range: null,
      sampleCount: 0,
    });
  });
  it("只采用同服务、同条件、同数据集、已核验的可用样本", async () => {
    const { service, data, answers, quote } = await loadDemo();
    const s = data.samples[0];
    data.samples = [
      { ...s, verified: false },
      { ...s, serviceId: "else" },
      { ...s, demo: false },
      { ...s, conditions: { quantity: 1 } },
      { ...s, conditions: { heavy: true } },
    ];
    expect(quote({ heavy: true }).status).toBe("insufficient_data");
    data.samples = [s];
    expect(calculatePrice(service, answers, "beijing", { ...data, asOf: "2020-01-01" }).status).toBe(
      "insufficient_data",
    );
    service.status = "draft";
    expect(quote().status).toBe("insufficient_data");
  });
  it("按量附加费只使用可见且有效的用量", async () => {
    const { service, quote } = await loadDemo();
    service.questions.push({
      id: "extra-area",
      type: "area",
      title: "额外面积",
      required: false,
      visibility: [{ questionId: "heavy", operator: "equals", value: true }],
    });
    service.pricing.modifiers.push({
      type: "per_unit",
      label: "附加面积",
      min: 2,
      max: 3,
      unitQuestionId: "extra-area",
    });
    expect(quote({ "extra-area": 10 })).toMatchObject({ range: { min: 80, max: 120 } });
    expect(quote({ "lamp-type": "pendant", heavy: true, "extra-area": 10 })).toMatchObject({
      range: { min: 110, max: 170 },
    });
  });
  it("从价格明细可复算最终区间", async () => {
    const { quote } = await loadDemo();
    const result = quote({ quantity: 1, "remove-old": true }, "shanghai");
    expect(result.status).toBe("estimated");
    if (result.status !== "estimated") throw new Error("未返回价格明细");
    const total = result.breakdown.reduce(
      (sum, item) =>
        item.operation === "replace"
          ? item.range
          : { min: sum.min + item.range.min, max: sum.max + item.range.max },
      { min: 0, max: 0 },
    );
    expect(total).toEqual({ min: 56, max: 85 });
    expect(total).toEqual(result.range);
  });
  it("超出安全整数的运算不能输出失真的金额", async () => {
    const { service, quote } = await loadDemo();
    service.pricing.basePrice = { min: 1, max: Number.MAX_SAFE_INTEGER };
    expect(quote().status).toBe("invalid_input");
  });
  it("样本数值区间按闭区间匹配，精确条件保持全等", async () => {
    const { data, quote } = await loadDemo();
    const base = data.samples[0]!;
    data.samples = [
      { ...base, id: "low", price: 50, conditions: { quantity: { min: 1, max: 5 } } },
      { ...base, id: "high", price: 40, conditions: { quantity: { min: 6 } } },
      { ...base, id: "exact", price: 70, conditions: { quantity: 2 } },
      { ...base, id: "point", price: 61, conditions: { quantity: { min: 2, max: 2 } } },
      { ...base, id: "open", price: 80 },
    ];
    const matched = (quantity: number) => {
      const result = quote({ quantity });
      expect(result.status).toBe("estimated");
      if (result.status !== "estimated") throw new Error("未返回报价");
      return {
        ids: result.matchedSamples.map((sample) => sample.id),
        sampleCount: result.sampleCount,
        typical: result.typical,
      };
    };
    expect(matched(1)).toEqual({ ids: ["low", "open"], sampleCount: 2, typical: 65 });
    expect(matched(2)).toEqual({ ids: ["exact", "low", "open", "point"], sampleCount: 4, typical: 66 });
    expect(matched(5)).toEqual({ ids: ["low", "open"], sampleCount: 2, typical: 65 });
    expect(matched(6)).toEqual({ ids: ["high", "open"], sampleCount: 2, typical: 60 });
    expect(matched(10)).toEqual({ ids: ["high", "open"], sampleCount: 2, typical: 60 });

    data.samples = [
      { ...base, id: "empty", conditions: { quantity: {} } },
      { ...base, id: "reversed", conditions: { quantity: { min: 8, max: 1 } } },
      { ...base, id: "text", conditions: { "lamp-type": { min: 1, max: 5 } } },
    ];
    expect(quote({ quantity: 2 }).status).toBe("insufficient_data");
    expect(quote({ quantity: 8 }).status).toBe("insufficient_data");
  });
});
