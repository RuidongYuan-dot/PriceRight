"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { calculatePrice, type PriceData, type PriceResult } from "../../lib/pricing/calculate";
import { priceInfluenceFactors, type PriceFactors } from "../../lib/pricing/factors";
import { evaluateQuestions } from "../../lib/question-engine/evaluate";
import { regionChoices } from "../../lib/region/choices";
import { decodeShareQuery, encodeShareQuery, type DecodedShare } from "../../lib/share/query";
import { shanghaiCalendarDate } from "../../lib/time/shanghai-date";
import type { Answer } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";
import { QuestionField } from "./question-field";
import { EstimateResult } from "./result";

const locationEvent = "priceright-location";

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener(locationEvent, onStoreChange);
  return () => window.removeEventListener(locationEvent, onStoreChange);
}

function locationSearch() {
  return window.location.search;
}

function emptySearch() {
  return "";
}

function replaceLocation(next: string) {
  const href = `${window.location.pathname}${next}`;
  if (`${window.location.pathname}${window.location.search}` === href) return false;
  window.history.replaceState(null, "", href);
  window.dispatchEvent(new Event(locationEvent));
  return true;
}

function initialStep(service: Service, decoded: DecodedShare) {
  const restored = evaluateQuestions(service.questions, decoded.answers);
  const shared = Boolean(decoded.regionId || Object.keys(decoded.answers).length);
  if (!shared) return service.questions.length > 0 ? 0 : null;
  if (restored.complete) return null;
  const index = restored.visible.findIndex((item) => restored.errors.some((issue) => issue.questionId === item.id));
  return index >= 0 ? index : 0;
}

export function EstimateFlow({ service, data }: { service: Service; data: PriceData }) {
  // 静态页面没有请求时刻。查询串在浏览器里读取；服务端快照保持空串，避免把构建日期写进 HTML。
  const search = useSyncExternalStore(subscribeToLocation, locationSearch, emptySearch);
  return <EstimateSession key={search} search={search} service={service} data={data} />;
}

function EstimateSession({
  service,
  data,
  search,
}: {
  service: Service;
  data: PriceData;
  search: string;
}) {
  const decoded = decodeShareQuery(service, data.regions, search);
  const restored = evaluateQuestions(service.questions, decoded.answers);
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>(decoded.answers);
  const [step, setStep] = useState<number | null>(() => initialStep(service, decoded));
  const [regionId, setRegionId] = useState(decoded.regionId ?? "");
  const [asOf] = useState(() => decoded.asOf ?? shanghaiCalendarDate());
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PriceResult | undefined>(() =>
    decoded.regionId && restored.complete
      ? calculatePrice(service, decoded.answers, decoded.regionId, { ...data, asOf })
      : undefined,
  );
  const panel = useRef<HTMLDivElement>(null);
  const moved = useRef(Boolean(decoded.regionId || Object.keys(decoded.answers).length));
  const choices = regionChoices(data.regions);
  const selected = choices.find((choice) => choice.id === regionId);
  const state = evaluateQuestions(service.questions, answers);
  const question = step === null ? undefined : state.visible[step];
  const error =
    question && submitted ? state.errors.find((issue) => issue.questionId === question.id)?.message : undefined;
  const factors: PriceFactors = priceInfluenceFactors(service, data.regions);
  const shareHref =
    result && result.status !== "invalid_input" && selected
      ? `${window.location.pathname}${encodeShareQuery(service, state.answers, selected.id, asOf)}`
      : "";

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
    if (!selected) return;
    const outcome = calculatePrice(service, answers, selected.id, { ...data, asOf });
    if (outcome.status === "invalid_input") {
      setResult(outcome);
      return;
    }
    const query = encodeShareQuery(service, state.answers, selected.id, asOf);
    if (!replaceLocation(query)) setResult(outcome);
  }

  if (result && result.status !== "invalid_input") {
    return (
      <div ref={panel} tabIndex={-1} className="flow-panel" aria-label="查询结果">
        <EstimateResult
          result={result}
          regionName={selected?.label ?? ""}
          factors={factors}
          shareHref={shareHref}
          onBack={() => showStep(null)}
          onRestart={() => {
            if (!replaceLocation("")) {
              setAnswers({});
              setRegionId("");
              showStep(service.questions.length > 0 ? 0 : null);
            }
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
    </div>
  );
}
