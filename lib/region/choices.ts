import type { Region } from "../../schemas/region.schema";

export type RegionChoice = {
  id: string;
  label: string;
  fallback: boolean;
};

const fallbackLabel = "我的城市不在列表中（全国参考）";

// 选择器只暴露城市。全国记录若存在，收成唯一的“城市未列出”回退，不把省、城市等级或“全国”当成普通选项。
export function regionChoices(regions: readonly Region[]): RegionChoice[] {
  const choices: RegionChoice[] = regions
    .filter((region) => region.level === "city")
    .map((region) => ({ id: region.id, label: region.name, fallback: false }));
  const national = regions.find((region) => region.level === "national");
  if (national) choices.push({ id: national.id, label: fallbackLabel, fallback: true });
  return choices;
}
