import { resolve } from "node:path";
import { loadCatalog } from "../lib/data/loader";
import { calculatePrice } from "../lib/pricing/calculate";

export async function loadDemo() {
  const catalog = await loadCatalog(resolve("data/fixtures"), true);
  const [service] = catalog.services;
  const data = { regions: catalog.regions, samples: catalog["price-samples"] };
  const answers = { "lamp-type": "ceiling", quantity: 2, "remove-old": false };
  const quote = (changes = {}, region = "beijing") =>
    calculatePrice(service, { ...answers, ...changes }, region, data);
  return { catalog, service, data, answers, quote };
}
