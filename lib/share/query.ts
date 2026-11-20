import { z } from "zod";
import type { Answer } from "../../schemas/common";
import type { Region } from "../../schemas/region.schema";
import type { Question, Service } from "../../schemas/service.schema";
import { validateAnswer } from "../question-engine/evaluate";
import { regionChoices } from "../region/choices";

const REGION_PARAM = "city";
const AS_OF_PARAM = "asOf";

function answerKey(questionId: string) {
  return `a.${questionId}`;
}

function paramsFrom(search: string) {
  const withoutHash = search.split("#")[0] ?? "";
  const query = withoutHash.includes("?") ? withoutHash.slice(withoutHash.indexOf("?") + 1) : withoutHash.replace(/^\?/, "");
  return new URLSearchParams(query);
}

function parseScalar(question: Question, raw: string): Answer | undefined {
  if (raw.trim() === "" || raw !== raw.trim()) return undefined;
  if (question.type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return undefined;
  }
  if (question.type === "number" || question.type === "area" || question.type === "distance") {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  const matches = (question.options ?? []).filter((option) => String(option.value) === raw);
  return matches.length === 1 ? matches[0]?.value : undefined;
}

function parseAnswer(question: Question, rawValues: string[]): Answer | undefined {
  if (question.type === "multiple") {
    const values = rawValues.map((raw) => parseScalar({ ...question, type: "single" }, raw));
    if (values.some((value) => value === undefined)) return undefined;
    return values as Answer;
  }
  if (rawValues.length !== 1) return undefined;
  return parseScalar(question, rawValues[0] ?? "");
}

export function encodeShareQuery(
  service: Service,
  answers: Readonly<Record<string, Answer>>,
  regionId: string,
  asOf: string,
) {
  const params = new URLSearchParams();
  params.set(REGION_PARAM, regionId);
  params.set(AS_OF_PARAM, asOf);
  for (const question of service.questions) {
    if (!Object.hasOwn(answers, question.id)) continue;
    const answer = answers[question.id];
    if (answer === undefined) continue;
    for (const value of Array.isArray(answer) ? answer : [answer]) {
      params.append(answerKey(question.id), String(value));
    }
  }
  return `?${params.toString()}`;
}

export type DecodedShare = {
  answers: Record<string, Answer>;
  regionId?: string;
  asOf?: string;
};

// 非法地区、非法日期和非法答案都丢弃，不抛错。省份、城市等级不能通过城市选择器恢复。
export function decodeShareQuery(service: Service, regions: readonly Region[], search: string): DecodedShare {
  const params = paramsFrom(search);
  const answers: Record<string, Answer> = Object.create(null);
  for (const question of service.questions) {
    const rawValues = params.getAll(answerKey(question.id));
    if (!rawValues.length) continue;
    const answer = parseAnswer(question, rawValues);
    if (answer !== undefined && validateAnswer(question, answer).valid) answers[question.id] = answer;
  }
  const requested = params.get(REGION_PARAM);
  const regionId =
    requested && regionChoices(regions).some((choice) => choice.id === requested) ? requested : undefined;
  const rawAsOf = params.get(AS_OF_PARAM);
  const asOf = rawAsOf && z.iso.date().safeParse(rawAsOf).success ? rawAsOf : undefined;
  return { answers, regionId, asOf };
}
