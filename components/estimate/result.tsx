import type { PriceRange } from "../../schemas/common";
import type { PriceResult } from "../../lib/pricing/calculate";

const integer = new Intl.NumberFormat("zh-CN");
function price(range: PriceRange) {
  return "¥" + integer.format(range.min) + (range.min === range.max ? "" : "–" + integer.format(range.max));
}
const confidence = { high: "高", medium_high: "较高", medium: "一般", low: "低" };

export function EstimateResult({
  result,
  regionName,
  onBack,
  onRestart,
}: {
  result: Exclude<PriceResult, { status: "invalid_input" }>;
  regionName: string;
  onBack: () => void;
  onRestart: () => void;
}) {
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
      {result.status === "estimated" && (
        <>
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
