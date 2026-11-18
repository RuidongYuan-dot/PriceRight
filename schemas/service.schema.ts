import { z } from "zod";
import { conditionSchema, id, scalar, text, unique } from "./common";
import { priceModifierSchema, pricingConfigSchema } from "./price.schema";

export const categorySchema = z.strictObject({
  id,
  name: text,
  description: text.optional(),
  icon: text.optional(),
  order: z.int().nonnegative(),
});
export const questionOptionSchema = z.strictObject({
  id,
  label: text,
  description: text.optional(),
  value: scalar,
  priceModifier: z.array(priceModifierSchema).optional(),
});
export const questionSchema = z
  .strictObject({
    id,
    type: z.enum(["single", "multiple", "number", "boolean", "select", "area", "distance"]),
    title: text,
    description: text.optional(),
    required: z.boolean(),
    options: z.array(questionOptionSchema).min(1).optional(),
    visibility: z.array(conditionSchema).optional(),
    validation: z
      .strictObject({
        min: z.number().optional(),
        max: z.number().optional(),
        integer: z.boolean().optional(),
      })
      .optional(),
  })
  .superRefine((q, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (["single", "multiple", "select"].includes(q.type) !== Boolean(q.options)) issue("选项与题型不匹配");
    if (q.options && (!unique(q.options.map((o) => o.value)) || !unique(q.options.map((o) => o.id))))
      issue("选项 ID 或值重复");
    if (!q.validation) return;
    if (!["number", "area", "distance", "multiple"].includes(q.type)) issue("该题型不支持数值校验");
    const { min, max, integer } = q.validation;
    if (min !== undefined && max !== undefined && min > max) issue("校验下限大于上限");
    if (["area", "distance"].includes(q.type) && (min ?? max ?? 0) < 0) issue("面积和距离范围必须非负");
    if (q.type === "multiple") {
      if (
        integer !== undefined ||
        [min, max].some(
          (v) => v !== undefined && (!Number.isSafeInteger(v) || v < 0 || v > (q.options?.length ?? 0)),
        )
      )
        issue("多选数量限制无效");
      if (q.required && max === 0) issue("必填多选至少需要一个选项");
    }
  });

export const serviceSchema = z
  .strictObject({
    id,
    categoryId: id,
    name: text,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: text,
    status: z.enum(["active", "draft", "coming_soon"]),
    questions: z.array(questionSchema),
    pricing: pricingConfigSchema,
    scope: z.strictObject({ included: z.array(text), excluded: z.array(text) }),
    metadata: z
      .strictObject({ createdAt: z.iso.date(), updatedAt: z.iso.date() })
      .refine((m) => m.createdAt <= m.updatedAt, "更新时间早于创建时间"),
    demo: z.boolean().default(false),
  })
  .refine((s) => unique(s.questions.map((q) => q.id)), "问题 ID 重复");

export type Category = z.infer<typeof categorySchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
