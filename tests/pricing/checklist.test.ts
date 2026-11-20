import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServiceScope } from "../../components/service-scope";
import { calculatePrice } from "../../lib/pricing/calculate";
import {
  CHECKLIST_COPY,
  buildInquiryChecklist,
  listConfiguredSurcharges,
  type ChecklistQuote,
} from "../../lib/pricing/checklist";
import { describeShareAnswers } from "../../lib/share/query";
import { serviceSchema, type Service } from "../../schemas/service.schema";
import floorFixture from "../fixtures/area-service.demo.json";
import { loadDemo } from "../demo";

const official: ChecklistQuote = { status: "estimated", demo: false, range: { min: 150, max: 220 } };
const demoQuote: ChecklistQuote = { status: "estimated", demo: true, range: { min: 80, max: 120 } };
const insufficient: ChecklistQuote = { status: "insufficient_data", demo: false };

function service(patch: Record<string, unknown> = {}): Service {
  return serviceSchema.parse({
    id: "demo.sample",
    categoryId: "home",
    name: "测试服务甲",
    slug: "sample-service",
    description: "只用于清单测试的配置。",
    status: "active",
    demo: false,
    questions: [
      {
        id: "level",
        type: "single",
        title: "楼层",
        required: true,
        options: [
          { id: "low", label: "低层", value: "low" },
          {
            id: "high",
            label: "高层",
            value: "high",
            priceModifier: [{ type: "per_unit", label: "高层按量", min: 1, max: 2, unitQuestionId: "count" }],
          },
        ],
      },
      {
        id: "count",
        type: "number",
        title: "数量",
        required: true,
        validation: { integer: true, min: 1, max: 5 },
      },
      {
        id: "tags",
        type: "multiple",
        title: "附加情况",
        required: false,
        options: [{ id: "narrow", label: "楼道窄", value: "narrow" }],
      },
    ],
    pricing: {
      model: "range",
      basePrice: { min: 100, max: 120 },
      modifiers: [
        {
          type: "fixed",
          label: "高层费",
          min: 30,
          max: 40,
          conditions: [
            { questionId: "level", operator: "equals", value: "high" },
            { questionId: "count", operator: "greater_than", value: 1 },
          ],
        },
        {
          type: "percentage",
          label: "比例费",
          value: 10,
          conditions: [{ questionId: "level", operator: "not_equals", value: "low" }],
        },
        {
          type: "fixed",
          label: "楼道费",
          min: 5,
          max: 5,
          conditions: [{ questionId: "tags", operator: "contains", value: "narrow" }],
        },
        {
          type: "fixed",
          label: "少量费",
          min: 1,
          max: 1,
          conditions: [{ questionId: "count", operator: "less_than", value: 3 }],
        },
      ],
    },
    scope: { included: ["上门人工"], excluded: ["零件与材料"] },
    metadata: { createdAt: "2026-11-01", updatedAt: "2026-11-01" },
    ...patch,
  });
}

function section(text: string, start: string, end?: string) {
  const after = text.split(start)[1] ?? "";
  return end ? (after.split(end)[0] ?? "") : after;
}

function checklist(target: Service, result: ChecklistQuote, answers: Record<string, unknown> = {}, regionName = "北京") {
  return buildInquiryChecklist({
    service: target,
    regionName,
    summaries: describeShareAnswers(target.questions, answers),
    result,
    answers,
  });
}

