import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculatePrice } from "../../lib/pricing/calculate";
import {
  SHARE_FEEDBACK,
  SHARE_PARAM_MAX,
  SHARE_SEARCH_MAX,
  SHARE_VALUE_MAX,
  decodeShareQuery,
  describeShareAnswers,
  encodeShareQuery,
  shareHref,
} from "../../lib/share/query";
import { serviceSchema, type Question } from "../../schemas/service.schema";
import { loadDemo } from "../demo";

const regions = [{ id: "beijing" }, { id: "shanghai" }];

describe("分享查询参数", () => {
  it("往返编码后用同一计价函数得到相同区间、构成、可信度和警告", async () => {
    const { service, data, answers } = await loadDemo();
    const direct = calculatePrice(service, answers, "beijing", data);
    const query = encodeShareQuery(service.questions, answers, "beijing", data.regions);
    expect(query).toBe("region=beijing&lamp-type=ceiling&quantity=2&remove-old=false");
    const decoded = decodeShareQuery(service.questions, `?${query}`, data.regions);
    expect(decoded.ready).toBe(true);
    expect(decoded.regionId).toBe("beijing");
    expect(decoded.answers).toEqual(answers);
    expect(decoded.feedback).toEqual([{ tone: "info", message: SHARE_FEEDBACK.restored }]);
    const restored = calculatePrice(service, decoded.answers, decoded.regionId!, data);
    expect(restored).toEqual(direct);
    expect(restored).toMatchObject({
      status: "estimated",
      range: { min: 80, max: 120 },
      confidence: "low",
      breakdown: direct.status === "estimated" ? direct.breakdown : [],
      warnings: direct.status === "estimated" ? direct.warnings : [],
    });
    expect(encodeShareQuery(service.questions, decoded.answers, decoded.regionId, data.regions)).toBe(query);
    const reordered = { "remove-old": false, quantity: 2, "lamp-type": "ceiling" };
    expect(encodeShareQuery(service.questions, reordered, "beijing", data.regions)).toBe(query);
  });

  it("窗帘和条件题也只按配置编码，隐藏答案不进入链接", async () => {
    const { catalog, data } = await loadDemo();
    const curtain = catalog.services.find((item) => item.id === "demo.curtain-install");
    expect(curtain).toBeDefined();
    const answers = { "mount-type": "new", "window-count": 2, "rail-length": 3.5 };
    const query = encodeShareQuery(curtain!.questions, answers, "beijing", data.regions);
    expect(query).toBe("region=beijing&mount-type=new&window-count=2&rail-length=3.5");
    const decoded = decodeShareQuery(curtain!.questions, query, data.regions);
    expect(decoded.answers).toEqual(answers);
    expect(calculatePrice(curtain!, decoded.answers, decoded.regionId!, data)).toEqual(
      calculatePrice(curtain!, answers, "beijing", data),
    );
    expect(
      encodeShareQuery(
        curtain!.questions,
        { "mount-type": "existing", "window-count": 1, "rail-length": 9 },
        "beijing",
        data.regions,
      ),
    ).toBe("region=beijing&mount-type=existing&window-count=1");
  });

  it("吸顶灯改选后不分享已隐藏的加固答案，吊灯分支会保留", async () => {
    const { service, data, answers } = await loadDemo();
    expect(encodeShareQuery(service.questions, { ...answers, heavy: true }, "beijing", data.regions)).not.toContain(
      "heavy",
    );
    const stale = decodeShareQuery(
      service.questions,
      "region=beijing&lamp-type=ceiling&quantity=2&remove-old=false&heavy=true",
      data.regions,
    );
    expect(stale.ready).toBe(true);
    expect(stale.answers).not.toHaveProperty("heavy");
    expect(stale.feedback[0]?.message).toBe(SHARE_FEEDBACK.partialInvalid);
    expect(calculatePrice(service, stale.answers, stale.regionId!, data)).toEqual(
      calculatePrice(service, answers, "beijing", data),
    );

    const pendant = { "lamp-type": "pendant", heavy: true, quantity: 1, "remove-old": false };
    const query = encodeShareQuery(service.questions, pendant, "shanghai", data.regions);
    expect(query).toBe("region=shanghai&lamp-type=pendant&heavy=true&quantity=1&remove-old=false");
    const decoded = decodeShareQuery(service.questions, `?${query}`, data.regions);
    expect(calculatePrice(service, decoded.answers, decoded.regionId!, data)).toEqual(
      calculatePrice(service, pendant, "shanghai", data),
    );
  });

  it("多选、面积和距离按选项顺序往返，0 和 false 不会丢失", () => {
    const area = serviceSchema.parse(JSON.parse(readFileSync(resolve("tests/fixtures/area-service.demo.json"), "utf8")));
    const input = { "floor-area": 12.5, extras: ["cover", "edge"], "edge-length": 0 };
    const query = encodeShareQuery(area.questions, input, "beijing", regions);
    expect(query).toBe("region=beijing&floor-area=12.5&extras=edge&extras=cover&edge-length=0");
    expect(decodeShareQuery(area.questions, `?${query}`, regions).answers).toEqual({
      "floor-area": 12.5,
      extras: ["edge", "cover"],
      "edge-length": 0,
    });
    const hidden = decodeShareQuery(area.questions, "?floor-area=8&extras=cover&edge-length=4", regions);
    expect(hidden.answers).toEqual({ "floor-area": 8, extras: ["cover"] });
    expect(hidden.feedback[0]?.message).toBe(SHARE_FEEDBACK.partialInvalid);
    const negative = decodeShareQuery(area.questions, "?extras=edge&edge-length=-1", regions);
    expect(negative.answers.extras).toEqual(["edge"]);
    expect(negative.answers["edge-length"]).toBeUndefined();
  });

  it("混合类型选项使用前缀，布尔 false 和数字 0 能区分文本", () => {
    const questions: Question[] = [
      {
        id: "extras",
        type: "multiple",
        title: "附加",
        required: true,
        options: [
          { id: "n", label: "数字", value: 0 },
          { id: "b", label: "是否", value: false },
          { id: "s", label: "文本", value: "0" },
        ],
      },
      {
        id: "tier",
        type: "select",
        title: "档次",
        required: true,
        options: [{ id: "basic", label: "基础", value: 0 }],
      },
      {
        id: "flag",
        type: "single",
        title: "标记",
        required: true,
        options: [
          { id: "on", label: "开", value: true },
          { id: "off", label: "关", value: false },
        ],
      },
    ];
    const query = encodeShareQuery(
      questions,
      { extras: [false, "0", 0], tier: 0, flag: true },
      "beijing",
      regions,
    );
    const params = new URLSearchParams(query);
    expect(params.getAll("extras")).toEqual(["n:0", "b:false", "s:0"]);
    expect(params.get("tier")).toBe("0");
    expect(params.get("flag")).toBe("true");
    const decoded = decodeShareQuery(questions, query, regions);
    expect(decoded.answers).toEqual({ extras: [0, false, "0"], tier: 0, flag: true });
    expect(encodeShareQuery(questions, decoded.answers, decoded.regionId, regions)).toBe(query);
  });

  it("问题 id 与地区参数同名时用 ~region 区分", () => {
    const questions: Question[] = [
      { id: "region", type: "boolean", title: "是否加急", required: true },
      { id: "quantity", type: "number", title: "数量", required: true, validation: { integer: true, min: 1, max: 3 } },
    ];
    const query = encodeShareQuery(questions, { region: false, quantity: 1 }, "beijing", regions);
    const params = new URLSearchParams(query);
    expect(params.get("region")).toBe("beijing");
    expect(params.get("~region")).toBe("false");
    expect(decodeShareQuery(questions, query, regions).answers).toEqual({ region: false, quantity: 1 });
  });

  it("部分参数能恢复有效字段，并保留可继续填写的状态", async () => {
    const { service, data } = await loadDemo();
    const decoded = decodeShareQuery(service.questions, "?region=beijing&lamp-type=ceiling&quantity=2", data.regions);
    expect(decoded.ready).toBe(false);
    expect(decoded.regionId).toBe("beijing");
    expect(decoded.answers).toEqual({ "lamp-type": "ceiling", quantity: 2 });
    expect(decoded.feedback).toEqual([{ tone: "info", message: SHARE_FEEDBACK.partial }]);
    expect(calculatePrice(service, decoded.answers, decoded.regionId!, data).status).toBe("invalid_input");
  });

  it("非法、超范围、未知和重复参数不会抛出，也不会写进答案", async () => {
    const { service, data } = await loadDemo();
    const cases = [
      "?quantity=-999",
      "?quantity=11",
      "?quantity=1.5",
      "?quantity=abc",
      "?quantity=2e1",
      "?quantity=+2",
      "?quantity=02",
      "?quantity=",
      "?quantity=Infinity",
      "?quantity=NaN",
      "?lamp-type=floor",
      "?lamp-type=ceiling&lamp-type=pendant",
      "?remove-old=FALSE",
      "?remove-old=no",
      "?region=not-a-city",
      "?region=beijing&region=shanghai",
      "?region=%20beijing",
      "?%ZZ=1",
      "?quantity=%ZZ",
    ];
    for (const search of cases) {
      const decoded = decodeShareQuery(service.questions, search, data.regions);
      expect(decoded.ready).toBe(false);
      expect(decoded.answers.quantity === 2 && decoded.answers["lamp-type"] === "ceiling").toBe(false);
      expect(JSON.stringify(decoded.feedback)).not.toMatch(/<|>|script|%ZZ|not-a-city/i);
    }
    const integer = decodeShareQuery(service.questions, "?quantity=2.0", data.regions);
    expect(integer.answers.quantity).toBe(2);
  });

  it("恶意字符串、超长参数和原型字段被忽略，页面数据不被污染", async () => {
    const { service, data } = await loadDemo();
    const token = "xss-token-<script>alert(1)</script>";
    const hostile = `?region=${encodeURIComponent(token)}&lamp-type=${encodeURIComponent("<img src=x onerror=alert(1)>")}&quantity=-999&remove-old=no&__proto__=1&constructor[prototype][polluted]=1`;
    const decoded = decodeShareQuery(service.questions, hostile, data.regions);
    expect(decoded.answers).toEqual({});
    expect(decoded.regionId).toBeUndefined();
    expect(decoded.ready).toBe(false);
    expect(decoded.feedback[0]?.message).toBe(SHARE_FEEDBACK.invalid);
    expect(JSON.stringify(decoded)).not.toContain("xss-token");
    expect(JSON.stringify(decoded)).not.toContain("<");
    expect(Object.hasOwn(decoded.answers, "__proto__")).toBe(false);
    expect(Object.hasOwn(decoded.answers, "constructor")).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();

    const huge = decodeShareQuery(
      service.questions,
      `?region=beijing&quantity=${"9".repeat(SHARE_VALUE_MAX + 1)}&lamp-type=ceiling`,
      data.regions,
    );
    expect(huge.regionId).toBe("beijing");
    expect(huge.answers).toEqual({ "lamp-type": "ceiling" });
    expect(huge.feedback[0]?.message).toBe(SHARE_FEEDBACK.partialInvalid);
    expect(JSON.stringify(huge)).not.toContain("9".repeat(80));

    const blocked = decodeShareQuery(service.questions, `?${"a=1&".repeat(SHARE_SEARCH_MAX)}`, data.regions);
    expect(blocked.answers).toEqual({});
    expect(blocked.feedback[0]?.message).toBe(SHARE_FEEDBACK.blocked);
    const tooMany = "?" + Array.from({ length: SHARE_PARAM_MAX + 1 }, (_, index) => `q${index}=1`).join("&");
    expect(decodeShareQuery(service.questions, tooMany, data.regions).feedback[0]?.message).toBe(SHARE_FEEDBACK.blocked);
  });

  it("完整答案加上未知参数仍重算原结果，空链接保持空白问卷", async () => {
    const { service, data, answers } = await loadDemo();
    const decoded = decodeShareQuery(
      service.questions,
      "region=guangzhou&lamp-type=ceiling&quantity=2&remove-old=false&note=1",
      data.regions,
    );
    expect(decoded.ready).toBe(true);
    expect(decoded.feedback[0]?.message).toBe(SHARE_FEEDBACK.partialInvalid);
    expect(calculatePrice(service, decoded.answers, decoded.regionId!, data)).toEqual(
      calculatePrice(service, answers, "guangzhou", data),
    );
    expect(decodeShareQuery(service.questions, "", data.regions)).toEqual({
      answers: {},
      feedback: [],
      ready: false,
    });
    expect(decodeShareQuery(service.questions, "?", data.regions).feedback).toEqual([]);
  });

  it("查询条件按可见问题和选项文案展示", async () => {
    const { service, answers } = await loadDemo();
    expect(describeShareAnswers(service.questions, { ...answers, heavy: true })).toEqual([
      { questionId: "lamp-type", title: "安装哪种灯？", value: "普通吸顶灯" },
      { questionId: "quantity", title: "安装数量", value: "2" },
      { questionId: "remove-old", title: "需要拆除旧灯吗？", value: "否" },
    ]);
    const area = serviceSchema.parse(JSON.parse(readFileSync(resolve("tests/fixtures/area-service.demo.json"), "utf8")));
    expect(describeShareAnswers(area.questions, { "floor-area": 12.5, extras: ["cover", "edge"], "edge-length": 3 })).toEqual([
      { questionId: "floor-area", title: "需要养护多少平方米？", value: "12.5 平方米" },
      { questionId: "extras", title: "需要哪些附加服务？", value: "边缘处理、家具遮盖" },
      { questionId: "edge-length", title: "需要处理的边缘有多长？", value: "3 公里" },
    ]);
  });

  it("分享地址保留 basePath 和尾部斜杠，并替换旧查询串", () => {
    expect(
      shareHref(
        "https://ruidongyuan-dot.github.io/PriceRight/estimate/demo/demo-lamp-install/?old=1#price",
        "region=beijing&lamp-type=ceiling&quantity=2&remove-old=false",
      ),
    ).toBe(
      "https://ruidongyuan-dot.github.io/PriceRight/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false",
    );
    expect(shareHref("http://127.0.0.1:3178/estimate/demo/demo-lamp-install/", "region=beijing")).toBe(
      "http://127.0.0.1:3178/estimate/demo/demo-lamp-install/?region=beijing",
    );
    expect(shareHref("http://127.0.0.1:3178/estimate/demo/demo-lamp-install/?region=beijing", "")).toBe(
      "http://127.0.0.1:3178/estimate/demo/demo-lamp-install/",
    );
  });
});
