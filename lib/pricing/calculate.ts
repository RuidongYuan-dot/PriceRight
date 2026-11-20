import { z } from "zod";
import type { Answer, PriceRange } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";
import type { PriceSample } from "../../schemas/price.schema";
import type { Region } from "../../schemas/region.schema";
import { evaluateQuestions, matchesConditions } from "../question-engine/evaluate";
import { regionCandidates } from "../region/resolve";
import { describeEvidence } from "./confidence";

export type PriceBreakdownItem = {
  source: "base" | "modifier" | "quantity" | "area" | "distance" | "region" | "minimum";
  label: string;
  operation: "add" | "replace";
  range: PriceRange;
};

export type MatchedSample = Pick<
  PriceSample,
  "id" | "price" | "currency" | "sampleType" | "regionId" | "source" | "collectedAt" | "verified" | "demo"
>;

type Evidence = ReturnType<typeof describeEvidence>;
type Estimate = Evidence & {
  status: "estimated";
  demo: boolean;
  currency: "CNY";
  range: PriceRange;
  typical: number;
  region: Region;
  breakdown: PriceBreakdownItem[];
  assumptions: string[];
  matchedSamples: MatchedSample[];
};
type Unavailable = {
  status: "insufficient_data";
  demo: boolean;
  range: null;
  sampleCount: 0;
  sources: [];
  matchedSamples: [];
  dataUpdatedAt: null;
  confidence: "low";
  warnings: string[];
};
export type PriceResult =
  | Estimate
  | Unavailable
  | {
      status: "invalid_input";
      errors: { questionId?: string; message: string }[];
    };
export type PriceData = {
  regions: Region[];
  samples: PriceSample[];
  /** 调用方传入的评估日（YYYY-MM-DD）。省略则不做时效判断；引擎自身不读取当前时间。 */
  asOf?: string;
};

// 用十进制整数比计算元 × 数量/系数，每一行四舍五入到元。
function scale(amount: number, factor: number, percent = false): number {
  const [mantissa, exponent = "0"] = String(factor).split("e");
  const [whole, decimal = ""] = mantissa.split(".");
  const power = Number(exponent) - decimal.length - (percent ? 2 : 0);
  const numerator = BigInt(amount) * BigInt(whole + decimal) * 10n ** BigInt(Math.max(0, power));
  const divisor = 10n ** BigInt(Math.max(0, -power));
  return safeAmount((numerator + divisor / 2n) / divisor);
}

function safeAmount(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("计算金额超出支持范围");
  return Number(value);
}

// 奇数个样本取中位；偶数个取中间两数的算术平均，非负整数按四舍五入（.5 向上）到元。
function medianYuan(prices: readonly number[]): number {
  if (!prices.length) throw new RangeError("没有可用于常见价格的样本");
  const sorted = [...prices].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const right = sorted[mid]!;
  if (sorted.length % 2 === 1) return right;
  const total = BigInt(sorted[mid - 1]!) + BigInt(right);
  return safeAmount((total + (total % 2n)) / 2n);
}

function scaled(range: PriceRange, factor: number, percent = false): PriceRange {
  return { min: scale(range.min, factor, percent), max: scale(range.max, factor, percent) };
}

function summarizeMatchedSamples(samples: readonly PriceSample[]): MatchedSample[] {
  return samples
    .map((sample) => ({
      id: sample.id,
      price: sample.price,
      currency: sample.currency,
      sampleType: sample.sampleType,
      regionId: sample.regionId,
      source: sample.source,
      collectedAt: sample.collectedAt,
      verified: sample.verified,
      demo: sample.demo,
    }))
    .sort((left, right) => {
      if (left.collectedAt !== right.collectedAt) return left.collectedAt < right.collectedAt ? -1 : 1;
      if (left.id !== right.id) return left.id < right.id ? -1 : 1;
      return 0;
    });
}

function sameAnswer(left: Answer | undefined, right: Answer): boolean {
  if (!Array.isArray(right)) return left === right;
  return Array.isArray(left) && left.length === right.length && right.every((value) => left.includes(value));
}

