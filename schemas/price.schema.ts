import { z } from "zod";
import { answer, conditionSchema, id, money, priceRangeSchema, text, unique } from "./common";

// 样本条件里的闭区间。至少一侧有边界，且下限不大于上限。两端都包含在内。
export const numericRangeSchema = z
  .strictObject({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .refine((range) => range.min !== undefined || range.max !== undefined, "数值区间至少需要一个边界")
  .refine(
    (range) => range.min === undefined || range.max === undefined || range.min <= range.max,
    "区间下限不能大于上限",
  );
export type NumericRange = z.infer<typeof numericRangeSchema>;
export const sampleConditionSchema = z.union([answer, numericRangeSchema]);
export type SampleCondition = z.infer<typeof sampleConditionSchema>;

export function isNumericRange(value: unknown): value is NumericRange {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const modifierFields = {
  label: text,
  conditions: z.array(conditionSchema).optional(),
  // 只在命中这些地区时收取。省略则任何命中地区都收取。互斥价目不要叠在同一个地区上。
  regionIds: z.array(id).min(1).optional(),
};
const amount = { min: money, max: money };

export const priceModifierSchema = z
  .discriminatedUnion("type", [
    z.strictObject({ ...modifierFields, type: z.literal("fixed"), ...amount }),
    z.strictObject({ ...modifierFields, type: z.literal("per_unit"), ...amount, unitQuestionId: id }),
    z.strictObject({ ...modifierFields, type: z.literal("percentage"), value: z.number().nonnegative() }),
  ])
  .refine((m) => m.type === "percentage" || m.min <= m.max, "附加费区间上下限错误");

export const regionRuleSchema = z
  .strictObject({
    regionId: id,
    multiplier: z.number().positive().optional(),
    priceOverride: priceRangeSchema.optional(),
  })
  .refine((r) => r.multiplier !== undefined || r.priceOverride !== undefined, "地区规则缺少调整项");

export const pricingConfigSchema = z
  .strictObject({
    model: z.enum(["fixed", "range", "per_unit", "hourly", "area", "distance", "composite"]),
    basePrice: priceRangeSchema,
    unitQuestionId: id.optional(),
    modifiers: z.array(priceModifierSchema).default([]),
    regionRules: z.array(regionRuleSchema).default([]),
    minimumPrice: money.optional(),
    minimumSampleCount: z.int().positive().default(5),
  })
  .superRefine((p, ctx) => {
    if (["per_unit", "hourly", "area", "distance"].includes(p.model) && !p.unitQuestionId) {
      ctx.addIssue({ code: "custom", message: "按量计价必须指定 unitQuestionId" });
    }
    if (["fixed", "range"].includes(p.model) && p.unitQuestionId) {
      ctx.addIssue({ code: "custom", message: "固定总价或区间总价不能绑定数量" });
    }
    if (p.model === "fixed" && p.basePrice.min !== p.basePrice.max) {
      ctx.addIssue({ code: "custom", message: "固定基础价格上下限必须相同" });
    }
    if (!unique(p.regionRules.map((r) => r.regionId))) {
      ctx.addIssue({ code: "custom", message: "地区规则重复" });
    }
  });

export const priceSampleSchema = z.strictObject({
  id,
  serviceId: id,
  regionId: id,
  price: money,
  currency: z.literal("CNY"),
  sampleType: z.enum(["actual_transaction", "provider_quote", "public_price", "manual_reference"]),
  source: text,
  collectedAt: z.iso.date(),
  conditions: z.record(id, sampleConditionSchema).optional(),
  verified: z.boolean(),
  demo: z.boolean().default(false),
});
export type PriceSample = z.infer<typeof priceSampleSchema>;
export type PriceModifier = z.infer<typeof priceModifierSchema>;
export type PricingConfig = z.infer<typeof pricingConfigSchema>;
