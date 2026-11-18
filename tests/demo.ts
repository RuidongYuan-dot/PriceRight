import { resolve } from "node:path";
import { loadCatalog } from "../lib/data/loader";
import { calculatePrice } from "../lib/pricing/calculate";

export async function loadDemo() {
  const catalog = await loadCatalog(resolve("data/fixtures"), true);
  const service = catalog.services.find(({ id }) => id === "demo.lamp-install");
  if (!service) throw new Error("缺少吸顶灯演示服务");
  const samples = catalog["price-samples"].filter(({ serviceId }) => serviceId === service.id);
  const data = { regions: catalog.regions, samples };
  const answers = { "lamp-type": "ceiling", quantity: 2, "remove-old": false };
  const quote = (changes = {}, region = "beijing") =>
    calculatePrice(service, { ...answers, ...changes }, region, data);
  return { catalog, service, data, answers, quote };
}
