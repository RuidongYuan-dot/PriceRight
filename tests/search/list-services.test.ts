import { expect, it } from "vitest";
import { directoryGroup, filterCategories, type DirectoryCatalog } from "../../lib/search/list-services";

const catalog: DirectoryCatalog = {
  categories: [
    { id: "decor", name: "家居布置", order: 2 },
    { id: "clean", name: "家政清洁", description: "清洁", order: 1 },
  ],
  services: [
    {
      id: "draft-one",
      slug: "draft-one",
      name: "草稿服务",
      description: "不应出现在目录",
      categoryId: "decor",
      status: "draft",
      demo: false,
    },
    {
      id: "soon",
      slug: "soon-item",
      name: "即将开放",
      description: "资料还在整理",
      categoryId: "missing",
      status: "coming_soon",
      demo: false,
      keywords: ["预告"],
    },
    {
      id: "floor",
      slug: "floor-care",
      name: "Floor Care",
      description: "Clean the floor",
      categoryId: "clean",
      status: "active",
      demo: false,
      keywords: [],
      tags: ["mop"],
      aliases: ["地面护理"],
    },
  ],
};

it("目录列表跳过草稿，并带上页面地址和分类名", () => {
  expect(directoryGroup(catalog, false).services).toEqual([
    {
      id: "soon",
      name: "即将开放",
      description: "资料还在整理",
      categoryId: "missing",
      keywords: ["预告"],
      href: "/services/soon-item",
      categoryName: "",
      demo: false,
      status: "coming_soon",
    },
    {
      id: "floor",
      name: "Floor Care",
      description: "Clean the floor",
      categoryId: "clean",
      tags: ["mop"],
      aliases: ["地面护理"],
      href: "/services/floor-care",
      categoryName: "家政清洁",
      demo: false,
      status: "active",
    },
  ]);
  const demoCatalog: DirectoryCatalog = {
    ...catalog,
    services: catalog.services.map((service) => ({ ...service, demo: true })),
  };
  expect(directoryGroup(demoCatalog, true).services[1]?.href).toBe("/services/demo/floor-care");
});

it("筛选标签按顺序合并，同 id 保留先出现的名称", () => {
  const other: DirectoryCatalog = {
    categories: [
      { id: "clean", name: "演示清洁", order: 1 },
      { id: "auto", name: "汽车服务", order: 0 },
    ],
    services: [],
  };
  expect(filterCategories([catalog, other]).map((category) => category.name)).toEqual([
    "汽车服务",
    "家政清洁",
    "家居布置",
  ]);
});

it("正式与演示分类同名时，只给演示筛选标签加上区分", () => {
  const formal: DirectoryCatalog = {
    demo: false,
    categories: [{ id: "home-installation", name: "家居安装", order: 1 }],
    services: [],
  };
  const demo: DirectoryCatalog = {
    demo: true,
    categories: [{ id: "home", name: "家居安装", order: 1 }],
    services: [],
  };
  expect(filterCategories([formal, demo]).map((category) => category.name)).toEqual(["家居安装", "家居安装 · 演示"]);
  expect(filterCategories([demo, formal]).map((category) => ({ id: category.id, name: category.name }))).toEqual([
    { id: "home-installation", name: "家居安装" },
    { id: "home", name: "家居安装 · 演示" },
  ]);
  expect(filterCategories([demo]).map((category) => category.name)).toEqual(["家居安装"]);
});
