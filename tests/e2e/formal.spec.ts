import { expect, test } from "@playwright/test";

test("正式吸顶灯查询：上海本地价，北京回退全国宜家价，且不标成演示", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: /^家居安装/ }).click();
  await expect(page.getByRole("heading", { name: "家居安装" })).toBeVisible();
  await expect(page.getByText("演示服务使用合成价格数据")).toHaveCount(0);
  await page.getByRole("link", { name: /吸顶灯安装/ }).click();
  await expect(page.getByText("演示金额为合成数据")).toHaveCount(0);
  await page.getByRole("link", { name: "开始查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: "安装或拆除灯具" }).check();
  await next.click();
  await page.getByRole("radio", { name: /普通吸顶灯/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "数量" }).fill("1");
  await next.click();
  await page.getByRole("radio", { name: "是" }).check();
  await next.click();
  await page.getByRole("radio", { name: "否" }).check();
  await next.click();

  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await expect(city.locator("option")).toHaveText([
    "请选择城市",
    "北京",
    "上海",
    "广州",
    "深圳",
    "杭州",
    "我的城市不在列表中（全国参考）",
  ]);
  await city.selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "合理参考价格" })).toBeVisible();
  await expect(page.getByText("演示价格区间")).toHaveCount(0);
  await expect(page.locator(".price")).toHaveText("¥50–60");
  await expect(page.locator(".typical strong")).toHaveText("¥50");
  await expect(page.getByText("使用上海数据")).toBeVisible();
  await expect(page.getByRole("heading", { name: "价格构成" })).toBeVisible();
  await page.getByText("查看数据来源").click();
  await expect(page.getByText(/snzsxh\.com/)).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥79");
  await expect(page.locator(".typical strong")).toHaveText("¥79");
  await expect(page.getByText("本地数据不足，使用全国参考数据")).toBeVisible();
  await expect(page.locator(".breakdown").getByText("基础服务费", { exact: true })).toBeVisible();
  await page.getByText("查看数据来源").click();
  await expect(page.getByText(/ikea\.cn/)).toBeVisible();
});

test("正式窗帘查询：上海杆轨有价，北京没有一口价时数据不足", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/curtain-install");
  await expect(page.getByRole("heading", { name: "服务包含", exact: true })).toBeVisible();
  await expect(page.getByText("100 元起")).toBeVisible();
  await page.getByRole("link", { name: "开始查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: "安装或测量" }).check();
  await next.click();
  await page.getByRole("radio", { name: /窗帘杆或轨道/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "数量" }).fill("1");
  await next.click();
  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await city.selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "合理参考价格" })).toBeVisible();
  await expect(page.locator(".price")).toHaveText("¥100");
  await expect(page.getByText("使用上海数据")).toBeVisible();

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});
