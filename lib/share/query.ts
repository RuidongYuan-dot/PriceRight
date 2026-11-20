import { z } from "zod";
import { id, type Answer } from "../../schemas/common";
import type { Question } from "../../schemas/service.schema";
import { evaluateQuestions, isQuestionVisible, validateAnswer } from "../question-engine/evaluate";

/**
 * 分享链接只使用 URL 查询参数，不依赖登录或服务端会话。
 *
 * `region` 是地区 id。其余参数名来自当前服务的问题 id，因此同一套编解码适用于任何服务配置。
 * 布尔值写成 `true` / `false`，数字写成普通十进制，单选和多选写成选项的 `value`。
 * 多选重复同一个参数名。选项值若会编成相同文本，该题改用 `b:`、`n:`、`s:` 前缀区分类型。
 * 问题 id 恰好是 `region` 时，答案使用 `~region`，避免和地区参数冲突。
 *
 * 例：`?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false`
 */
export const SHARE_SEARCH_MAX = 8_000;
export const SHARE_VALUE_MAX = 500;
export const SHARE_PARAM_MAX = 200;
export const REGION_PARAM = "region";

const REGION_QUESTION_PARAM = "~region";
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
type Scalar = string | number | boolean;

export const SHARE_FEEDBACK = {
  blocked: "分享链接无法使用，已忽略全部参数。请重新填写问卷。",
  partialInvalid: "链接中有部分参数无效，已忽略，并恢复了其余有效选择。",
  invalid: "链接中的参数无效，已全部忽略。请重新填写问卷。",
  partial: "已从分享链接恢复部分选择，请继续完成剩余问题。",
  restored: "已根据分享链接恢复查询条件，并重新计算。",
} as const;

export type ShareFeedback = { tone: "info" | "warning"; message: string };

export type DecodedShareQuery = {
  answers: Record<string, Answer>;
  regionId?: string;
  feedback: ShareFeedback[];
  /** 可见必填项都已通过校验，且地区 id 属于给定地区列表。 */
  ready: boolean;
};

export type AnswerSummary = { questionId: string; title: string; value: string };

type OptionCodec = {
  encode: Map<Scalar, string>;
  decode: Map<string, Scalar>;
};

const rawValue = z.string().max(SHARE_VALUE_MAX);
const decimalValue = z.string().max(64).regex(DECIMAL);
const booleanValue = z.enum(["true", "false"]);
const paramName = z.string().min(1).max(SHARE_VALUE_MAX);

function encodeNumber(value: number): string | undefined {
  if (!Number.isFinite(value)) return undefined;
  const normalized = Object.is(value, -0) ? 0 : value;
  const text = String(normalized);
  const canonical = /e/i.test(text) ? expandExponent(text) : text;
  if (!DECIMAL.test(canonical) || canonical.length > 64 || Number(canonical) !== normalized) return undefined;
  return canonical;
}

function expandExponent(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const sign = match[1];
  const whole = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 40) return text;
  const digits = whole + fraction;
  const point = whole.length + exponent;
  let body: string;
  if (point <= 0) body = `0.${"0".repeat(-point)}${digits}`;
  else if (point >= digits.length) body = digits + "0".repeat(point - digits.length);
  else body = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return sign + body;
}

function plainEncode(value: Scalar): string | undefined {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return encodeNumber(value);
  return value;
}

function typedEncode(value: Scalar): string | undefined {
  if (typeof value === "boolean") return value ? "b:true" : "b:false";
  if (typeof value === "number") {
    const encoded = encodeNumber(value);
    return encoded === undefined ? undefined : `n:${encoded}`;
  }
  return `s:${value}`;
}

function optionCodec(question: Question): OptionCodec | undefined {
  const options = question.options ?? [];
  if (!options.length) return undefined;
  const plains = options.map((option) => plainEncode(option.value));
  if (plains.some((item) => item === undefined)) return undefined;
  const collided = plains.some((item, index) => plains.some((other, otherIndex) => index !== otherIndex && other === item));
  const codec: OptionCodec = { encode: new Map(), decode: new Map() };
  for (const option of options) {
    const token = collided ? typedEncode(option.value) : plainEncode(option.value);
    if (token === undefined || token.length > SHARE_VALUE_MAX || codec.decode.has(token)) return undefined;
    codec.encode.set(option.value, token);
    codec.decode.set(token, option.value);
  }
  return codec;
}

