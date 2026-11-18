import { expect, it } from "vitest";
import {
  evaluateQuestions,
  matchesConditions,
  nextQuestion,
  validateAnswer,
} from "../../lib/question-engine/evaluate";
import type { Question } from "../../schemas/service.schema";

const questions: Question[] = [
  { id: "a", type: "boolean", title: "A", required: true },
  {
    id: "b",
    type: "select",
    title: "B",
    required: true,
    options: [{ id: "x", label: "X", value: 0 }],
    visibility: [{ questionId: "a", operator: "equals", value: true }],
  },
  {
    id: "c",
    type: "number",
    title: "C",
    required: true,
    validation: { min: 0, max: 2, integer: true },
    visibility: [{ questionId: "b", operator: "equals", value: 0 }],
  },
];

it("分支可逐级进入，改选或无效答案切断后续条件", () => {
  expect(nextQuestion(questions, {})?.id).toBe("a");
  expect(nextQuestion(questions, {}, "a")?.id).toBe("a");
  expect(nextQuestion(questions, { a: true }, "a")?.id).toBe("b");
  expect(nextQuestion(questions, { a: true, b: 0 }, "b")?.id).toBe("c");
  expect(evaluateQuestions(questions, { a: false, b: 0, c: -1 })).toMatchObject({
    answers: { a: false },
    errors: [],
    complete: true,
  });
  expect(nextQuestion(questions, { a: false }, "a")).toBeUndefined();
  expect(evaluateQuestions(questions, { a: "true", b: 0 }).visible.map((q) => q.id)).toEqual(["a"]);
  expect(evaluateQuestions(questions, { a: true, b: 0 }).errors.map((e) => e.questionId)).toEqual(["c"]);
  expect(evaluateQuestions(questions, { unexpected: true, a: false }).complete).toBe(false);
});

it("条件支持全部比较符，缺少答案不会触发不等于", () => {
  expect(
    matchesConditions(
      [
        { questionId: "a", operator: "not_equals", value: true },
        { questionId: "b", operator: "contains", value: 0 },
        { questionId: "c", operator: "greater_than", value: 1 },
        { questionId: "c", operator: "less_than", value: 3 },
      ],
      { a: false, b: [0], c: 2 },
    ),
  ).toBe(true);
  expect(matchesConditions([{ questionId: "a", operator: "not_equals", value: true }], {})).toBe(false);
});

it.each(["single", "select", "multiple"] as const)("%s 区分选项原始类型并验证必填", (type) => {
  const q = { ...questions[1], type };
  expect(validateAnswer(q, undefined).valid).toBe(false);
  expect(validateAnswer(q, type === "multiple" ? [0] : 0).valid).toBe(true);
  expect(validateAnswer(q, type === "multiple" ? ["0"] : "0").valid).toBe(false);
  expect(validateAnswer({ ...q, required: false }, undefined).valid).toBe(true);
});

it("多选拒绝重复、空必填及越界数量", () => {
  const q = { ...questions[1], type: "multiple" as const, validation: { min: 1, max: 1 } };
  for (const value of [[0, 0], [], null, "0"]) expect(validateAnswer(q, value).valid).toBe(false);
});
it.each(["number", "area", "distance"] as const)("%s 校验数值范围和类型", (type) => {
  const q = { ...questions[2], type };
  for (const value of [-1, 3, "0", 1.5, NaN, Infinity]) expect(validateAnswer(q, value).valid).toBe(false);
  for (const value of [0, 2]) expect(validateAnswer(q, value).valid).toBe(true);
});
