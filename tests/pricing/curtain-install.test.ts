import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { calculatePrice } from "../../lib/pricing/calculate";

it("窗帘演示按窗户数和可见的导轨长度计费，只使用本服务样本", async () => {
  const catalog = await loadCatalog("data/fixtures", true);
  const service = catalog.services.find(({ id }) => id === "demo.curtain-install");
  if (!service) throw new Error("缺少窗帘安装演示服务");
  const data = { regions: catalog.regions, samples: catalog["price-samples"] };
  const answers = { "window-count": 2, "rail-length": 3.5 };

  expect(calculatePrice(service, { ...answers, "mount-type": "new" }, "beijing", data)).toMatchObject({
    status: "estimated",
    demo: true,
    range: { min: 75, max: 113 },
    typical: 90,
    sampleCount: 1,
    sources: [{ sampleId: "demo-curtain-bj" }],
  });
  expect(calculatePrice(service, { ...answers, "mount-type": "existing" }, "beijing", data)).toMatchObject({
    status: "estimated",
    range: { min: 40, max: 60 },
  });
  expect(calculatePrice(service, { ...answers, "mount-type": "new" }, "shanghai", data)).toMatchObject({
    status: "insufficient_data",
  });
});