function answerParamName(questionId: string) {
  return questionId === REGION_PARAM ? REGION_QUESTION_PARAM : questionId;
}

function encodeAnswer(question: Question, value: Answer): string[] | undefined {
  if (question.type === "boolean") return typeof value === "boolean" ? [value ? "true" : "false"] : undefined;
  if (question.type === "number" || question.type === "area" || question.type === "distance") {
    if (typeof value !== "number") return undefined;
    const encoded = encodeNumber(value);
    return encoded === undefined ? undefined : [encoded];
  }
  const codec = optionCodec(question);
  if (!codec) return undefined;
  const selected = Array.isArray(value) ? value : [value];
  const tokens: string[] = [];
  for (const option of question.options ?? []) {
    if (!selected.includes(option.value)) continue;
    const token = codec.encode.get(option.value);
    if (token === undefined) return undefined;
    tokens.push(token);
  }
  return tokens.length === selected.length ? tokens : undefined;
}

function decodeAnswer(question: Question, raws: readonly string[]): Answer | undefined {
  if (question.type === "multiple") {
    const codec = optionCodec(question);
    if (!codec || !raws.length) return undefined;
    const values: Scalar[] = [];
    for (const raw of raws) {
      if (!rawValue.safeParse(raw).success || !codec.decode.has(raw)) return undefined;
      values.push(codec.decode.get(raw)!);
    }
    const canonical = (question.options ?? [])
      .map((option) => option.value)
      .filter((optionValue) => values.includes(optionValue));
    if (canonical.length !== values.length || !validateAnswer(question, canonical).valid) return undefined;
    return canonical;
  }
  if (raws.length !== 1 || !rawValue.safeParse(raws[0]).success) return undefined;
  const raw = raws[0];
  let value: Answer | undefined;
  if (question.type === "boolean") {
    const parsed = booleanValue.safeParse(raw);
    if (!parsed.success) return undefined;
    value = parsed.data === "true";
  } else if (question.type === "number" || question.type === "area" || question.type === "distance") {
    const parsed = decimalValue.safeParse(raw);
    if (!parsed.success) return undefined;
    const number = Number(parsed.data);
    if (!Number.isFinite(number)) return undefined;
    value = Object.is(number, -0) ? 0 : number;
  } else {
    const codec = optionCodec(question);
    if (!codec?.decode.has(raw)) return undefined;
    value = codec.decode.get(raw);
  }
  return value !== undefined && validateAnswer(question, value).valid ? value : undefined;
}

function formatAnswer(question: Question, value: Answer): string | undefined {
  if (question.type === "boolean" && typeof value === "boolean") return value ? "是" : "否";
  if (question.type === "multiple" && Array.isArray(value)) {
    const labels = (question.options ?? [])
      .filter((option) => value.includes(option.value))
      .map((option) => option.label);
    return labels.length ? labels.join("、") : undefined;
  }
  const option = question.options?.find((item) => item.value === value);
  if (option) return option.label;
  if (typeof value !== "number") return undefined;
  const text = encodeNumber(value);
  if (text === undefined) return undefined;
  if (question.type === "area") return `${text} 平方米`;
  if (question.type === "distance") return `${text} 公里`;
  if (question.type === "number") return text;
  return undefined;
}

function readEntries(search: string): { blocked: true } | { blocked: false; entries: [string, string][] } {
  const body = search.startsWith("?") ? search.slice(1) : search;
  if (!z.string().max(SHARE_SEARCH_MAX).safeParse(body).success) return { blocked: true };
  try {
    const entries = [...new URLSearchParams(body)];
    if (entries.length > SHARE_PARAM_MAX) return { blocked: true };
    return { blocked: false, entries };
  } catch {
    return { blocked: true };
  }
}

function feedbackFor(blocked: boolean, issues: number, restored: boolean, ready: boolean): ShareFeedback[] {
  if (blocked) return [{ tone: "warning", message: SHARE_FEEDBACK.blocked }];
  if (issues > 0) {
    return [{ tone: "warning", message: restored ? SHARE_FEEDBACK.partialInvalid : SHARE_FEEDBACK.invalid }];
  }
  if (!restored) return [];
  return [{ tone: "info", message: ready ? SHARE_FEEDBACK.restored : SHARE_FEEDBACK.partial }];
}

