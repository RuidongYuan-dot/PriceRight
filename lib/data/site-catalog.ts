import { cache } from "react";
import { loadCatalog } from "./loader";

export const getCatalog = cache((demo: boolean) => loadCatalog(demo ? "data/fixtures" : "data", demo));

type Section = "categories" | "services" | "estimate";

function pathSegments(id: string, demo: boolean) {
  return demo ? ["demo", id] : [id];
}

export function catalogHref(section: Section, id: string, demo: boolean) {
  return "/" + [section, ...pathSegments(id, demo)].map(encodeURIComponent).join("/");
}

export async function catalogParams(section: Section) {
  const groups = await Promise.all(
    [false, true].map(async (demo) => {
      const catalog = await getCatalog(demo);
      const ids =
        section === "categories"
          ? catalog.categories.map((category) => category.id)
          : catalog.services
              .filter((service) =>
                section === "estimate" ? service.status === "active" : service.status !== "draft",
              )
              .map((service) => service.slug);
      return ids.map((id) => ({ path: pathSegments(id, demo) }));
    }),
  );
  return groups.flat();
}

export async function resolveCatalogPath(path: string[]) {
  const demo = path.length === 2 && path[0] === "demo";
  if (!demo && path.length !== 1) return undefined;
  return { demo, id: path[demo ? 1 : 0], catalog: await getCatalog(demo) };
}
