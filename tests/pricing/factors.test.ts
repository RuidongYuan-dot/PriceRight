import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { priceInfluenceFactors } from "../../lib/pricing/factors";
import { serviceSchema, type Service } from "../../schemas/service.schema";
import floorFixture from "../fixtures/area-service.demo.json";
import { loadDemo } from "../demo";

function labels(service: Service, regions: Awaited<ReturnType<typeof loadDemo>>["data"]["regions"]) {
  const factors = priceInfluenceFactors(service, regions);
  return {
    up: factors.up.map((factor) => factor.label),
    down: factors.down.map((factor) => factor.label),
    factors,
  };
}

it("从不同服务配置推导升降因素，界面不写死具体服务", async () => {
  for (const file of ["components/estimate/flow.tsx", "components/estimate/result.tsx", "components/estimate/question-field.tsx"]) {
    expect(readFileSync(file, "utf8")).not.toMatch(/吸顶灯|窗帘|lamp-install|curtain-install/);
  }
  const { catalog, service: lamp, data } = await loadDemo();
  const curtain = catalog.services.find((item) => item.id === "demo.curtain-install");
  if (!curtain) throw new Error("缺少窗帘安装演示服务");
  const regions = data.regions;

  const lampFactors = labels(lamp, regions);
  expect(lampFactors.up).toEqual(["加固", "拆除旧灯", "安装数量", "上海会上调价格"]);
  expect(lampFactors.down).toEqual(["「吊灯需要额外加固吗？」选「否」", "「需要拆除旧灯吗？」选「否」"]);
  expect(lampFactors.factors.up.find((factor) => factor.label === "拆除旧灯")?.detail).toContain("用量越高");
  expect(lampFactors.factors).toEqual(priceInfluenceFactors(lamp, regions));

  const curtainFactors = labels(curtain, regions);
  expect(curtainFactors.up).toEqual(["导轨安装人工", "需要安装几扇窗的窗帘？"]);
  expect(curtainFactors.down).toEqual(["使用现有导轨"]);
  expect(curtainFactors.up.join()).not.toContain("拆除");
  expect(lampFactors.up.join()).not.toContain("导轨");

  const floor = labels(serviceSchema.parse(floorFixture), regions);
  expect(floor.up).toEqual(["边缘处理", "遮盖", "需要养护多少平方米？"]);
  expect(floor.down).toEqual(["「需要哪些附加服务？」先不选"]);

  const custom = structuredClone(curtain);
  custom.questions = [
    {
      id: "speed",
      type: "single",
      title: "希望多快完成？",
      required: true,
      options: [
        { id: "normal", label: "普通排队", value: "normal" },
        { id: "rush", label: "加急", value: "rush", priceModifier: [{ type: "percentage", label: "加急费", value: 20 }] },
      ],
    },
    { id: "distance", type: "distance", title: "上门距离有多远？", required: true, validation: { min: 0 } },
  ];
  custom.pricing = {
    model: "fixed",
    basePrice: { min: 100, max: 100 },
    modifiers: [
      {
        type: "fixed",
        label: "远途",
        min: 30,
        max: 50,
        conditions: [{ questionId: "distance", operator: "greater_than", value: 10 }],
      },
    ],
    regionRules: [
      { regionId: "shanghai", multiplier: 0.9 },
      { regionId: "beijing", priceOverride: { min: 80, max: 80 } },
      { regionId: "guangzhou", priceOverride: { min: 150, max: 150 } },
    ],
    minimumSampleCount: 5,
  };
  const customFactors = labels(custom, regions);
  expect(customFactors.up).toEqual(["加急费", "远途", "广州基础费用更高"]);
  expect(customFactors.down).toEqual(["普通排队", "不满足「远途」的条件", "上海会下调价格", "北京基础费用更低"]);
  expect(customFactors.factors.up.find((factor) => factor.label === "加急费")?.detail).toContain("按比例提高");
  expect(customFactors.factors.up.find((factor) => factor.label === "远途")?.detail).toContain("大于 10");
  expect(JSON.stringify(customFactors.factors)).not.toContain("¥");

  const plain = structuredClone(curtain);
  plain.questions = [{ id: "weekend", type: "boolean", title: "是否周末？", required: true }];
  plain.pricing = { model: "fixed", basePrice: { min: 40, max: 40 }, modifiers: [], regionRules: [], minimumSampleCount: 5 };
  expect(priceInfluenceFactors(plain, regions)).toEqual({ up: [], down: [] });
});
