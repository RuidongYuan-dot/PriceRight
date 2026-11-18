import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { collections, validateCatalog, type Catalog, type Collection } from "./validator";

async function* jsonFiles(root: string, skipFixtures = false): AsyncGenerator<string> {
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (skipFixtures && entry.isDirectory() && entry.name === "fixtures") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(path);
    else if (entry.name.endsWith(".json")) yield path;
  }
}

export async function loadCatalog(root: string, demo = false): Promise<Catalog> {
  const data: Catalog = { categories: [], services: [], regions: [], "price-samples": [] };
  for await (const path of jsonFiles(root, !demo)) {
    const key = relative(root, path).split(sep)[0] as Collection;
    if (!Object.hasOwn(collections, key)) throw new Error(path + " 不属于已知数据目录");
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path, "utf8"));
    } catch {
      throw new Error(path + " 无法读取有效 JSON");
    }
    for (const [i, entry] of (Array.isArray(raw) ? raw : [raw]).entries()) {
      const parsed = collections[key].safeParse(entry);
      if (!parsed.success) throw new Error(path + "[" + i + "] " + parsed.error.message);
      // 每条记录已通过对应集合的 Schema。
      (data[key] as Catalog[Collection][number][]).push(parsed.data);
    }
  }
  const errors = validateCatalog(data, demo);
  if (errors.length) throw new Error(root + "\n" + errors.join("\n"));
  return data;
}
