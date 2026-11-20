import { extractSafeSourceLinks, isSafeLinkHref } from "../../lib/source-links";
import type { MatchedSample } from "../../lib/pricing/calculate";
import type { Region } from "../../schemas/region.schema";

const integer = new Intl.NumberFormat("zh-CN");
const previewLimit = 3;

const sampleTypeLabels: Record<MatchedSample["sampleType"], string> = {
  public_price: "公开参考价",
  provider_quote: "服务商公示价",
  actual_transaction: "实际成交样本",
  manual_reference: "人工录入参考",
};

const regionLevelLabels: Record<Region["level"], string> = {
  city: "城市",
  province: "省",
  city_tier: "城市等级",
  national: "全国参考",
};

function regionLabel(sample: MatchedSample, region?: Region) {
  if (!region || region.id !== sample.regionId) return sample.regionId;
  return region.name + " · " + regionLevelLabels[region.level];
}

function SourceText({ source }: { source: string }) {
  const segments = extractSafeSourceLinks(source);
  if (!segments.length) return source;
  return segments.map((segment, index) => {
    if (segment.type === "link" && isSafeLinkHref(segment.href)) {
      return (
        <a key={index} href={segment.href} target="_blank" rel="noopener noreferrer">
          {segment.text}
          <span className="sr-only">（新窗口打开）</span>
        </a>
      );
    }
    return <span key={index}>{segment.text}</span>;
  });
}

export function SampleProvenance({ samples, region }: { samples: readonly MatchedSample[]; region?: Region }) {
  const list = (
    <ul className="sample-list">
      {samples.map((sample) => (
        <li key={sample.id}>
          <p className="sample-price">
            <span>样本标价</span>
            <strong>{integer.format(sample.price)} 元</strong>
          </p>
          <dl>
            <div>
              <dt>来源说明</dt>
              <dd>
                <SourceText source={sample.source} />
              </dd>
            </div>
            <div>
              <dt>采集日期</dt>
              <dd>
                <time dateTime={sample.collectedAt}>{sample.collectedAt}</time>
              </dd>
            </div>
            <div>
              <dt>样本类型</dt>
              <dd>{sampleTypeLabels[sample.sampleType]}</dd>
            </div>
            <div>
              <dt>所属地区</dt>
              <dd>{regionLabel(sample, region)}</dd>
            </div>
            <div>
              <dt>核验状态</dt>
              <dd>{sample.verified ? "已核验" : "未核验"}</dd>
            </div>
            <div>
              <dt>是否演示</dt>
              <dd>{sample.demo ? "演示样本" : "非演示样本"}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="sample-provenance" aria-labelledby="sample-provenance-title">
      <h4 id="sample-provenance-title">公开样本来源明细</h4>
      {samples.length === 0 ? (
        <p>暂无可展示的公开样本。</p>
      ) : (
        <>
          <p className="muted sample-note">下列是本次计算实际用到的样本。标价是采集时记录的金额，不是上面的参考价格区间。</p>
          {samples.length <= previewLimit ? (
            list
          ) : (
            <details>
              <summary>查看全部 {samples.length} 条公开样本来源</summary>
              {list}
            </details>
          )}
        </>
      )}
    </section>
  );
}
