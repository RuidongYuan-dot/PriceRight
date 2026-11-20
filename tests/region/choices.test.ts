import { expect, it } from "vitest";
import { regionChoices } from "../../lib/region/choices";
import { loadDemo } from "../demo";

it("选择器只保留城市，并把全国记录收成一个回退项", async () => {
  const { data } = await loadDemo();
  expect(regionChoices(data.regions)).toEqual([
    { id: "beijing", label: "北京", fallback: false },
    { id: "shanghai", label: "上海", fallback: false },
    { id: "guangzhou", label: "广州", fallback: false },
    { id: "cn", label: "我的城市不在列表中（全国参考）", fallback: true },
  ]);
  const withoutNational = regionChoices(data.regions.filter((region) => region.level !== "national"));
  expect(withoutNational.some((choice) => choice.fallback)).toBe(false);
  expect(withoutNational.map((choice) => choice.id)).toEqual(["beijing", "shanghai", "guangzhou"]);
});
