import type { Region } from "../../schemas/region.schema";

export function regionCandidates(regionId: string, regions: Region[]): Region[] {
  const requested = regions.find((r) => r.id === regionId);
  if (!requested) return [];
  const candidates = [requested];
  if (requested.level === "city") {
    const province = regions.find((r) => r.level === "province" && r.id === requested.parentId);
    const tier = regions.find((r) => r.level === "city_tier" && r.tier === requested.tier);
    if (province) candidates.push(province);
    if (tier) candidates.push(tier);
  }
  const national = regions.find((r) => r.level === "national");
  if (national && requested.level !== "national") candidates.push(national);
  return candidates;
}
