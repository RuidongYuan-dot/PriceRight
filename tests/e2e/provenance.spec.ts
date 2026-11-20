import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
import { EstimateResult } from "../../components/estimate/result";
import { calculatePrice, type PriceResult } from "../../lib/pricing/calculate";
import type { Service } from "../../schemas/service.schema";
import { loadDemo } from "../demo";

function renderResult(
  service: Service,
  result: Exclude<PriceResult, { status: "invalid_input" }>,
  regionName: string,
  answers: Readonly<Record<string, unknown>>,
) {
  return renderToStaticMarkup(
    createElement(EstimateResult, {
      service,
      result,
      regionName,
      answers,
      summaries: [],
      factors: { up: [], down: [] },
      onBack: () => undefined,
      onRestart: () => undefined,
      onCopyLink: () => "",
    }),
  );
}

test("结果页展示样本来源、日期和地区，数据不足时不编造样本", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const answers = "lamp-type=ceiling&quantity=2&remove-old=false";
  await page.goto(`/estimate/demo/demo-lamp-install/?region=beijing&asOf=2026-11-20&${answers}`);
  const samples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(samples.getByText("55 元")).toBeVisible();
  await expect(samples.getByText("合成测试样本（demo）")).toBeVisible();
  await expect(samples.getByText("2026-11-01")).toBeVisible();
  await expect(samples.getByText("人工录入参考")).toBeVisible();
  await expect(samples.getByText("北京 · 城市")).toBeVisible();
  await expect(samples.getByText("已核验")).toBeVisible();
  await expect(samples.getByText("演示样本")).toBeVisible();
  await expect(samples.locator("a")).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto(`/estimate/demo/demo-lamp-install/?region=guangzhou&asOf=2026-11-20&${answers}`);
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("暂无可展示的公开样本。")).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.locator(".sample-price")).toHaveCount(0);
});

test("全国回退样本展示地区标签，并且只把安全网址做成外链", async ({ page }) => {
  const { service, data, answers } = await loadDemo();
  const base = data.samples[0]!;
  const result = calculatePrice(service, answers, "beijing", {
    ...data,
    samples: [
      {
        ...base,
        id: "national-public",
        regionId: "cn",
        price: 70,
        sampleType: "public_price",
        source:
          "全国公示 https://prices.example/lamp 与 http://archive.example/lamp。拒绝 javascript:alert(1) 和 data:text/html,hi",
        collectedAt: "2026-10-01",
      },
    ],
  });
  expect(result.status).toBe("estimated");
  if (result.status !== "estimated") return;
  expect(result.region).toMatchObject({ id: "cn", name: "全国" });
  expect(result.range).toEqual({ min: 80, max: 120 });

  await page.setContent(renderResult(service, result, "北京", answers));
  const samples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(samples.getByText("70 元")).toBeVisible();
  await expect(samples.getByText("全国 · 全国参考")).toBeVisible();
  await expect(samples.getByText("公开参考价")).toBeVisible();
  await expect(samples.getByText("2026-10-01")).toBeVisible();
  await expect(samples.getByText("已核验")).toBeVisible();
  await expect(samples.getByText("演示样本")).toBeVisible();
  await expect(samples.getByText("javascript:alert(1)")).toBeVisible();
  await expect(samples.getByText("data:text/html,hi")).toBeVisible();

  const https = samples.getByRole("link", { name: "https://prices.example/lamp" });
  await expect(https).toHaveAttribute("href", "https://prices.example/lamp");
  await expect(https).toHaveAttribute("target", "_blank");
  await expect(https).toHaveAttribute("rel", "noopener noreferrer");
  const http = samples.getByRole("link", { name: "http://archive.example/lamp" });
  await expect(http).toHaveAttribute("href", "http://archive.example/lamp");
  await expect(http).toHaveAttribute("target", "_blank");
  await expect(http).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator('a[href^="javascript:"], a[href^="data:"]')).toHaveCount(0);
  await expect(page.locator("script, img")).toHaveCount(0);
});

test("样本较多时默认折叠，展开后按采集日期阅读", async ({ page }) => {
  const { service, data, answers } = await loadDemo();
  const base = data.samples[0]!;
  const result = calculatePrice(service, answers, "beijing", {
    ...data,
    samples: [
      { ...base, id: "b", collectedAt: "2026-11-02", price: 20 },
      { ...base, id: "a", collectedAt: "2026-11-02", price: 10 },
      { ...base, id: "d", collectedAt: "2026-11-04", price: 40 },
      { ...base, id: "c", collectedAt: "2026-11-03", price: 30 },
    ],
  });
  expect(result.status).toBe("estimated");
  if (result.status !== "estimated") return;
  await page.setContent(renderResult(service, result, "北京", answers));
  const summary = page.getByText("查看全部 4 条公开样本来源");
  await expect(summary).toBeVisible();
  await expect(page.getByText("10 元")).toBeHidden();
  await summary.click();
  const items = page.locator(".sample-list > li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("10 元");
  await expect(items.nth(1)).toContainText("20 元");
  await expect(items.nth(2)).toContainText("30 元");
  await expect(items.nth(3)).toContainText("40 元");
  await expect(items.nth(0).getByText("北京 · 城市")).toBeVisible();
});
