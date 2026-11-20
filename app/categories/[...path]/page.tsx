import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceSearch } from "../../../components/catalog/service-search";
import { catalogParams, resolveCatalogPath } from "../../../lib/data/site-catalog";
import { directoryGroup, filterCategories } from "../../../lib/search/list-services";

export function generateStaticParams() {
  return catalogParams("categories");
}

export default async function CategoryPage({ params }: { params: Promise<{ path: string[] }> }) {
  const context = await resolveCatalogPath((await params).path);
  const category = context?.catalog.categories.find((item) => item.id === context.id);
  if (!context || !category) notFound();

  return (
    <div className="page-section">
      <Link href="/#services" className="back-link">
        ← 服务目录
      </Link>
      <h1>{category.name}</h1>
      {context.demo && <p className="notice">演示服务使用合成价格数据，仅供体验查询流程。</p>}
      {category.description && <p className="muted">{category.description}</p>}
      <ServiceSearch
        groups={[directoryGroup(context.catalog, context.demo)]}
        categories={filterCategories([context.catalog])}
        initialCategoryId={category.id}
        showDemoNotice={false}
      />
    </div>
  );
}
