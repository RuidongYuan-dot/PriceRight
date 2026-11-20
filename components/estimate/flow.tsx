"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculatePrice, type PriceData, type PriceResult } from "../../lib/pricing/calculate";
import { priceInfluenceFactors } from "../../lib/pricing/factors";
import { evaluateQuestions } from "../../lib/question-engine/evaluate";
import { regionChoices } from "../../lib/region/choices";
import {
  decodeShareQuery,
  describeShareAnswers,
  encodeShareQuery,
  shareHref,
  type ShareFeedback,
} from "../../lib/share/query";
import { shanghaiCalendarDate } from "../../lib/time/shanghai-date";
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
  const [asOf, setAsOf] = useState("");
  const [shareAsOf, setShareAsOf] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PriceResult>();
  const [feedback, setFeedback] = useState<ShareFeedback[]>([]);
  const [ready, setReady] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const initial = useRef({ service, data });
  const choices = regionChoices(data.regions);
  const selected = choices.find((choice) => choice.id === regionId);

  useEffect(() => {
    const { service: source, data: priceData } = initial.current;
    const decoded = decodeShareQuery(source.questions, window.location.search, priceData.regions);
    const evaluationDate = decoded.asOf ?? shanghaiCalendarDate();
    const untouched =
      decoded.feedback.length === 0 && decoded.regionId === undefined && Object.keys(decoded.answers).length === 0;
    setAsOf(evaluationDate);
    setShareAsOf(decoded.asOf);
    if (untouched) {
      setStep(source.questions.length > 0 ? 0 : null);
      setReady(true);
      return;
    }

    setAnswers(decoded.answers);
    setRegionId(decoded.regionId ?? "");
    if (decoded.ready && decoded.regionId) {
      const next = calculatePrice(source, decoded.answers, decoded.regionId, { ...priceData, asOf: evaluationDate });
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
    replaceQuery(encodeShareQuery(service.questions, answers, regionId || undefined, data.regions, shareAsOf));
  }, [ready, result, answers, regionId, service, data, shareAsOf]);

  const state = evaluateQuestions(service.questions, answers);
  const question = step === null ? undefined : state.visible[step];
  const error =
    question && submitted ? state.errors.find((issue) => issue.questionId === question.id)?.message : undefined;
  const factors = priceInfluenceFactors(service, data.regions);
  const showingResult = result !== undefined && result.status !== "invalid_input";

  function showStep(next: number | null) {
    moved.current = true;
    setStep(next);
    setSubmitted(false);
    setResult(undefined);
    setFeedback([]);
    replaceQuery("");
  }

  function shareQuery() {
    return encodeShareQuery(service.questions, answers, regionId || undefined, data.regions, shareAsOf);
  }

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (question && step !== null) {
      if (state.errors.some((issue) => issue.questionId === question.id)) return;
      showStep(step + 1 < state.visible.length ? step + 1 : null);
      return;
    }
    if (!selected || !asOf) return;
    moved.current = true;
    setFeedback([]);
    setResult(calculatePrice(service, answers, selected.id, { ...data, asOf }));
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
          result={result}
          regionName={selected?.label ?? ""}
          summaries={describeShareAnswers(service.questions, answers)}
          factors={factors}
          onBack={() => showStep(null)}
          onRestart={() => {
            setAnswers({});
            setRegionId("");
            setShareAsOf(undefined);
            showStep(service.questions.length > 0 ? 0 : null);
          }}
          onCopyLink={() => replaceQuery(shareQuery())}
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
              <p id="region-hint" className="muted">
                请选择城市。
                {choices.some((choice) => choice.fallback) &&
                  "没有列出你的城市时，选择「我的城市不在列表中（全国参考）」。"}
              </p>
              <select
                aria-labelledby="step-title"
                aria-invalid={submitted && !selected}
                aria-describedby={submitted && !selected ? "region-hint region-error" : "region-hint"}
                value={regionId}
                onChange={(event) => {
                  setRegionId(event.target.value);
                  setResult(undefined);
                }}
              >
                <option value="">请选择城市</option>
                {choices.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {submitted && !selected && (
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
      )}
    </div>
  );
}
