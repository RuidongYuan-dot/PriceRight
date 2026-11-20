"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerSummary } from "../../lib/share/query";
import type { PriceRange } from "../../schemas/common";
import type { PriceResult } from "../../lib/pricing/calculate";

const integer = new Intl.NumberFormat("zh-CN");
function price(range: PriceRange) {
  return "¥" + integer.format(range.min) + (range.min === range.max ? "" : "–" + integer.format(range.max));
}
const confidence = { high: "高", medium_high: "较高", medium: "一般", low: "低" };

type CopyState = { status: "idle" } | { status: "copied" } | { status: "manual"; href: string };

export function EstimateResult({
  result,
  regionName,
  summaries,
  onBack,
  onRestart,
  onCopyLink,
}: {
  result: Exclude<PriceResult, { status: "invalid_input" }>;
  regionName: string;
  summaries: AnswerSummary[];
  onBack: () => void;
  onRestart: () => void;
  onCopyLink: () => string;
}) {
  const [copyState, setCopyState] = useState<CopyState>({ status: "idle" });
  const manualInput = useRef<HTMLInputElement>(null);
  const copyMessage =
    copyState.status === "copied"
      ? "链接已复制。"
      : copyState.status === "manual"
        ? "无法写入剪贴板，请手动复制下面的链接。"
        : "";

  useEffect(() => {
    if (copyState.status !== "manual") return;
    manualInput.current?.focus();
    manualInput.current?.select();
  }, [copyState]);

  async function copyLink() {
    let href = "";
    try {
      href = onCopyLink();
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(href);
      setCopyState({ status: "copied" });
    } catch {
      setCopyState({ status: "manual", href: href || window.location.href });
    }
  }

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
        <button type="button" className="button secondary share-action" onClick={() => void copyLink()} aria-describedby="share-copy-status">
          复制分享链接
        </button>
        <button type="button" className="button secondary" onClick={onBack}>
          更换地区
        </button>
        <button type="button" className="button" onClick={onRestart}>
          重新查询
        </button>
      </div>
      <p
        id="share-copy-status"
        className={
          copyState.status === "manual" ? "share-status error" : copyState.status === "copied" ? "share-status" : "sr-only"
        }
        role="status"
        aria-live="polite"
      >
        {copyMessage}
      </p>
      {copyState.status === "manual" && (
        <div className="share-fallback">
          <label htmlFor="share-link">分享链接</label>
          <input
            id="share-link"
            ref={manualInput}
            readOnly
            spellCheck={false}
            autoCapitalize="off"
            value={copyState.href}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
