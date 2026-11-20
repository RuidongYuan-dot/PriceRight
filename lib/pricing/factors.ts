import type { Condition } from "../../schemas/common";
import type { PriceModifier } from "../../schemas/price.schema";
import type { Region } from "../../schemas/region.schema";
import type { Question, Service } from "../../schemas/service.schema";
import { matchesConditions } from "../question-engine/evaluate";

export type PriceFactor = { direction: "up" | "down"; label: string; detail: string };
export type PriceFactors = { up: PriceFactor[]; down: PriceFactor[] };

type Impact = { yuan: number; percent: number };
type Choice = {
  label: string;
  value: unknown;
  implicit: boolean;
  modifiers: PriceModifier[];
  applied: PriceModifier[];
  impact: Impact;
};

const zero: Impact = { yuan: 0, percent: 0 };

function compare(left: Impact, right: Impact) {
  if (left.yuan !== right.yuan) return left.yuan - right.yuan;
  return left.percent - right.percent;
}

function changesPrice(modifier: PriceModifier) {
  return modifier.type === "percentage" ? modifier.value > 0 : modifier.max > 0;
}

function sumImpact(modifiers: PriceModifier[]): Impact {
  const impact = { yuan: 0, percent: 0 };
  for (const modifier of modifiers) {
    if (!changesPrice(modifier)) continue;
    if (modifier.type === "percentage") impact.percent += modifier.value;
    else impact.yuan += modifier.max;
  }
  return impact;
}

// 限定在不同地区的附加费不会同时生效，比较选项时取较高的一组，并叠上未限定地区的附加费。
function pricedBundle(modifiers: PriceModifier[]) {
  const shared: PriceModifier[] = [];
  const groups = new Map<string, PriceModifier[]>();
  for (const modifier of modifiers) {
    if (!modifier.regionIds?.length) {
      shared.push(modifier);
      continue;
    }
    const key = [...modifier.regionIds].sort().join("\0");
    groups.set(key, [...(groups.get(key) ?? []), modifier]);
  }
  const bundles = groups.size ? [...groups.values()].map((group) => [...shared, ...group]) : [shared];
  let applied = bundles[0] ?? [];
  let impact = sumImpact(applied);
  for (const bundle of bundles.slice(1)) {
    const next = sumImpact(bundle);
    if (compare(next, impact) > 0) {
      applied = bundle;
      impact = next;
    }
  }
  return { applied, impact };
}

function uniqueLabels(modifiers: PriceModifier[]) {
  const labels: string[] = [];
  for (const modifier of modifiers) {
    if (changesPrice(modifier) && !labels.includes(modifier.label)) labels.push(modifier.label);
  }
  return labels;
}

function effectClause(modifiers: PriceModifier[]) {
  const parts: string[] = [];
  if (modifiers.some((modifier) => modifier.type === "per_unit" && changesPrice(modifier))) {
    parts.push("用量越高，这项费用越高");
  }
  if (modifiers.some((modifier) => modifier.type === "percentage" && changesPrice(modifier))) {
    parts.push("会按比例提高");
  }
  return parts.length ? parts.join("，") + "。" : "";
}

function quoted(value: string) {
  return `「${value}」`;
}

function questionById(questions: readonly Question[], id: string) {
  return questions.find((question) => question.id === id);
}

function formatValue(question: Question | undefined, value: Condition["value"]) {
  if (typeof value === "boolean") return value ? "是" : "否";
  const option = question?.options?.find((item) => item.value === value);
  return option?.label ?? String(value);
}

function describeCondition(condition: Condition, questions: readonly Question[]) {
  const question = questionById(questions, condition.questionId);
  const title = quoted(question?.title ?? condition.questionId);
  const value = formatValue(question, condition.value);
  switch (condition.operator) {
    case "equals":
      return `${title}为${quoted(value)}`;
    case "not_equals":
      return `${title}不是${quoted(value)}`;
    case "contains":
      return `${title}包含${quoted(value)}`;
    case "greater_than":
      return `${title}大于 ${value}`;
    case "less_than":
      return `${title}小于 ${value}`;
  }
}

function modifiersForChoice(service: Service, question: Question, value: unknown) {
  const answers = { [question.id]: value };
  const selected = new Set(Array.isArray(value) ? value : [value]);
  const fromOption = (question.options ?? [])
    .filter((option) => selected.has(option.value))
    .flatMap((option) => option.priceModifier ?? [])
    .filter((modifier) => matchesConditions(modifier.conditions, answers));
  const fromService = service.pricing.modifiers.filter((modifier) => {
    const mentions = (modifier.conditions ?? []).some((condition) => condition.questionId === question.id);
    return mentions && matchesConditions(modifier.conditions, answers);
  });
  const revealed = service.questions.filter(
    (item) =>
      item.id !== question.id &&
      Boolean(item.visibility?.length) &&
      matchesConditions(item.visibility, answers) &&
      !matchesConditions(item.visibility, {}),
  );
  const fromRevealed = service.pricing.modifiers.filter(
    (modifier) =>
      modifier.type === "per_unit" &&
      revealed.some((item) => item.id === modifier.unitQuestionId) &&
      matchesConditions(modifier.conditions, answers) &&
      !(modifier.conditions ?? []).some((condition) => condition.questionId === question.id),
  );
  return [...fromOption, ...fromService, ...fromRevealed];
}

