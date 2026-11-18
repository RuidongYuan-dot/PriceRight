import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogHref, catalogParams, resolveCatalogPath } from "../../../lib/data/site-catalog";

export const dynamicParams = false;
export function generateStaticParams() {
  return catalogParams("categories");
}

export default async function CategoryPage({ params }: { params: Promise<{ path: string[] }> }) {
  const context = await resolveCatalogPath((await params).path);
  const category = context?.catalog.categories.find((item) => item.id === context.id);
  if (!context || !category) notFound();

  const services = context.catalog.services.filter(
    (service) => service.categoryId === category.id && service.status !== "draft",
  );

  return (
    <div className="page-section">
      <Link href="/#services" className="back-link">
        ← 服务目录
      </Link>
      <h1>{category.name}</h1>
      {context.demo && <p className="notice">演示服务使用合成价格数据，仅供体验查询流程。</p>}
      {category.description && <p className="muted">{category.description}</p>}
      <div className="tile-grid">
        {services.map((service) => (
          <Link className="tile" href={catalogHref("services", service.slug, context.demo)} key={service.id}>
            <span>
              <strong>{service.name}</strong>
              <small>{service.status === "coming_soon" ? "数据建设中" : service.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      {services.length === 0 && <p className="muted">此分类的价格数据建设中。</p>}
    </div>
  );
}
