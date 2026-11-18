import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimateFlow } from "../../../components/estimate/flow";
import { catalogHref, catalogParams, resolveCatalogPath } from "../../../lib/data/site-catalog";

export function generateStaticParams() {
  return catalogParams("estimate");
}

export default async function EstimatePage({ params }: { params: Promise<{ path: string[] }> }) {
  const context = await resolveCatalogPath((await params).path);
  const service = context?.catalog.services.find(
    (item) => item.slug === context.id && item.status === "active",
  );
  if (!context || !service) notFound();

  return (
    <div className="page-section">
      <Link className="back-link" href={catalogHref("services", service.slug, context.demo)}>
        ← 返回服务说明
      </Link>
      <h1>{service.name}</h1>
      {service.demo && <p className="notice">演示查询 · 此流程使用合成样本。</p>}
      {context.catalog.regions.length > 0 ? (
        <EstimateFlow
          service={service}
          data={{
            regions: context.catalog.regions,
            samples: context.catalog["price-samples"].filter(
              (sample) => sample.serviceId === service.id && sample.verified,
            ),
          }}
        />
      ) : (
        <p className="notice">地区数据建设中，暂时无法查询。</p>
      )}
    </div>
  );
}