function choicesFor(service: Service, question: Question): Choice[] {
  const raw =
    question.type === "boolean"
      ? [
          { label: "是", value: true },
          { label: "否", value: false },
        ]
      : (question.options ?? []).map((option) => ({
          label: option.label,
          value: question.type === "multiple" ? [option.value] : option.value,
        }));
  const choices: Choice[] = raw.map((choice) => {
    const modifiers = modifiersForChoice(service, question, choice.value);
    const bundle = pricedBundle(modifiers);
    return { ...choice, implicit: false, modifiers, applied: bundle.applied, impact: bundle.impact };
  });
  const raises = choices.length > 0 && choices.every((choice) => compare(choice.impact, zero) > 0);
  if (!question.required && raises) {
    choices.push({ label: "先不选", value: undefined, implicit: true, modifiers: [], applied: [], impact: { ...zero } });
  }
  return choices;
}

function downLabel(question: Question, choice: Choice) {
  if (choice.implicit) return `${quoted(question.title)}先不选`;
  if (question.type === "boolean") return `${quoted(question.title)}选${quoted(choice.label)}`;
  return choice.label;
}

function regionLabel(regions: readonly Region[], id: string) {
  return regions.find((region) => region.id === id)?.name ?? id;
}

export function priceInfluenceFactors(service: Service, regions: readonly Region[] = []): PriceFactors {
  const up: PriceFactor[] = [];
  const down: PriceFactor[] = [];
  const covered = new Set<PriceModifier>();

  for (const question of service.questions) {
    if (!["boolean", "single", "select", "multiple"].includes(question.type)) continue;
    const choices = choicesFor(service, question);
    for (const choice of choices) for (const modifier of choice.modifiers) covered.add(modifier);
    if (!choices.length) continue;
    let lowest = choices[0]?.impact ?? zero;
    let highest = lowest;
    for (const choice of choices) {
      if (compare(choice.impact, highest) > 0) highest = choice.impact;
      if (compare(choice.impact, lowest) < 0) lowest = choice.impact;
    }
    if (compare(highest, lowest) === 0) continue;
    const raised = uniqueLabels(choices.flatMap((choice) => (compare(choice.impact, lowest) > 0 ? choice.applied : [])));
    for (const choice of choices) {
      if (compare(choice.impact, lowest) <= 0) continue;
      const names = uniqueLabels(choice.applied);
      up.push({
        direction: "up",
        label: names.join("、") || choice.label,
        detail: `${quoted(question.title)}选择${quoted(choice.label)}时，会增加${names.length ? quoted(names.join("、")) : "费用"}。${effectClause(choice.modifiers)}`,
      });
    }
    for (const choice of choices) {
      if (compare(choice.impact, lowest) !== 0) continue;
      down.push({
        direction: "down",
        label: downLabel(question, choice),
        detail: raised.length
          ? `${quoted(question.title)}选择${quoted(choice.label)}时，不增加${quoted(raised.join("、"))}。`
          : `${quoted(question.title)}选择${quoted(choice.label)}时，参考价格更低。`,
      });
    }
  }

  const configured = [
    ...service.pricing.modifiers,
    ...service.questions.flatMap((question) => question.options?.flatMap((option) => option.priceModifier ?? []) ?? []),
  ];
  for (const modifier of configured) {
    if (covered.has(modifier) || !changesPrice(modifier) || !modifier.conditions?.length) continue;
    const when = modifier.conditions.map((condition) => describeCondition(condition, service.questions)).join("，且");
    up.push({
      direction: "up",
      label: modifier.label,
      detail: `${when}时，会增加${quoted(modifier.label)}。${effectClause([modifier])}`,
    });
    down.push({
      direction: "down",
      label: `不满足${quoted(modifier.label)}的条件`,
      detail: `不满足上述条件时，不增加${quoted(modifier.label)}。`,
    });
  }

  const unit = questionById(service.questions, service.pricing.unitQuestionId ?? "");
  if (unit && service.pricing.basePrice.max > 0) {
    up.push({
      direction: "up",
      label: unit.title,
      detail: `基础费用按${quoted(unit.title)}计算，用量越高，参考价格越高。`,
    });
  }

  for (const rule of service.pricing.regionRules) {
    const name = regionLabel(regions, rule.regionId);
    if (rule.multiplier !== undefined && rule.multiplier !== 1) {
      const higher = rule.multiplier > 1;
      (higher ? up : down).push({
        direction: higher ? "up" : "down",
        label: higher ? `${name}会上调价格` : `${name}会下调价格`,
        detail: higher
          ? `按服务配置，${quoted(name)}的参考价格会高于未按地区调整时的价格。`
          : `按服务配置，${quoted(name)}的参考价格会低于未按地区调整时的价格。`,
      });
    }
    if (rule.priceOverride) {
      const base = service.pricing.basePrice;
      const delta = BigInt(rule.priceOverride.min) + BigInt(rule.priceOverride.max) - (BigInt(base.min) + BigInt(base.max));
      if (delta !== 0n) {
        const higher = delta > 0n;
        (higher ? up : down).push({
          direction: higher ? "up" : "down",
          label: higher ? `${name}基础费用更高` : `${name}基础费用更低`,
          detail: higher
            ? `按服务配置，${quoted(name)}使用了更高的基础价格。`
            : `按服务配置，${quoted(name)}使用了更低的基础价格。`,
        });
      }
    }
  }

  return { up, down };
}
