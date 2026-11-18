import { z } from "zod";

export const text = z.string().trim().min(1);
export const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
export const scalar = z.union([text, z.number(), z.boolean()]);
export const answer = z.union([scalar, z.array(scalar)]);
export type Answer = z.infer<typeof answer>;
export const money = z.int().nonnegative(); // 整数人民币元
export const priceRangeSchema = z
  .strictObject({ min: money, max: money })
  .refine((r) => r.min <= r.max, "区间下限不能大于上限");
export type PriceRange = z.infer<typeof priceRangeSchema>;

export const conditionSchema = z.strictObject({
  questionId: id,
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than"]),
  value: scalar,
});
export type Condition = z.infer<typeof conditionSchema>;

export function unique<T>(values: T[]) {
  return new Set(values).size === values.length;
}
