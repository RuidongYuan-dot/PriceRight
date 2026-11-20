import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceScope } from "../../../components/service-scope";
import { catalogHref, catalogParams, resolveCatalogPath } from "../../../lib/data/site-catalog";

export function generateStaticParams() {
  return catalogParams("services");
}

export default async function ServicePage({ params }: { params: Promise<{ path: string[] }> }) {
  const context = await resolveCatalogPath((await params).path);
  const service = context?.catalog.services.find(
    (item) => item.slug === context.id && item.status !== "draft",
  );
  if (!context || !service) notFound();

  return (
    <div className="page-section">
      <Link href={catalogHref("categories", service.categoryId, context.demo)} className="back-link">
        ← 返回分类
      </Link>
      <h1>{service.name}</h1>
      <p className="muted">{service.description}</p>
      {service.demo && <p className="notice">演示金额为合成数据，请勿用作实际询价依据。</p>}
      <ServiceScope service={service} />
      {service.status === "active" ? (
        <Link href={catalogHref("estimate", service.slug, context.demo)} className="button">
          {service.demo ? "开始演示查询" : "开始查询"} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <p className="notice">价格数据建设中。</p>
      )}
    </div>
  );
}
