import { resolve } from "node:path";
import { loadCatalog } from "../lib/data/loader";

try {
  const root = resolve(process.argv[2] ?? "data");
  for (const demo of [false, true]) {
    const data = await loadCatalog(demo ? resolve(root, "fixtures") : root, demo);
    console.log((demo ? "demo" : "正式数据") + " 校验通过", {
      services: data.services.length,
      samples: data["price-samples"].length,
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "数据校验失败");
  process.exitCode = 1;
}
