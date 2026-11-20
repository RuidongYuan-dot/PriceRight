import { z } from "zod";
import { unique, type Condition } from "../../schemas/common";
import { priceSampleSchema } from "../../schemas/price.schema";
import { regionSchema } from "../../schemas/region.schema";
import { categorySchema, serviceSchema, type Question, type Service } from "../../schemas/service.schema";
import { validateAnswer } from "../question-engine/evaluate";

export const collections = {
  categories: categorySchema,
  services: serviceSchema,
  regions: regionSchema,
  "price-samples": priceSampleSchema,
};
export type Catalog = { [K in keyof typeof collections]: z.infer<(typeof collections)[K]>[] };
export type Collection = keyof Catalog;

function checkCondition(condition: Condition, questions: Question[]) {
  const q = questions.find((q) => q.id === condition.questionId);
  if (!q) return "引用了不存在或尚未出现的问题";
  switch (condition.operator) {
    case "contains":
      return q.type === "multiple" && q.options?.some((o) => o.value === condition.value)
        ? null
        : "contains 需要有效的多选值";
    case "less_than":
    case "greater_than":
      return ["number", "area", "distance"].includes(q.type) && typeof condition.value === "number"
        ? null
        : "大小比较需要数值问题和值";
    default:
      return validateAnswer(q, condition.value).valid ? null : "条件值与问题不匹配";
  }
}

function checkService(s: Service, data: Catalog): string[] {
  const errors: string[] = [];
  const checkConditions = (items: Condition[] = [], questions = s.questions) => {
    for (const c of items) {
      const error = checkCondition(c, questions);
      if (error) errors.push(c.questionId + " " + error);
    }
  };
  const checkUnit = (key: string, types: string[], base: boolean) => {
    const q = s.questions.find((q) => q.id === key);
    if (!q || !types.includes(q.type)) errors.push(key + " 计量问题类型不匹配");
    else if (base && (!q.required || q.visibility?.length))
      errors.push(key + " 基础计量问题必须始终显示且必填");
  };
  if (!data.categories.some((c) => c.id === s.categoryId)) errors.push("未知分类 " + s.categoryId);
  s.questions.forEach((q, i) => checkConditions(q.visibility, s.questions.slice(0, i)));
  const { model, unitQuestionId, modifiers, regionRules } = s.pricing;
  if (unitQuestionId) {
    const types =
      model === "composite"
        ? ["number", "area", "distance"]
        : [model === "area" || model === "distance" ? model : "number"];
    checkUnit(unitQuestionId, types, true);
  }
  for (const m of [
    ...modifiers,
    ...s.questions.flatMap((q) => q.options?.flatMap((o) => o.priceModifier ?? []) ?? []),
  ]) {
    checkConditions(m.conditions);
    if (m.type === "per_unit") checkUnit(m.unitQuestionId, ["number", "area", "distance"], false);
    for (const regionId of m.regionIds ?? []) {
      if (!data.regions.some((region) => region.id === regionId)) errors.push("未知附加费地区 " + regionId);
    }
  }
  for (const rule of regionRules) {
    if (!data.regions.some((r) => r.id === rule.regionId)) errors.push("未知定价地区 " + rule.regionId);
  }
  return errors.map((error) => s.id + " " + error);
}

export function validateCatalog(data: Catalog, demo: boolean): string[] {
  const errors: string[] = [];
  for (const [key, entries] of Object.entries(data)) {
    if (!unique(entries.map((e: { id: string }) => e.id))) errors.push(key + " ID 重复");
  }
  if (!unique(data.services.map((s) => s.slug))) errors.push("服务 slug 重复");
  if (data.regions.filter((r) => r.level === "national").length > 1) errors.push("全国地区重复");
  if (!unique(data.regions.filter((r) => r.level === "city_tier").map((r) => r.tier)))
    errors.push("城市等级重复");
  for (const r of data.regions) {
    if (r.parentId && !data.regions.some((p) => p.id === r.parentId && p.level === "province"))
      errors.push(r.id + " 所属省份无效");
  }
  for (const s of data.services) {
    if (s.demo !== demo) errors.push(s.id + " demo 标记与数据目录不符");
    errors.push(...checkService(s, data));
  }
  for (const sample of data["price-samples"]) {
    if (sample.demo !== demo) errors.push(sample.id + " demo 标记与数据目录不符");
    if (!data.regions.some((r) => r.id === sample.regionId)) errors.push(sample.id + " 未知样本地区");
    const service = data.services.find((s) => s.id === sample.serviceId);
    if (!service) errors.push(sample.id + " 未知样本服务");
    for (const [key, value] of Object.entries(sample.conditions ?? {})) {
      const q = service?.questions.find((q) => q.id === key);
      if (!q || !validateAnswer(q, value).valid) errors.push(sample.id + " 无效样本条件 " + key);
    }
  }
  return errors;
}