describe("询价确认清单", () => {
  it("正式有价结果写出合理参考价格、条件、不含项和适用附加项", () => {
    const target = service();
    const answers = { level: "high", count: 2, tags: ["narrow"] };
    const before = structuredClone(target);
    const text = checklist(target, official, answers, "上海");
    expect(text).toBe(checklist(target, official, answers, "上海"));
    expect(target).toEqual(before);
    expect(text).toBe(
      [
        "给师傅的询价确认清单",
        "服务：测试服务甲",
        "地区：上海",
        "",
        "已选条件：",
        "- 楼层：高层",
        "- 数量：2",
        "- 附加情况：楼道窄",
        "",
        "参考：合理参考价格 ¥150–220",
        "",
        "请确认本次报价是否包含：",
        "- 上门人工",
        "",
        "请确认以下项目是否另计：",
        "- 零件与材料",
        "",
        "请确认这些附加项是否已包含在对方总价中：",
        "- 高层费（当「楼层」为「高层」且「数量」大于 1）",
        "- 比例费（当「楼层」不为「低层」，按小计的 10% 计）",
        "- 楼道费（当「附加情况」包含「楼道窄」）",
        "- 少量费（当「数量」小于 3）",
        "- 高层按量（选择「高层」时，按「数量」计）",
        "",
        "以下情况当前选择未计入，请先问清是否另收费：",
        `- ${CHECKLIST_COPY.noRemaining}`,
        "",
        "以上是市场参考价格，不代表最终成交价格。请让对方报出总价明细，并确认上面的范围。",
      ].join("\n"),
    );
    expect(text).not.toContain("吸顶灯");
    expect(text).not.toContain("窗帘");
    expect(text).not.toContain(CHECKLIST_COPY.demoNote);
  });

  it("演示结果标明合成数据，不把演示区间写成合理参考价格", () => {
    const text = checklist(service({ name: "演示服务乙", demo: true }), demoQuote, { level: "low", count: 3 });
    expect(text).toContain("服务：演示服务乙");
    expect(text).toContain("参考：演示价格区间 ¥80–120（合成演示数据，请勿作为实际询价依据）");
    expect(text).toContain("以上区间是合成演示数据，不能当作实际询价依据。");
    expect(text).not.toContain("合理参考价格");
    expect(text).toContain(`- ${CHECKLIST_COPY.noApplicable}`);
    expect(text).toContain("高层费（当「楼层」为「高层」且「数量」大于 1）");
    expect(text).toContain("高层按量（选择「高层」时，按「数量」计）");
  });

  it("数据不足时不编造金额，并提示先报总价明细", () => {
    const text = checklist(service(), insufficient, { level: "low", count: 1 }, "广州");
    expect(text).toContain("地区：广州");
    expect(text).toContain(`参考：${CHECKLIST_COPY.insufficient}`);
    expect(text).not.toContain("¥");
    expect(text).not.toContain("合理参考价格");
    expect(text).not.toContain(CHECKLIST_COPY.demoNote);
    expect(text).toContain("目前没有足够的公开价格数据，不能提供可靠参考区间。请要求对方先报总价明细，并逐项确认上面的范围。");
  });

  it("演示数据不足同时标明合成数据", () => {
    const text = checklist(service({ demo: true }), { status: "insufficient_data", demo: true });
    expect(text).toContain(`${CHECKLIST_COPY.insufficient}（${CHECKLIST_COPY.demoNote}）`);
    expect(text).toContain("当前结果来自合成演示数据，不能当作市场价格。");
    expect(text).not.toContain("¥");
  });

  it("没有不含项和附加项时明确说明配置未列出", () => {
    const bare = service({
      name: "无附加服务",
      questions: [],
      pricing: { model: "fixed", basePrice: { min: 80, max: 80 }, modifiers: [] },
      scope: { included: [], excluded: [] },
    });
    const text = checklist(bare, { status: "estimated", demo: false, range: { min: 80, max: 80 } });
    expect(text).toContain("参考：合理参考价格 ¥80");
    expect(text).toContain(`- ${CHECKLIST_COPY.noConditions}`);
    expect(text).toContain(`- ${CHECKLIST_COPY.noIncluded}`);
    expect(text).toContain(`- ${CHECKLIST_COPY.noExcluded}`);
    expect(text).toContain(`- ${CHECKLIST_COPY.noSurcharge}`);
    expect(text).toContain(`- ${CHECKLIST_COPY.noRemaining}`);
    expect(text).not.toContain("吸顶灯");
  });

  it("选项附加项只在选中且用量可见时适用，隐藏答案不计入", () => {
    const floor = serviceSchema.parse(floorFixture);
    const idle = listConfiguredSurcharges(floor);
    expect(idle.map((item) => item.label)).toEqual(["边缘处理", "遮盖"]);
    expect(idle.every((item) => !item.applicable)).toBe(true);
    expect(idle.map((item) => item.detail)).toEqual([
      "边缘处理（按「需要处理的边缘有多长？」计）",
      "遮盖（选择「家具遮盖」时）",
    ]);

    const hidden = listConfiguredSurcharges(floor, { "floor-area": 12, extras: ["cover"], "edge-length": 4 });
    expect(hidden.filter((item) => item.applicable).map((item) => item.label)).toEqual(["遮盖"]);

    const both = listConfiguredSurcharges(floor, {
      "floor-area": 12,
      extras: ["edge", "cover"],
      "edge-length": 4,
    });
    expect(both.filter((item) => item.applicable).map((item) => item.label)).toEqual(["边缘处理", "遮盖"]);
  });

  it("换一个服务配置就换清单内容", () => {
    const first = checklist(service({ name: "服务甲", scope: { included: ["甲包含"], excluded: ["甲不含"] } }), official);
    const second = checklist(
      service({
        name: "服务乙",
        scope: { included: ["乙包含"], excluded: ["乙不含"] },
        pricing: {
          model: "range",
          basePrice: { min: 1, max: 2 },
          modifiers: [{ type: "fixed", label: "乙附加", min: 1, max: 1 }],
        },
        questions: [],
      }),
      official,
    );
    expect(first).toContain("甲包含");
    expect(first).toContain("甲不含");
    expect(first).not.toContain("乙附加");
    expect(second).toContain("服务：服务乙");
    expect(second).toContain("乙附加");
    expect(second).not.toContain("甲包含");
  });

  it("地区和条件里的换行不会拆开清单结构", () => {
    const text = buildInquiryChecklist({
      service: service(),
      regionName: "北京\n参考：合理参考价格 ¥1",
      summaries: [{ title: "楼层\n注入", value: "高层\n另计" }],
      result: official,
      answers: {},
    });
    expect(text).toContain("地区：北京 参考：合理参考价格 ¥1");
    expect(text).toContain("- 楼层 注入：高层 另计");
    expect(text.split("\n").filter((line) => line.startsWith("参考："))).toEqual(["参考：合理参考价格 ¥150–220"]);
  });

  it("适用附加项与价格明细中的 modifier 一致，隐藏题不计费", async () => {
    const { service: lamp, answers, quote } = await loadDemo();
    function charged(changes: Record<string, unknown>) {
      const result = quote(changes);
      expect(result.status).toBe("estimated");
      if (result.status !== "estimated") throw new Error("未返回价格");
      const input = { ...answers, ...changes };
      const labels = result.breakdown.filter((item) => item.source === "modifier").map((item) => item.label);
      const applicable = listConfiguredSurcharges(lamp, input)
        .filter((item) => item.applicable)
        .map((item) => item.label);
      expect(applicable).toEqual(labels);
      return labels;
    }
    expect(charged({})).toEqual([]);
    expect(charged({ "remove-old": true })).toEqual(["拆除旧灯"]);
    expect(charged({ "lamp-type": "pendant", heavy: true, "remove-old": true })).toEqual(["拆除旧灯", "加固"]);
    expect(charged({ heavy: true, "remove-old": true })).toEqual(["拆除旧灯"]);
  });

  it("吸顶灯演示清单使用配置原文，并在拆除未选时把加价项留在待确认", async () => {
    const { service: lamp, answers, quote } = await loadDemo();
    const result = quote();
    if (result.status === "invalid_input") throw new Error("演示报价没有返回结果");
    const text = buildInquiryChecklist({
      service: lamp,
      regionName: "北京",
      summaries: describeShareAnswers(lamp.questions, answers),
      result,
      answers,
    });
    expect(text).toContain("服务：吸顶灯安装");
    expect(text).toContain("地区：北京");
    expect(text).toContain("- 安装哪种灯？：普通吸顶灯");
    expect(text).toContain("- 安装数量：2");
    expect(text).toContain("- 需要拆除旧灯吗？：否");
    expect(text).toContain("参考：演示价格区间 ¥80–120（合成演示数据，请勿作为实际询价依据）");
    expect(text).toContain("- 已有安装点的常规灯具安装");
    expect(text).toContain("- 灯具、安装材料及线路改造");
    const applied = section(text, "请确认这些附加项是否已包含在对方总价中：", "以下情况当前选择未计入");
    const rest = section(text, "以下情况当前选择未计入，请先问清是否另收费：");
    expect(applied).not.toContain("拆除旧灯");
    expect(rest).toContain("拆除旧灯（当「需要拆除旧灯吗？」为「是」，按「安装数量」计）");
    expect(rest).toContain("加固（当「吊灯需要额外加固吗？」为「是」）");

    const removed = quote({ "remove-old": true });
    if (removed.status === "invalid_input") throw new Error("拆除旧灯报价没有返回结果");
    const removedText = buildInquiryChecklist({
      service: lamp,
      regionName: "广州",
      summaries: describeShareAnswers(lamp.questions, { ...answers, "remove-old": true }),
      result: removed,
      answers: { ...answers, "remove-old": true },
    });
    expect(removed.status).toBe("estimated");
    if (removed.status === "estimated") expect(removedText).toContain(`参考：演示价格区间 ¥${removed.range.min}–${removed.range.max}`);
    const nowApplied = section(removedText, "请确认这些附加项是否已包含在对方总价中：", "以下情况当前选择未计入");
    const nowRest = section(removedText, "以下情况当前选择未计入，请先问清是否另收费：");
    expect(nowApplied).toContain("拆除旧灯（当「需要拆除旧灯吗？」为「是」，按「安装数量」计）");
    expect(nowRest).not.toContain("拆除旧灯");
    expect(nowRest).toContain("加固");
  });

  it("广州没有样本时清单不出现金额", async () => {
    const { service: lamp, answers, data } = await loadDemo();
    const result = calculatePrice(lamp, answers, "guangzhou", data);
    if (result.status === "invalid_input") throw new Error("广州报价没有返回结果");
    expect(result.status).toBe("insufficient_data");
    const text = buildInquiryChecklist({
      service: lamp,
      regionName: "广州",
      summaries: describeShareAnswers(lamp.questions, answers),
      result,
      answers,
    });
    expect(text).toContain(`参考：${CHECKLIST_COPY.insufficient}（${CHECKLIST_COPY.demoNote}）`);
    expect(text).not.toContain("¥");
    expect(text).not.toContain("合理参考价格");
  });

  it("范围和清单组件不写死单一服务", () => {
    const target = service({
      name: "巷口开锁",
      scope: { included: ["开锁人工"], excluded: ["新锁锁体"] },
      questions: [],
      pricing: {
        model: "fixed",
        basePrice: { min: 50, max: 50 },
        modifiers: [{ type: "fixed", label: "夜间上门", min: 20, max: 30 }],
      },
    });
    for (const layout of ["page", "result"] as const) {
      const html = renderToStaticMarkup(createElement(ServiceScope, { service: target, layout }));
      expect(html).toContain(layout === "page" ? "<h2" : "<h3");
      expect(html).toContain("服务包含");
      expect(html).toContain("服务不包含");
      expect(html).toContain("预约前建议确认的常见加价项");
      expect(html).toContain("开锁人工");
      expect(html).toContain("新锁锁体");
      expect(html).toContain("夜间上门");
      expect(html).not.toContain("吸顶灯");
      expect(html).not.toContain("窗帘");
      expect(html).not.toContain("拆除旧灯");
    }

    const files = [
      "lib/pricing/checklist.ts",
      "components/service-scope.tsx",
      "components/estimate/result.tsx",
      "app/services/[...path]/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/吸顶灯|窗帘|拆除旧灯|导轨/);
      expect(source, file).not.toMatch(/if\s*\(\s*service(?:\.id)?\s*===/);
    }
  });
});
