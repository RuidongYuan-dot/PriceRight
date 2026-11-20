import type { PriceRange } from "../../schemas/common";
import type { PriceResult } from "../../lib/pricing/calculate";
import type { PriceFactors } from "../../lib/pricing/factors";

const integer = new Intl.NumberFormat("zh-CN");
function price(range: PriceRange) {
  return "¥" + integer.format(range.min) + (range.min === range.max ? "" : "–" + integer.format(range.max));
}
function yuan(amount: number) {
  return "¥" + integer.format(amount);
}
const confidence = { high: "高", medium_high: "较高", medium: "一般", low: "低" };

export function EstimateResult({
  result,
  regionName,
  factors,
  shareHref,
  onBack,
  onRestart,
}: {
  result: Exclude<PriceResult, { status: "invalid_input" }>;
  regionName: string;
  factors: PriceFactors;
  shareHref: string;
  onBack: () => void;
  onRestart: () => void;
}) {
  const hasFactors = factors.up.length > 0 || factors.down.length > 0;
  return (
    <div className="result">
      <div className="result-summary">
        <p>{regionName}</p>
        <h2>
          {result.status === "estimated" ? (result.demo ? "演示价格区间" : "合理参考价格") : "数据不足"}
        </h2>
        {result.status === "estimated" && (
          <>
            <p className="price">{price(result.range)}</p>
            <p className="typical">
              常见价格 <strong>{yuan(result.typical)}</strong>
            </p>
            <p className="typical-note">来自已匹配样本的中位数。</p>
          </>
        )}
        {result.status === "estimated" && result.demo && <p>合成数据 · 请勿作为实际询价依据</p>}
        {result.status === "insufficient_data" && <p>{result.warnings[0]}</p>}
      </div>
      {result.status === "estimated" && (
        <section className="surface result-details">
          <h3>价格构成</h3>
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
      )}
      {hasFactors && (
        <section className="surface result-details" aria-labelledby="price-factors">
          <h3 id="price-factors">哪些因素会影响价格</h3>
          <p className="muted">下面这些选择来自该服务的计价配置，会让参考价格升高或降低。</p>
          <ul className="factors">
            {factors.up.map((factor, index) => (
              <li key={`up-${index}`}>
                <span className="factor-mark factor-up" aria-hidden="true">
                  ↑
                </span>
                <span className="sr-only">会提高价格：</span>
                <span>
                  <strong>{factor.label}</strong>
                  <small>{factor.detail}</small>
                </span>
              </li>
            ))}
            {factors.down.map((factor, index) => (
              <li key={`down-${index}`}>
                <span className="factor-mark factor-down" aria-hidden="true">
                  ↓
                </span>
                <span className="sr-only">会降低价格：</span>
                <span>
                  <strong>{factor.label}</strong>
                  <small>{factor.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.status === "estimated" && (
        <>
          <section className="surface result-details">
            <h3>数据依据</h3>
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
        {shareHref && (
          <a className="button secondary" href={shareHref}>
            分享这份价格
          </a>
        )}
        <button className="button secondary" onClick={onBack}>
          更换地区
        </button>
        <button className="button" onClick={onRestart}>
          重新查询
        </button>
      </div>
    </div>
  );
}
