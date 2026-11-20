import type { Answer, Condition, PriceRange } from "../../schemas/common";
import type { PriceModifier } from "../../schemas/price.schema";
import type { Question, Service } from "../../schemas/service.schema";
import { evaluateQuestions, matchesConditions } from "../question-engine/evaluate";

/**
 * 从服务配置收集附加项，并生成可复制的询价确认清单。
 *
 * 某项是否「适用」与计价引擎使用同一套配置规则：只看已通过校验的可见答案；
 * 先取服务级 `modifiers`，再按问题与选项顺序加入被选中选项的 `priceModifier`。
 * 附加项自身的 `conditions` 必须全部成立；`per_unit` 还要求绑定题目出现在有效答案里。
 * 本模块不计算金额，也不读取时钟或网络。
 */
export const CHECKLIST_COPY = {
  title: "给师傅的询价确认清单",
  insufficient: "暂无公开参考区间，请要求对方先报总价明细",
  officialLabel: "合理参考价格",
  demoLabel: "演示价格区间",
  demoNote: "合成演示数据，请勿作为实际询价依据",
  noIncluded: "（服务配置未列出包含项，请要求对方说明报价包含什么）",
  noExcluded: "（服务配置未列出不含项，请要求对方说明哪些内容不在报价内）",
  noApplicable: "（当前选择下没有需要计入的配置附加项）",
  noRemaining: "（没有其他未计入的配置附加项）",
  noSurcharge: "（当前服务配置未列出附加项，请要求对方说明现场加价规则）",
  noConditions: "（未记录具体条件）",
  regionMissing: "未选择",
  serviceMissing: "未命名服务",
} as const;

export type ChecklistQuote =
  | { status: "estimated"; demo: boolean; range: PriceRange }
  | { status: "insufficient_data"; demo: boolean };

export type ConfiguredSurcharge = {
  key: string;
  label: string;
  /** 含触发条件与计量方式的一行说明，可直接展示或写入清单。 */
  detail: string;
  /** 按当前可见且有效的答案，这项会进入价格计算。未提供答案时恒为 false。 */
  applicable: boolean;
};

export type InquiryChecklistInput = {
  service: Service;
  regionName: string;
  summaries: readonly { title: string; value: string }[];
  result: ChecklistQuote;
  answers: Readonly<Record<string, unknown>>;
};

const yuan = new Intl.NumberFormat("zh-CN");

function oneLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/[ \t\f\v]{2,}/g, " ").trim();
}