function calculateRange(service: Service, answers: Record<string, Answer>, matched: Region) {
  const p = service.pricing;
  const rule = p.regionRules.find((r) => r.regionId === matched.id);
  const breakdown: PriceBreakdownItem[] = [];
  let range = { min: 0, max: 0 };
  function line(
    source: PriceBreakdownItem["source"],
    label: string,
    value: PriceRange,
    operation: PriceBreakdownItem["operation"] = "add",
  ) {
    range =
      operation === "replace"
        ? value
        : {
            min: safeAmount(BigInt(range.min) + BigInt(value.min)),
            max: safeAmount(BigInt(range.max) + BigInt(value.max)),
          };
    breakdown.push({ source, label, operation, range: { min: value.min, max: value.max } });
  }
  function units(id: string) {
    const n = answers[id];
    if (typeof n !== "number" || n < 0) throw new RangeError("请填写有效的非负计量值");
    return n;
  }
  const base = rule?.priceOverride ?? p.basePrice;
  // 基础价为 0 且不按它乘数量时，金额来自附加项，不另画一条 0 元基础价格。
  if (p.unitQuestionId !== undefined || base.min !== 0 || base.max !== 0) {
    line("base", rule?.priceOverride ? matched.name + "基础价格" : "基础价格", base);
    if (p.unitQuestionId) {
      const question = service.questions.find((q) => q.id === p.unitQuestionId)!;
      const n = units(question.id);
      const source = question.type === "area" || question.type === "distance" ? question.type : "quantity";
      line(source, question.title + " × " + n, scaled(base, n), "replace");
    }
  }
  const modifiers = [...p.modifiers];
  for (const q of service.questions) {
    const selected = answers[q.id];
    for (const option of q.options ?? []) {
      if (Array.isArray(selected) ? selected.includes(option.value) : selected === option.value) {
        modifiers.push(...(option.priceModifier ?? []));
      }
    }
  }
  const active = modifiers.filter(
    (m) =>
      (m.regionIds === undefined || m.regionIds.includes(matched.id)) && matchesConditions(m.conditions, answers),
  );
  for (const m of active) {
    if (m.type === "fixed") line("modifier", m.label, m);
    if (m.type === "per_unit" && Object.hasOwn(answers, m.unitQuestionId)) {
      line("modifier", m.label, scaled(m, units(m.unitQuestionId)));
    }
  }
  const subtotal = range;
  for (const m of active) {
    if (m.type === "percentage") line("modifier", m.label, scaled(subtotal, m.value, true));
  }
  if (rule?.multiplier !== undefined)
    line("region", matched.name + "系数 × " + rule.multiplier, scaled(range, rule.multiplier), "replace");
  if (p.minimumPrice !== undefined && range.min < p.minimumPrice) {
    line("minimum", "最低收费", { min: p.minimumPrice, max: Math.max(range.max, p.minimumPrice) }, "replace");
  }
  return { range, breakdown };
}

export function calculatePrice(
  service: Service,
  input: Readonly<Record<string, unknown>>,
  regionId: string,
  data: PriceData,
): PriceResult {
  const state = evaluateQuestions(service.questions, input);
  if (!state.complete) return { status: "invalid_input", errors: state.errors };
  const candidates = regionCandidates(regionId, data.regions);
  if (!candidates.length) return { status: "invalid_input", errors: [{ message: "请选择有效地区" }] };
  if (data.asOf !== undefined && !z.iso.date().safeParse(data.asOf).success)
    return { status: "invalid_input", errors: [{ message: "数据评估日期无效" }] };
  const eligible = data.samples.filter(
    (s) =>
      s.verified &&
      s.demo === service.demo &&
      s.serviceId === service.id &&
      (!data.asOf || s.collectedAt <= data.asOf) &&
      Object.entries(s.conditions ?? {}).every(([key, value]) => sameAnswer(state.answers[key], value)),
  );
  if (service.status === "active") {
    for (const region of candidates) {
      const samples = eligible.filter((s) => s.regionId === region.id);
      if (!samples.length) continue;
      const evidence = describeEvidence(samples, region, service.pricing.minimumSampleCount, data.asOf);
      const local = region.id === regionId;
      const basis = local ? "使用" + region.name + "数据" : "本地数据不足，使用" + region.name + "参考数据";
      try {
        return {
          status: "estimated",
          currency: "CNY",
          demo: service.demo,
          region,
          typical: medianYuan(samples.map((sample) => sample.price)),
          ...evidence,
          ...calculateRange(service, state.answers, region),
          assumptions: [basis],
          matchedSamples: summarizeMatchedSamples(samples),
        };
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        return { status: "invalid_input", errors: [{ message: error.message }] };
      }
    }
  }
  return {
    status: "insufficient_data",
    demo: service.demo,
    sampleCount: 0,
    sources: [],
    matchedSamples: [],
    dataUpdatedAt: null,
    confidence: "low",
    range: null,
    warnings: ["目前暂无足够的可用价格数据，暂不能提供可靠参考价格。"],
  };
}
