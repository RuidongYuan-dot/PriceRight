import { cp, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadCatalog } from "../../lib/data/loader";
import { calculatePrice } from "../../lib/pricing/calculate";
import { nextQuestion } from "../../lib/question-engine/evaluate";

it("向已有目录添加服务和样本 JSON 即可驱动新的问题流程和计价方式", async () => {
  const root = await mkdtemp(join(tmpdir(), "priceright-config-"));
  try {
    await cp("data/fixtures", root, { recursive: true });
    await copyFile("tests/fixtures/area-service.demo.json", join(root, "services", "floor-care.json"));

    async function openService() {
      const catalog = await loadCatalog(root, true);
      const service = catalog.services.find((s) => s.id === "demo.floor-care");
      if (!service) throw new Error("未从新增 JSON 加载测试服务");
      const data = { regions: catalog.regions, samples: catalog["price-samples"] };
      return {
        questions: service.questions,
        quote: (input: Record<string, unknown>) => calculatePrice(service, input, "beijing", data),
      };
    }

    const input = { "floor-area": 12, extras: ["edge", "cover"], "edge-length": 4 };
    // 同城已有吸顶灯样本，新服务仍须有自己的价格依据。
    expect((await openService()).quote(input).status).toBe("insufficient_data");

    const sample = {
      id: "demo-floor-test", serviceId: "demo.floor-care", regionId: "beijing",
      price: 50, currency: "CNY", sampleType: "manual_reference", source: "架构测试合成样本",
      collectedAt: "2026-11-01", verified: true, demo: true,
    };
    await writeFile(join(root, "price-samples", "floor-care.json"), JSON.stringify(sample));
    const { questions, quote } = await openService();

    expect(nextQuestion(questions, { "floor-area": 12, extras: ["edge"] }, "extras")?.id).toBe("edge-length");
    expect(quote({ "floor-area": 12, extras: ["edge"] })).toMatchObject({
      status: "invalid_input", errors: [{ questionId: "edge-length" }],
    });
    expect(quote(input)).toMatchObject({
      status: "estimated", demo: true, sampleCount: 1, sources: [{ sampleId: sample.id }],
      range: { min: 31, max: 61 },
    });
    expect(quote(input)).toEqual(quote(input));
    // 取消边缘处理后，即使保留旧长度，也只计面积和家具遮盖。
    expect(quote({ ...input, extras: ["cover"] })).toMatchObject({ range: { min: 27, max: 53 } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
