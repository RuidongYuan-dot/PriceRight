import type { ReactNode } from "react";
import { listConfiguredSurcharges } from "../lib/pricing/checklist";
import type { Service } from "../schemas/service.schema";

const surchargeIntro = "这些项目来自当前服务的计价配置。预约前请确认是否适用，以及是否已经包含在总价里。";

function ItemList({ items }: { items: readonly string[] }) {
  if (!items.length) return <p className="muted">暂无说明</p>;
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function ScopeBlock({
  id,
  title,
  level,
  children,
}: {
  id: string;
  title: string;
  level: "h2" | "h3";
  children: ReactNode;
}) {
  const Title = level;
  return (
    <section aria-labelledby={id}>
      <Title id={id}>{title}</Title>
      {children}
    </section>
  );
}

export function ServiceScope({ service, layout = "page" }: { service: Service; layout?: "page" | "result" }) {
  const level = layout === "page" ? "h2" : "h3";
  const surcharges = listConfiguredSurcharges(service);
  const included = (
    <ScopeBlock id="included-title" title="服务包含" level={level}>
      <ItemList items={service.scope.included} />
    </ScopeBlock>
  );
  const excluded = (
    <ScopeBlock id="excluded-title" title="服务不包含" level={level}>
      <ItemList items={service.scope.excluded} />
    </ScopeBlock>
  );
  const extras = (
    <ScopeBlock id="surcharge-title" title="预约前建议确认的常见加价项" level={level}>
      <p className="muted">{surchargeIntro}</p>
      <ItemList items={surcharges.map((item) => item.detail)} />
    </ScopeBlock>
  );

  if (layout === "result") {
    return (
      <>
        <div className="surface result-details">{included}</div>
        <div className="surface result-details">{excluded}</div>
        <div className="surface result-details">{extras}</div>
      </>
    );
  }

  return (
    <>
      <div className="surface scope-grid">
        {included}
        {excluded}
      </div>
      <div className="surface scope-extra">{extras}</div>
    </>
  );
}
