import type { Answer, Condition } from "../../schemas/common";
import type { Question } from "../../schemas/service.schema";

type Answers = Readonly<Record<string, unknown>>;
export type ValidationResult = { valid: true } | { valid: false; message: string };

export function matchesConditions(conditions: Condition[] = [], answers: Answers): boolean {
  return conditions.every(({ questionId, operator, value }) => {
    if (!Object.hasOwn(answers, questionId)) return false;
    const actual = answers[questionId];
    if (actual === undefined || actual === null) return false;
    switch (operator) {
      case "equals":
        return actual === value;
      case "not_equals":
        return actual !== value;
      case "contains":
        return Array.isArray(actual) && actual.includes(value);
      case "greater_than":
        return typeof actual === "number" && typeof value === "number" && actual > value;
      case "less_than":
        return typeof actual === "number" && typeof value === "number" && actual < value;
    }
  });
}

export function isQuestionVisible(question: Question, effectiveAnswers: Answers) {
  return matchesConditions(question.visibility, effectiveAnswers);
}

export function validateAnswer(q: Question, value: unknown): ValidationResult {
  const ok = { valid: true } as const;
  const fail = (message: string) => ({ valid: false, message }) as const;
  if (value === undefined) return q.required ? fail("请回答此问题") : ok;
  const allowed = (item: unknown) => q.options?.some((o) => o.value === item);
  const { min, max, integer } = q.validation ?? {};
  const inBounds = (n: number) => (min === undefined || n >= min) && (max === undefined || n <= max);
  switch (q.type) {
    case "boolean":
      return typeof value === "boolean" ? ok : fail("请选择是或否");
    case "single":
    case "select":
      return allowed(value) ? ok : fail("请选择有效选项");
    case "multiple":
      if (!Array.isArray(value) || !value.every(allowed) || new Set(value).size !== value.length)
        return fail("请选择有效且不重复的选项");
      if ((q.required && !value.length) || !inBounds(value.length)) return fail("选择数量不符合要求");
      return ok;
    default:
      if (typeof value !== "number" || !Number.isFinite(value)) return fail("请输入有效数字");
      if (integer && !Number.isSafeInteger(value)) return fail("请输入整数");
      if (!inBounds(value) || (q.type !== "number" && value < 0)) return fail("数值超出允许范围");
      return ok;
  }
}

// 只让可见且校验通过的答案参与后续条件判断，避免上游改选后残留答案触发分支。
export function evaluateQuestions(questions: Question[], input: Answers) {
  const answers: Record<string, Answer> = Object.create(null);
  const visible: Question[] = [];
  const errors: { questionId: string; message: string }[] = [];
  for (const key of Object.keys(input)) {
    if (!questions.some((q) => q.id === key)) errors.push({ questionId: key, message: "未知问题" });
  }
  for (const q of questions) {
    if (!isQuestionVisible(q, answers)) continue;
    visible.push(q);
    const value = Object.hasOwn(input, q.id) ? input[q.id] : undefined;
    const result = validateAnswer(q, value);
    if (!result.valid) errors.push({ questionId: q.id, message: result.message });
    else if (value !== undefined) answers[q.id] = value as Answer;
  }
  return { visible, answers, errors, complete: errors.length === 0 };
}

export function nextQuestion(questions: Question[], input: Answers, currentId?: string) {
  const { visible, errors } = evaluateQuestions(questions, input);
  if (currentId === undefined) return visible[0];
  const index = visible.findIndex((q) => q.id === currentId);
  if (index < 0) return undefined;
  return errors.some((e) => e.questionId === currentId) ? visible[index] : visible[index + 1];
}
