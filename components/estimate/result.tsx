"use client";

import { useEffect, useRef, useState } from "react";
import { buildInquiryChecklist } from "../../lib/pricing/checklist";
import type { PriceResult } from "../../lib/pricing/calculate";
import type { AnswerSummary } from "../../lib/share/query";
import type { PriceRange } from "../../schemas/common";
import type { Service } from "../../schemas/service.schema";
import { ServiceScope } from "../service-scope";

const integer = new Intl.NumberFormat("zh-CN");
function price(range: PriceRange) {
  return "¥" + integer.format(range.min) + (range.min === range.max ? "" : "–" + integer.format(range.max));
}
const confidence = { high: "高", medium_high: "较高", medium: "一般", low: "低" };

type CopyState = { status: "idle" } | { status: "copied" } | { status: "manual"; text: string };

function useClipboard() {
  const [state, setState] = useState<CopyState>({ status: "idle" });

  async function copy(getText: () => string, fallback?: () => string) {
    let text = "";
    try {
      text = getText();
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setState({ status: "copied" });
    } catch {
      setState({ status: "manual", text: text || fallback?.() || "" });
    }
  }

  return { state, copy };
}

function ManualField({ id, value, multiline }: { id: string; value: string; multiline: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = multiline ? areaRef.current : inputRef.current;
    node?.focus();
    node?.select();
  }, [multiline, value]);

  if (multiline) {
    return (
      <textarea
        id={id}
        ref={areaRef}
        readOnly
        rows={12}
        spellCheck={false}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
      />
    );
  }

  return (
    <input
      id={id}
      ref={inputRef}
      readOnly
      spellCheck={false}
      autoCapitalize="off"
      value={value}
      onFocus={(event) => event.currentTarget.select()}
    />
  );
}

function CopyFeedback({
  state,
  successMessage,
  failureMessage,
  statusId,
  fallbackLabel,
  fallbackId,
  multiline = false,
}: {
  state: CopyState;
  successMessage: string;
  failureMessage: string;
  statusId: string;
  fallbackLabel: string;
  fallbackId: string;
  multiline?: boolean;
}) {
  const message = state.status === "copied" ? successMessage : state.status === "manual" ? failureMessage : "";

  return (
    <>
      <p
        id={statusId}
        className={state.status === "manual" ? "share-status error" : state.status === "copied" ? "share-status" : "sr-only"}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
      {state.status === "manual" && (
        <div className="share-fallback">
          <label htmlFor={fallbackId}>{fallbackLabel}</label>
          <ManualField id={fallbackId} value={state.text} multiline={multiline} />
        </div>
      )}
    </>
  );
}

export function EstimateResult({
  service,
  result,
  regionName,
  answers,
  summaries,
  onBack,
  onRestart,
  onCopyLink,
}: {
  service: Service;
  result: Exclude<PriceResult, { status: "invalid_input" }>;
  regionName: string;
  answers: Readonly<Record<string, unknown>>;
  summaries: AnswerSummary[];
  onBack: () => void;
  onRestart: () => void;
  onCopyLink: () => string;
}) {
  const checklist = useClipboard();
  const link = useClipboard();
  const checklistText = buildInquiryChecklist({ service, regionName, summaries, result, answers });

  return (
    <div className="result">
      <div className="result-summary">
        <p>{regionName}</p>
        <h2>
          {result.status === "estimated" ? (result.demo ? "演示价格区间" : "合理参考价格") : "数据不足"}
        </h2>
        {result.status === "estimated" && <p className="price">{price(result.range)}</p>}
        {result.status === "estimated" && result.demo && <p>合成数据 · 请勿作为实际询价依据</p>}
        {result.status === "insufficient_data" && <p>{result.warnings[0]}</p>}
      </div>
      {summaries.length > 0 && (
        <section className="surface result-details" aria-labelledby="condition-title">
          <h3 id="condition-title">查询条件</h3>
          <dl className="breakdown">
            {summaries.map((item) => (
              <div key={item.questionId}>
                <dt>{item.title}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <ServiceScope service={service} layout="result" />
      {result.status === "estimated" && (
        <>
          <section className="surface result-details" aria-labelledby="breakdown-title">
            <h3 id="breakdown-title">价格构成</h3>
            <dl className="breakdown">
              {result.breakdown.map((item, index) => (
                <div key={index}>
                  <dt>
                    {item.label}
                    {item.operation === "replace" && <small>调整后小计</small>}
                  </dt>
                  <dd>{price(item.range)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="surface result-details" aria-labelledby="evidence-title">
            <h3 id="evidence-title">数据依据</h3>
            <p>{result.assumptions.join("。")}</p>
            <dl className="evidence">
              <div>
                <dt>有效样本</dt>
                <dd>{result.sampleCount} 条</dd>
              </div>
              <div>
                <dt>最近采集</dt>
                <dd>{result.dataUpdatedAt}</dd>
              </div>
              <div>
                <dt>可信度</dt>
                <dd>{confidence[result.confidence]}</dd>
              </div>
            </dl>
            <details>
              <summary>查看数据来源</summary>
              <ul>
                {result.sources.map((source) => (
                  <li key={source.sampleId}>
                    {source.source} · {source.level} 类 · {source.collectedAt}
                  </li>
                ))}
              </ul>
            </details>
            {result.warnings.map((warning) => (
              <p className="muted" key={warning}>
                {warning}
              </p>
            ))}
          </section>
          {!result.demo && (
            <p className="muted">此结果为市场参考价格，实际收费可能随服务条件、材料及现场情况变化。</p>
          )}
        </>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button secondary copy-action"
          onClick={() => void checklist.copy(() => checklistText)}
          aria-describedby="checklist-copy-status"
        >
          复制询价清单
        </button>
        <button
          type="button"
          className="button secondary copy-action"
          onClick={() => void link.copy(onCopyLink, () => window.location.href)}
          aria-describedby="share-copy-status"
        >
          复制分享链接
        </button>
        <button type="button" className="button secondary" onClick={onBack}>
          更换地区
        </button>
        <button type="button" className="button" onClick={onRestart}>
          重新查询
        </button>
      </div>
      <CopyFeedback
        state={checklist.state}
        successMessage="询价清单已复制。"
        failureMessage="无法写入剪贴板，请手动复制下面的询价清单。"
        statusId="checklist-copy-status"
        fallbackLabel="询价清单"
        fallbackId="inquiry-checklist"
        multiline
      />
      <CopyFeedback
        state={link.state}
        successMessage="链接已复制。"
        failureMessage="无法写入剪贴板，请手动复制下面的链接。"
        statusId="share-copy-status"
        fallbackLabel="分享链接"
        fallbackId="share-link"
      />
    </div>
  );
}