function formatRange(range: PriceRange): string {
  const min = yuan.format(range.min);
  if (range.min === range.max) return `¥${min}`;
  return `¥${min}–${yuan.format(range.max)}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "一定比例";
  return `${Object.is(value, -0) ? "0" : String(value)}%`;
}

function valueLabel(question: Question | undefined, value: Condition["value"]): string {
  if (question?.type === "boolean" && typeof value === "boolean") return value ? "是" : "否";
  const option = question?.options?.find((item) => item.value === value);
  if (option) return option.label;
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function shownValue(value: Condition["value"], label: string): string {
  return typeof value === "number" ? label : `「${label}」`;
}

function conditionClause(service: Service, condition: Condition): string {
  const question = service.questions.find((item) => item.id === condition.questionId);
  const title = question?.title ?? "相关问题";
  const label = valueLabel(question, condition.value);
  const shown = shownValue(condition.value, label);
  switch (condition.operator) {
    case "equals":
      return `「${title}」为${shown}`;
    case "not_equals":
      return `「${title}」不为${shown}`;
    case "contains":
      return `「${title}」包含${shown}`;
    case "greater_than":
      return `「${title}」大于${typeof condition.value === "number" ? ` ${label}` : shown}`;
    case "less_than":
      return `「${title}」小于${typeof condition.value === "number" ? ` ${label}` : shown}`;
  }
}

function basisClause(service: Service, modifier: PriceModifier): string | undefined {
  if (modifier.type === "per_unit") {
    const title = service.questions.find((item) => item.id === modifier.unitQuestionId)?.title ?? "计量值";
    return `按「${title}」计`;
  }
  if (modifier.type === "percentage") return `按小计的 ${formatPercent(modifier.value)} 计`;
  return undefined;
}

function surchargeDetail(service: Service, modifier: PriceModifier, optionLabel?: string): string {
  const hints: string[] = [];
  if (optionLabel) hints.push(`选择「${optionLabel}」时`);
  if (modifier.conditions?.length) {
    hints.push(`当${modifier.conditions.map((condition) => conditionClause(service, condition)).join("且")}`);
  }
  const basis = basisClause(service, modifier);
  if (basis) hints.push(basis);
  return hints.length ? `${modifier.label}（${hints.join("，")}）` : modifier.label;
}

function isSelected(answer: Answer | undefined, value: string | number | boolean): boolean {
  return Array.isArray(answer) ? answer.includes(value) : answer === value;
}

function isCharged(modifier: PriceModifier, answers: Record<string, Answer>): boolean {
  if (!matchesConditions(modifier.conditions, answers)) return false;
  if (modifier.type === "per_unit" && !Object.hasOwn(answers, modifier.unitQuestionId)) return false;
  return true;
}

export function listConfiguredSurcharges(
  service: Service,
  input?: Readonly<Record<string, unknown>>,
): ConfiguredSurcharge[] {
  const answers = input === undefined ? undefined : evaluateQuestions(service.questions, input).answers;
  const items: ConfiguredSurcharge[] = [];
  service.pricing.modifiers.forEach((modifier, index) => {
    items.push({
      key: `pricing:${index}`,
      label: modifier.label,
      detail: surchargeDetail(service, modifier),
      applicable: answers !== undefined && isCharged(modifier, answers),
    });
  });
  for (const question of service.questions) {
    for (const option of question.options ?? []) {
      option.priceModifier?.forEach((modifier, index) => {
        items.push({
          key: `option:${question.id}:${option.id}:${index}`,
          label: modifier.label,
          detail: surchargeDetail(service, modifier, option.label),
          applicable:
            answers !== undefined &&
            isSelected(answers[question.id], option.value) &&
            isCharged(modifier, answers),
        });
      });
    }
  }
  return items;
}

function bullets(items: readonly string[], empty: string): string[] {
  return (items.length ? items : [empty]).map((item) => `- ${item}`);
}

function referenceLine(result: ChecklistQuote): string {
  if (result.status !== "estimated") {
    const note = result.demo ? `（${CHECKLIST_COPY.demoNote}）` : "";
    return `参考：${CHECKLIST_COPY.insufficient}${note}`;
  }
  const amount = formatRange(result.range);
  if (result.demo) return `参考：${CHECKLIST_COPY.demoLabel} ${amount}（${CHECKLIST_COPY.demoNote}）`;
  return `参考：${CHECKLIST_COPY.officialLabel} ${amount}`;
}

function closing(result: ChecklistQuote): string {
  if (result.status !== "estimated") {
    const demo = result.demo ? "当前结果来自合成演示数据，不能当作市场价格。" : "";
    return `${demo}目前没有足够的公开价格数据，不能提供可靠参考区间。请要求对方先报总价明细，并逐项确认上面的范围。`;
  }
  if (result.demo) return "以上区间是合成演示数据，不能当作实际询价依据。请让对方报出总价明细，并确认上面的范围。";
  return "以上是市场参考价格，不代表最终成交价格。请让对方报出总价明细，并确认上面的范围。";
}

export function buildInquiryChecklist({
  service,
  regionName,
  summaries,
  result,
  answers,
}: InquiryChecklistInput): string {
  const surcharges = listConfiguredSurcharges(service, answers);
  const applicable = surcharges.filter((item) => item.applicable).map((item) => item.detail);
  const remaining = surcharges.filter((item) => !item.applicable).map((item) => item.detail);
  const conditions = summaries.flatMap((item) => {
    const title = oneLine(item.title);
    const value = oneLine(item.value);
    return title && value ? [`${title}：${value}`] : [];
  });
  const included = service.scope.included.map(oneLine).filter((item) => item.length > 0);
  const excluded = service.scope.excluded.map(oneLine).filter((item) => item.length > 0);

  return [
    CHECKLIST_COPY.title,
    `服务：${oneLine(service.name) || CHECKLIST_COPY.serviceMissing}`,
    `地区：${oneLine(regionName) || CHECKLIST_COPY.regionMissing}`,
    "",
    "已选条件：",
    ...bullets(conditions, CHECKLIST_COPY.noConditions),
    "",
    referenceLine(result),
    "",
    "请确认本次报价是否包含：",
    ...bullets(included, CHECKLIST_COPY.noIncluded),
    "",
    "请确认以下项目是否另计：",
    ...bullets(excluded, CHECKLIST_COPY.noExcluded),
    "",
    "请确认这些附加项是否已包含在对方总价中：",
    ...bullets(applicable, surcharges.length ? CHECKLIST_COPY.noApplicable : CHECKLIST_COPY.noSurcharge),
    "",
    "以下情况当前选择未计入，请先问清是否另收费：",
    ...bullets(remaining, CHECKLIST_COPY.noRemaining),
    "",
    closing(result),
  ].join("\n");
}
