"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculatePrice, type PriceData, type PriceResult } from "../../lib/pricing/calculate";
import { evaluateQuestions } from "../../lib/question-engine/evaluate";
import {
  decodeShareQuery,
  describeShareAnswers,
  encodeShareQuery,
  shareHref,
  type ShareFeedback,
} from "../../lib/share/query";
import type { Answer } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";
import { QuestionField } from "./question-field";
import { EstimateResult } from "./result";

function ShareFeedbackList({ items }: { items: ShareFeedback[] }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((item) => (
        <p
          key={`${item.tone}:${item.message}`}
          className={item.tone === "warning" ? "notice warning" : "notice"}
          role={item.tone === "warning" ? "alert" : "status"}
        >
          {item.message}
        </p>
      ))}
    </>
  );
}

// 静态导出没有服务端请求。查询串只在浏览器里读写，并保留 pathname 中的 basePath。
function replaceQuery(query: string) {
  const href = shareHref(window.location.href, query);
  const next = new URL(href);
  const target = `${next.pathname}${next.search}`;
  if (`${window.location.pathname}${window.location.search}` !== target || window.location.hash) {
    History.prototype.replaceState.call(window.history, window.history.state, "", target);
  }
  return href;
}

export function EstimateFlow({ service, data }: { service: Service; data: PriceData }) {
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});
  const [step, setStep] = useState<number | null>(null);
  const [regionId, setRegionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PriceResult>();
  const [feedback, setFeedback] = useState<ShareFeedback[]>([]);
  const [ready, setReady] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const initial = useRef({ service, data });

  useEffect(() => {
    const { service: source, data: priceData } = initial.current;
    const decoded = decodeShareQuery(source.questions, window.location.search, priceData.regions);
    const untouched =
      decoded.feedback.length === 0 && decoded.regionId === undefined && Object.keys(decoded.answers).length === 0;
    if (untouched) {
      setStep(source.questions.length > 0 ? 0 : null);
      setReady(true);
      return;
    }

    setAnswers(decoded.answers);
    setRegionId(decoded.regionId ?? "");
    if (decoded.ready && decoded.regionId) {
      const next = calculatePrice(source, decoded.answers, decoded.regionId, priceData);
      if (next.status !== "invalid_input") {
        setFeedback(decoded.feedback);
        setResult(next);
        setStep(null);
        setReady(true);
        return;
      }
      setFeedback([
        ...decoded.feedback.filter((item) => item.tone === "warning"),
        { tone: "warning", message: "链接中的条件暂时无法计算，请检查后继续填写。" },
      ]);
    } else {
      setFeedback(decoded.feedback);
    }
    const restored = evaluateQuestions(source.questions, decoded.answers);
    const firstInvalid = restored.visible.findIndex((question) =>
      restored.errors.some((issue) => issue.questionId === question.id),
    );
    setStep(firstInvalid >= 0 ? firstInvalid : null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (moved.current) panel.current?.focus();
  }, [step, result?.status]);

  useEffect(() => {
    if (!ready || !result || result.status === "invalid_input") return;
    replaceQuery(encodeShareQuery(service.questions, answers, regionId || undefined, data.regions));
  }, [ready, result, answers, regionId, service, data]);

  const state = evaluateQuestions(service.questions, answers);
  const question = step === null ? undefined : state.visible[step];
  const error =
    question && submitted ? state.errors.find((issue) => issue.questionId === question.id)?.message : undefined;
  const region = data.regions.find((option) => option.id === regionId);
  const showingResult = result !== undefined && result.status !== "invalid_input";

  function showStep(next: number | null) {
    moved.current = true;
    setStep(next);
    setSubmitted(false);
    setResult(undefined);
    setFeedback([]);
    replaceQuery("");
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
    setFeedback([]);
    setResult(calculatePrice(service, answers, region.id, data));
  }

  if (!ready) {
    return (
      <p className="muted" role="status">
        正在读取查询条件…
      </p>
    );
  }

  return (
    <div
      ref={panel}
      tabIndex={-1}
      className="flow-panel"
      aria-label={showingResult ? "查询结果" : undefined}
      aria-labelledby={showingResult ? undefined : "step-title"}
    >
      <ShareFeedbackList items={feedback} />
      {showingResult && result ? (
        <EstimateResult
          service={service}
          result={result}
          regionName={region?.name ?? ""}
          answers={answers}
          summaries={describeShareAnswers(service.questions, answers)}
          onBack={() => showStep(null)}
          onRestart={() => {
            setAnswers({});
            setRegionId("");
            showStep(service.questions.length > 0 ? 0 : null);
          }}
          onCopyLink={() =>
            replaceQuery(encodeShareQuery(service.questions, answers, regionId || undefined, data.regions))
          }
        />
      ) : (
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
              <button className="button secondary" type="button" onClick={() => showStep((step ?? state.visible.length) - 1)}>
                上一步
              </button>
            )}
            <button className="button" type="submit">
              {question ? "下一步" : "查看结果"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
