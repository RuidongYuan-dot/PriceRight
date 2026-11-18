"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculatePrice, type PriceData, type PriceResult } from "../../lib/pricing/calculate";
import { evaluateQuestions } from "../../lib/question-engine/evaluate";
import type { Answer } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";
import { QuestionField } from "./question-field";
import { EstimateResult } from "./result";

export function EstimateFlow({ service, data }: { service: Service; data: PriceData }) {
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});
  const [step, setStep] = useState<number | null>(service.questions.length > 0 ? 0 : null);
  const [regionId, setRegionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PriceResult>();
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const state = evaluateQuestions(service.questions, answers);
  const question = step === null ? undefined : state.visible[step];
  const error =
    question && submitted
      ? state.errors.find((issue) => issue.questionId === question.id)?.message
      : undefined;
  const region = data.regions.find((option) => option.id === regionId);

  useEffect(() => {
    if (moved.current) panel.current?.focus();
  }, [step, result?.status]);

  function showStep(next: number | null) {
    moved.current = true;
    setStep(next);
    setSubmitted(false);
    setResult(undefined);
  }

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (question && step !== null) {
      if (state.errors.some((issue) => issue.questionId === question.id)) return;
      showStep(step + 1 < state.visible.length ? step + 1 : null);
      return;
    }
    if (!region) return;
    moved.current = true;
    setResult(calculatePrice(service, answers, region.id, data));
  }

  if (result && result.status !== "invalid_input") {
    return (
      <div ref={panel} tabIndex={-1} className="flow-panel" aria-label="查询结果">
        <EstimateResult
          result={result}
          regionName={region?.name ?? ""}
          onBack={() => showStep(null)}
          onRestart={() => {
            setAnswers({});
            setRegionId("");
            showStep(service.questions.length > 0 ? 0 : null);
          }}
        />
      </div>
    );
  }

  return (
    <div ref={panel} tabIndex={-1} className="flow-panel" aria-labelledby="step-title">
      <form className="surface form-panel" noValidate onSubmit={advance}>
        <p className="eyebrow">
          {step === null ? "服务地区" : `第 ${step + 1} 题 · ${question?.required ? "必答" : "选填"}`}
        </p>
        <h2 id="step-title">{question?.title ?? "选择服务地区"}</h2>
        {question ? (
          <QuestionField
            key={question.id}
            question={question}
            answer={answers[question.id]}
            error={error}
            onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
          />
        ) : (
          <div className="question-fields">
            <select
              aria-labelledby="step-title"
              aria-invalid={submitted && !region}
              aria-describedby={submitted && !region ? "region-error" : undefined}
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                setResult(undefined);
              }}
            >
              <option value="">请选择地区</option>
              {data.regions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {submitted && !region && (
              <p id="region-error" className="field-error" role="alert">
                请选择服务地区。
              </p>
            )}
            {result?.status === "invalid_input" && (
              <p className="field-error" role="alert">
                {result.errors.map((issue) => issue.message).join("。")}
              </p>
            )}
          </div>
        )}
        <div className="form-actions">
          {(step ?? state.visible.length) > 0 && (
            <button
              className="button secondary"
              type="button"
              onClick={() => showStep((step ?? state.visible.length) - 1)}
            >
              上一步
            </button>
          )}
          <button className="button" type="submit">
            {question ? "下一步" : "查看结果"} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
