import { expect, it } from "vitest";
import { serviceSchema } from "../../schemas/service.schema";
import { normalizeSearchText, searchServices, type SearchableCategory, type SearchableService } from "../../lib/search/services";
import { loadDemo } from "../demo";

const categories: SearchableCategory[] = [
  { id: "decor", name: "家居布置", description: "只出现在分类简介里的稀有词" },
  { id: "clean", name: "家政  清洁" },
  { id: "auto", name: "汽车服务" },
];

const services: SearchableService[] = [
  {
    id: "mural",
    name: "壁画固定",
    description: "把装饰画固定到墙面",
    categoryId: "decor",
    keywords: ["换挂钩"],
    tags: ["wall art"],
    aliases: ["挂画安装费"],
  },
  {
    id: "screen",
    name: "纱窗修补",
    description: "更换破损纱网",
    categoryId: "decor",
  },
  {
    id: "hood",
    name: "油烟机清洗",
    description: "厨房排烟设备清洁",
    categoryId: "clean",
    keywords: ["Range Hood"],
  },
  {
    id: "floor",
    name: "Floor Care",
    description: "Clean the floor",
    categoryId: "clean",
  },
];

function ids(keyword?: string, categoryId?: string) {
  return searchServices(services, categories, { keyword, categoryId }).map((hit) => hit.service.id);
}

it("精确命中服务名称", () => {
  expect(ids("壁画固定")).toEqual(["mural"]);
});

it("按简介、关键词、标签、别名和分类名做子串匹配", () => {
  expect(ids("纱网")).toEqual(["screen"]);
  expect(ids("挂钩")).toEqual(["mural"]);
  expect(ids("wall art")).toEqual(["mural"]);
  expect(ids("挂画安装费")).toEqual(["mural"]);
  expect(ids("汽车")).toEqual([]);
  expect(ids("排烟")).toEqual(["hood"]);
});

it("忽略英文大小写、全角字符和首尾及连续空白", () => {
  expect(normalizeSearchText("  Ｆｌｏｏｒ\u3000\u3000ＣＡＲＥ  ")).toBe("floor care");
  expect(ids("  floor    CARE  ")).toEqual(["floor"]);
  expect(ids("ｒａｎｇｅ   hood")).toEqual(["hood"]);
  expect(ids("家政   清洁")).toEqual(["hood", "floor"]);
  expect(ids("   ")).toEqual(["mural", "screen", "hood", "floor"]);
});

it("多个词需要分别命中，且不能跨字段粘成一个词", () => {
  expect(ids("厨房 油烟")).toEqual(["hood"]);
  expect(ids("壁画纱窗")).toEqual([]);
});

it("分类筛选与关键词叠加，未知道分类没有结果", () => {
  expect(ids(undefined, "decor")).toEqual(["mural", "screen"]);
  expect(ids("纱窗", "decor")).toEqual(["screen"]);
  expect(ids("油烟", "decor")).toEqual([]);
  expect(ids("油烟", "missing")).toEqual([]);
  expect(ids("油烟", "  ")).toEqual(["hood"]);
  expect(ids(undefined, "Decor")).toEqual([]);
});

it("不匹配分类简介，重复分类 id 只用第一个名称", () => {
  expect(ids("稀有词")).toEqual([]);
  const duplicated: SearchableCategory[] = [
    { id: "decor", name: "第一分类名" },
    { id: "decor", name: "第二分类名" },
  ];
  const only = [services[0]];
  expect(searchServices(only, duplicated, { keyword: "第一分类名" })).toHaveLength(1);
  expect(searchServices(only, duplicated, { keyword: "第二分类名" })).toHaveLength(0);
});

it("保留输入顺序和对象本身，空查询返回全部", () => {
  const reversed = [...services].reverse();
  const matched = searchServices(reversed, categories, { keyword: "a" });
  expect(matched.map((hit) => hit.service.id)).toEqual(["floor", "hood", "mural"]);
  expect(matched[0]?.service).toBe(reversed[0]);
  expect(searchServices(services, categories)).toEqual(
    searchServices(services, categories, { keyword: "", categoryId: "" }),
  );
  const snapshot = structuredClone(services);
  searchServices(services, categories, { keyword: "  mural  " });
  expect(services).toEqual(snapshot);
});

it("没有命中时返回空数组，特殊字符按字面量比较", () => {
  expect(ids("不存在的服务")).toEqual([]);
  expect(ids("画(")).toEqual([]);
  expect(ids("a.b")).toEqual([]);
});

it("缺少分类资料时仍可按服务自身文字检索", () => {
  const matched = searchServices([services[2]], [], { keyword: "油烟机" });
  expect(matched).toEqual([{ service: services[2] }]);
});

it("服务配置可以附带搜索关键词，已有数据不强制填写", async () => {
  const { service } = await loadDemo();
  expect(service.keywords).toBeUndefined();
  expect(serviceSchema.parse({ ...service, keywords: ["换灯泡", "Ceiling"] }).keywords).toEqual([
    "换灯泡",
    "Ceiling",
  ]);
  expect(serviceSchema.parse({ ...service, keywords: [] }).keywords).toEqual([]);
  expect(serviceSchema.safeParse({ ...service, keywords: ["灯", "灯"] }).success).toBe(false);
  expect(serviceSchema.safeParse({ ...service, keywords: ["   "] }).success).toBe(false);
});
