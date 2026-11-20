"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { FilterCategory } from "../../lib/search/list-services";
import { searchServices, type DirectoryService, type SearchableCategory } from "../../lib/search/services";

export type ServiceSearchGroup = {
  services: readonly DirectoryService[];
  categories: readonly SearchableCategory[];
};

type ServiceSearchProps = {
  groups: readonly ServiceSearchGroup[];
  categories: readonly FilterCategory[];
  initialCategoryId?: string;
  showDemoNotice?: boolean;
  children?: ReactNode;
};

function ServiceCards({ services }: { services: readonly DirectoryService[] }) {
  return (
    <ul className="tile-grid result-list" aria-label="服务列表">
      {services.map((service) => (
        <li key={`${service.demo ? "demo" : "live"}:${service.id}`}>
          <Link className={service.demo ? "tile demo-tile" : "tile"} href={service.href}>
            <span>
              <strong>{service.name}</strong>
              {service.categoryName ? <small>{service.categoryName}</small> : null}
              <small>{service.status === "coming_soon" ? "数据建设中" : service.description}</small>
              <span className={service.demo ? "origin-badge demo" : "origin-badge live"}>
                {service.demo ? "演示数据" : "正式数据"}
              </span>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SearchResults({
  services,
  keywordActive,
  categoryName,
  showDemoNotice,
  onClear,
}: {
  services: readonly DirectoryService[];
  keywordActive: boolean;
  categoryName?: string;
  showDemoNotice: boolean;
  onClear: () => void;
}) {
  if (services.length === 0) {
    return (
      <div className="empty-results">
        <p role="status">
          {keywordActive
            ? "没有找到匹配的服务。可以换一个关键词，或清空当前搜索和分类筛选。"
            : "此分类的价格数据建设中。"}
        </p>
        <button type="button" className="button secondary" onClick={onClear}>
          清空搜索与筛选
        </button>
      </div>
    );
  }

  const count = categoryName ? `${categoryName} · ${services.length} 项服务` : `${services.length} 项服务`;
  return (
    <div className="catalog-results">
      <p className="result-count muted" role="status">
        {count}
      </p>
      {showDemoNotice && services.some((service) => service.demo) && (
        <p className="notice">带「演示数据」标记的结果来自合成数据，只用于体验查询流程，不是市场价格。</p>
      )}
      <ServiceCards services={services} />
    </div>
  );
}

export function ServiceSearch({
  groups,
  categories,
  initialCategoryId = "",
  showDemoNotice = true,
  children,
}: ServiceSearchProps) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const keywordActive = keyword.trim() !== "";
  const categoryActive = categoryId.trim() !== "";
  const queryActive = keywordActive || categoryActive;
  const matches = queryActive
    ? groups.flatMap((group) =>
        searchServices(group.services, group.categories, { keyword, categoryId }).map((hit) => hit.service),
      )
    : groups.flatMap((group) => group.services);
  const showResults = queryActive || children == null;

  function clearFilters() {
    setKeyword("");
    setCategoryId("");
    inputRef.current?.focus();
  }

  return (
    <div className="catalog-search">
      <form
        role="search"
        aria-label="搜索服务"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="service-search">
          <label htmlFor={inputId}>搜索服务</label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            value={keyword}
            placeholder="搜索名称、简介或分类"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={hintId}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <p id={hintId} className="muted search-hint">
            可按服务名称、简介、关键词或分类名称筛选。
          </p>
        </div>
      </form>
      {categories.length > 0 && (
        <div className="filter-tags" role="group" aria-label="按分类筛选">
          <button
            type="button"
            className="filter-tag"
            aria-pressed={categoryId === ""}
            onClick={() => setCategoryId("")}
          >
            全部
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="filter-tag"
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
      {showResults ? (
        <SearchResults
          services={matches}
          keywordActive={keywordActive}
          categoryName={categories.find((category) => category.id === categoryId)?.name}
          showDemoNotice={showDemoNotice}
          onClear={clearFilters}
        />
      ) : (
        <div className="catalog-browse">{children}</div>
      )}
    </div>
  );
}
