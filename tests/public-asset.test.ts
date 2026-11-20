import { afterEach, expect, it } from "vitest";
import { publicAssetPath } from "../lib/public-asset";

const original = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = original;
});

it("空 basePath 时 public 资源保持根路径", () => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  expect(publicAssetPath("/images/ceiling-light.jpg")).toBe("/images/ceiling-light.jpg");
  process.env.NEXT_PUBLIC_BASE_PATH = "";
  expect(publicAssetPath("/images/ceiling-light.jpg")).toBe("/images/ceiling-light.jpg");
  expect(publicAssetPath("images/ceiling-light.jpg")).toBe("/images/ceiling-light.jpg");
});

it("GitHub Pages basePath 加在 public 资源路径前面", () => {
  process.env.NEXT_PUBLIC_BASE_PATH = "/PriceRight";
  expect(publicAssetPath("/images/ceiling-light.jpg")).toBe("/PriceRight/images/ceiling-light.jpg");
});
