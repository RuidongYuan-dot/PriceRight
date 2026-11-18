import { expect, test } from "@playwright/test";

test("手机端从首页到报价，验证必填、地区切换和来源披露", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/正式价格数据建设中/)).toBeVisible();
  await page.getByRole("link", { name: /体验查询/ }).click();
  await expect(page.getByRole("heading", { name: "家居安装" })).toBeVisible();
  await page.getByRole("link", { name: /吸顶灯安装/ }).click();
  await expect(page.getByRole("heading", { name: "服务包含", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "开始演示查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await next.click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("请回答此问题");
  await page.getByRole("radio", { name: "普通吸顶灯" }).check();
  await next.click();
  await expect(page.getByRole("heading", { name: "安装数量" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "安装数量" }).fill("2");
  await next.click();
  await page.getByRole("radio", { name: "否" }).check();
  await next.click();

  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await expect(page.getByText("¥80–120", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "价格构成" })).toBeVisible();
  await page.getByText("查看数据来源").click();
  await expect(page.getByText(/合成测试样本/)).toBeVisible();

  await page.getByRole("button", { name: "更换地区" }).click();
  await page.getByRole("combobox").selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByText("¥100–150", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "重新查询" }).click();
  await expect(page.getByRole("heading", { name: "安装哪种灯？" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "普通吸顶灯" })).not.toBeChecked();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("切换条件隐藏旧答案，样本不足时展示明确状态", async ({ page, request }) => {
  await page.goto("/estimate/demo/demo-lamp-install");
  const next = page.getByRole("button", { name: "下一步" });
  const back = page.getByRole("button", { name: "上一步" });
  await page.getByRole("radio", { name: "吊灯", exact: true }).check();
  await next.click();
  await expect(page.getByRole("heading", { name: /额外加固/ })).toBeVisible();
  await page.getByRole("radio", { name: "是" }).check();
  await next.click();
  await back.click();
  await back.click();
  await page.getByRole("radio", { name: "普通吸顶灯" }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "安装数量" }).fill("1");
  await next.click();
  await page.getByRole("radio", { name: "否" }).check();
  await next.click();
  await page.getByRole("combobox").selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByText("¥50–60", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("加固", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "更换地区" }).click();
  await page.getByRole("combobox").selectOption("guangzhou");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  for (const path of ["/categories/home", "/services/demo-lamp-install", "/estimate/demo-lamp-install"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
