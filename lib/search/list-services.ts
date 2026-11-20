import { catalogHref } from "../data/site-catalog";
import type { DirectoryService, SearchableCategory } from "./services";

export type DirectoryServiceInput = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  status: "active" | "draft" | "coming_soon";
  demo: boolean;
  keywords?: readonly string[];
  tags?: readonly string[];
  aliases?: readonly string[];
};

export type DirectoryCatalog = {
  categories: readonly { id: string; name: string; description?: string; order: number }[];
  services: readonly DirectoryServiceInput[];
};

export type DirectoryGroup = {
  services: DirectoryService[];
  categories: SearchableCategory[];
};

export type FilterCategory = {
  id: string;
  name: string;
  order: number;
};

function termFields(service: DirectoryServiceInput): Pick<DirectoryService, "keywords" | "tags" | "aliases"> {
  return {
    ...(service.keywords?.length ? { keywords: service.keywords } : {}),
    ...(service.tags?.length ? { tags: service.tags } : {}),
    ...(service.aliases?.length ? { aliases: service.aliases } : {}),
  };
}

export function directoryGroup(catalog: DirectoryCatalog, demo: boolean): DirectoryGroup {
  const names = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const services: DirectoryService[] = [];
  for (const service of catalog.services) {
    if (service.status === "draft") continue;
    services.push({
      id: service.id,
      name: service.name,
      description: service.description,
      categoryId: service.categoryId,
      ...termFields(service),
      href: catalogHref("services", service.slug, demo),
      categoryName: names.get(service.categoryId) ?? "",
      demo: service.demo,
      status: service.status,
    });
  }
  return {
    services,
    categories: catalog.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
    })),
  };
}

/** 多个目录里同名 id 保留先出现的分类，供筛选标签使用。 */
export function filterCategories(catalogs: readonly DirectoryCatalog[]): FilterCategory[] {
  const chosen = new Map<string, FilterCategory>();
  for (const catalog of catalogs) {
    for (const category of catalog.categories) {
      if (!chosen.has(category.id)) {
        chosen.set(category.id, { id: category.id, name: category.name, order: category.order });
      }
    }
  }
  return [...chosen.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-CN"));
}
