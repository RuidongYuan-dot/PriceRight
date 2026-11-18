import { z } from "zod";
import { id, text } from "./common";

export const regionSchema = z
  .strictObject({
    id,
    name: text,
    level: z.enum(["city", "province", "city_tier", "national"]),
    tier: z.enum(["tier_1", "new_tier_1", "tier_2", "other"]).optional(),
    parentId: id.optional(),
  })
  .refine((r) => !r.parentId || r.level === "city", "只有城市可指定所属省份")
  .refine((r) => r.level !== "city_tier" || r.tier !== undefined, "城市等级记录必须指定 tier")
  .refine((r) => !r.tier || ["city", "city_tier"].includes(r.level), "该地区类型不能指定 tier");
export type Region = z.infer<typeof regionSchema>;