export function encodeShareQuery(
  questions: readonly Question[],
  input: Readonly<Record<string, unknown>>,
  regionId: string | undefined,
  regions: readonly { id: string }[],
): string {
  const state = evaluateQuestions([...questions], input);
  const params = new URLSearchParams();
  if (regionId && id.safeParse(regionId).success && regions.some((region) => region.id === regionId)) {
    params.set(REGION_PARAM, regionId);
  }
  for (const question of state.visible) {
    const value = state.answers[question.id];
    if (value === undefined) continue;
    const tokens = encodeAnswer(question, value);
    if (!tokens) continue;
    const name = answerParamName(question.id);
    for (const token of tokens) params.append(name, token);
  }
  return params.toString();
}

export function decodeShareQuery(
  questions: readonly Question[],
  search: string,
  regions: readonly { id: string }[],
): DecodedShareQuery {
  const parsed = readEntries(search);
  if (parsed.blocked) {
    return { answers: {}, feedback: feedbackFor(true, 0, false, false), ready: false };
  }

  const groups = new Map<string, { values: string[]; damaged: boolean }>();
  let issues = 0;
  for (const [key, value] of parsed.entries) {
    const name = paramName.safeParse(key);
    if (!name.success) {
      issues += 1;
      continue;
    }
    const group = groups.get(name.data) ?? { values: [], damaged: false };
    if (!rawValue.safeParse(value).success) group.damaged = true;
    else group.values.push(value);
    groups.set(name.data, group);
  }

  let regionId: string | undefined;
  const regionGroup = groups.get(REGION_PARAM);
  if (regionGroup) {
    groups.delete(REGION_PARAM);
    const [only] = regionGroup.values;
    const valid =
      !regionGroup.damaged &&
      regionGroup.values.length === 1 &&
      only !== undefined &&
      id.safeParse(only).success &&
      regions.some((region) => region.id === only);
    if (valid) regionId = only;
    else issues += 1;
  }

  const draft: Record<string, Answer> = Object.create(null);
  const consumed = new Set<string>();
  for (const question of questions) {
    const name = answerParamName(question.id);
    const group = groups.get(name);
    if (!group) continue;
    consumed.add(name);
    if (group.damaged || !isQuestionVisible(question, draft)) {
      issues += 1;
      continue;
    }
    const value = decodeAnswer(question, group.values);
    if (value === undefined) {
      issues += 1;
      continue;
    }
    draft[question.id] = value;
  }
  for (const name of groups.keys()) {
    if (!consumed.has(name)) issues += 1;
  }

  const answers: Record<string, Answer> = {};
  for (const question of questions) {
    if (Object.hasOwn(draft, question.id)) answers[question.id] = draft[question.id];
  }
  const restored = regionId !== undefined || Object.keys(answers).length > 0;
  const ready = regionId !== undefined && evaluateQuestions([...questions], answers).complete;
  return {
    answers,
    ...(regionId !== undefined ? { regionId } : {}),
    feedback: feedbackFor(false, issues, restored, ready),
    ready,
  };
}

export function describeShareAnswers(
  questions: readonly Question[],
  input: Readonly<Record<string, unknown>>,
): AnswerSummary[] {
  const state = evaluateQuestions([...questions], input);
  const summaries: AnswerSummary[] = [];
  for (const question of state.visible) {
    const value = state.answers[question.id];
    if (value === undefined) continue;
    const label = formatAnswer(question, value);
    if (label === undefined) continue;
    summaries.push({ questionId: question.id, title: question.title, value: label });
  }
  return summaries;
}

/** 用当前页面的 origin、basePath 和路径替换查询串，得到可复制的绝对地址。 */
export function shareHref(pageHref: string, query: string): string {
  const url = new URL(pageHref);
  const serialized = new URLSearchParams(query).toString();
  url.search = serialized ? `?${serialized}` : "";
  url.hash = "";
  return `${url.origin}${url.pathname}${url.search}`;
}
