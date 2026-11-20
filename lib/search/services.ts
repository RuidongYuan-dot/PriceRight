// 纯函数目录检索。只读取调用方传入的分类和服务配置。

export type SearchableService = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  keywords?: readonly string[];
  tags?: readonly string[];
  aliases?: readonly string[];
};

export type SearchableCategory = {
  id: string;
  name: string;
  description?: string;
};

export type ServiceSearchQuery = {
  keyword?: string;
  categoryId?: string;
};

export type ServiceSearchMatch<
  TService extends SearchableService = SearchableService,
  TCategory extends SearchableCategory = SearchableCategory,
> = {
  service: TService;
  category?: TCategory;
};

export type DirectoryService = SearchableService & {
  href: string;
  categoryName: string;
  demo: boolean;
  status: "active" | "coming_soon";
};

const FIELD_SEPARATOR = "\n";

/** 折叠首尾和连续空白，并忽略中英文大小写与全角差异。 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function textList(values: readonly string[] | undefined): readonly string[] {
  return Array.isArray(values) ? values : [];
}

function searchableText(service: SearchableService, category: SearchableCategory | undefined): string {
  const parts = [
    service.name,
    service.description,
    category?.name,
    ...textList(service.keywords),
    ...textList(service.tags),
    ...textList(service.aliases),
  ];
  return parts
    .filter((part): part is string => typeof part === "string")
    .map((part) => normalizeSearchText(part))
    .filter((part) => part.length > 0)
    .join(FIELD_SEPARATOR);
}

function matchesKeyword(haystack: string, keyword: string | undefined): boolean {
  const normalized = normalizeSearchText(keyword ?? "");
  if (!normalized) return true;
  return normalized.split(" ").every((token) => haystack.includes(token));
}

export function searchServices<TService extends SearchableService, TCategory extends SearchableCategory>(
  services: readonly TService[],
  categories: readonly TCategory[],
  query: ServiceSearchQuery = {},
): ServiceSearchMatch<TService, TCategory>[] {
  const categoryId = (query.categoryId ?? "").trim();
  const byId = new Map<string, TCategory>();
  for (const category of categories) {
    if (!byId.has(category.id)) byId.set(category.id, category);
  }

  const matches: ServiceSearchMatch<TService, TCategory>[] = [];
  for (const service of services) {
    if (categoryId && service.categoryId !== categoryId) continue;
    const category = byId.get(service.categoryId);
    if (!matchesKeyword(searchableText(service, category), query.keyword)) continue;
    matches.push(category ? { service, category } : { service });
  }
  return matches;
}
