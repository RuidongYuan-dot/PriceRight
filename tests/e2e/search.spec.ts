import { expect, test } from "@playwright/test";

test("首页可搜索并筛选服务，空状态能清空，正式结果进入服务页", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/正式价格数据建设中/)).toHaveCount(0);

  const search = page.getByRole("searchbox", { name: "搜索服务" });
  const formalCategory = page.getByRole("button", { name: "家居安装", exact: true });
  const demoCategory = page.getByRole("button", { name: "家居安装 · 演示", exact: true });
  await expect(formalCategory).toBeVisible();
  await expect(demoCategory).toBeVisible();

  await formalCategory.click();
  await expect(page.getByRole("link", { name: /体验查询/ })).toHaveCount(0);
  const formalLamp = page.getByRole("link", { name: /吸顶灯安装/ }).filter({ hasText: "正式数据" });
  const demoLamp = page.getByRole("link", { name: /吸顶灯安装/ }).filter({ hasText: "演示数据" });
  await expect(formalLamp).toBeVisible();
  await expect(page.getByRole("link", { name: /窗帘安装/ }).filter({ hasText: "正式数据" })).toBeVisible();
  await expect(demoLamp).toHaveCount(0);

  await search.fill("窗帘");
  await expect(page.getByRole("link", { name: /窗帘安装/ }).filter({ hasText: "正式数据" })).toBeVisible();
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toHaveCount(0);

  await search.fill("zzzz-no-such-service");
  await expect(page.getByRole("status")).toContainText("没有找到匹配的服务");
  await page.getByRole("button", { name: "清空搜索与筛选" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /体验查询/ })).toBeVisible();

  await search.fill("装灯");
  await expect(formalLamp).toBeVisible();
  await expect(demoLamp).toHaveCount(0);

  await search.fill("  吸顶灯  ");
  await expect(formalLamp).toBeVisible();
  await expect(demoLamp).toBeVisible();
  await expect(demoLamp).toContainText("演示数据");
  await expect(page.getByRole("link", { name: /窗帘安装/ })).toHaveCount(0);
  await formalLamp.click();
  await expect(page.getByRole("heading", { level: 1, name: "吸顶灯安装" })).toBeVisible();
  await expect(page.getByText("演示金额为合成数据")).toHaveCount(0);
  await expect(page).toHaveURL(/\/services\/ceiling-light-install\/?$/);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("分类页可按关键词筛选服务并清空", async ({ page }) => {
  await page.goto("/categories/demo/home");
  const search = page.getByRole("searchbox", { name: "搜索服务" });
  await expect(page.getByRole("button", { name: "家居安装", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "家居安装 · 演示" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /窗帘安装/ })).toBeVisible();

  await search.fill("  窗帘  ");
  await expect(page.getByRole("link", { name: /窗帘安装/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toHaveCount(0);

  await search.fill("zzzz-no-such-service");
  await page.getByRole("button", { name: "清空搜索与筛选" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /窗帘安装/ })).toBeVisible();
});
