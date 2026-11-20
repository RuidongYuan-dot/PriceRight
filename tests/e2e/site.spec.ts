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

  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await expect(city.locator("option")).toHaveText([
    "请选择城市",
    "北京",
    "上海",
    "广州",
    "我的城市不在列表中（全国参考）",
  ]);
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await expect(page.getByText("¥80–120", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".typical strong")).toHaveText("¥55");
  await expect(page.getByRole("heading", { name: "价格构成" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "哪些因素会影响价格" })).toBeVisible();
  await expect(page.locator(".factors strong").filter({ hasText: /^拆除旧灯$/ })).toBeVisible();
  await expect(page.locator(".factors strong").filter({ hasText: /^导轨安装人工$/ })).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
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
  await expect(page.locator(".breakdown").getByText("加固", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "更换地区" }).click();
  await page.getByRole("combobox").selectOption("guangzhou");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  for (const path of ["/categories/home", "/services/demo-lamp-install", "/estimate/demo-lamp-install"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test("从目录查询窗帘安装，显示导轨费用及当地样本状态", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: /体验查询/ }).click();
  await page.getByRole("link", { name: /窗帘安装/ }).click();
  await page.getByRole("link", { name: "开始演示查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: "安装新导轨" }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "需要安装几扇窗的窗帘？" }).fill("2");
  await next.click();
  await page.getByRole("spinbutton", { name: "新导轨总长（米）" }).fill("3.5");
  await next.click();

  const city = page.getByRole("combobox", { name: "选择服务地区" });
  const showResult = page.getByRole("button", { name: "查看结果" });
  await city.selectOption("beijing");
  await showResult.click();
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await expect(page.locator(".price")).toHaveText("¥75–113");
  await expect(page.locator(".typical strong")).toHaveText("¥90");
  await expect(page.locator(".breakdown").getByText("导轨安装人工", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "哪些因素会影响价格" })).toBeVisible();
  await expect(page.locator(".factors strong").filter({ hasText: /^导轨安装人工$/ })).toBeVisible();
  await expect(page.locator(".factors").getByText("拆除旧灯")).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("shanghai");
  await showResult.click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.locator(".typical")).toHaveCount(0);
});

test("分享链接恢复报价，非法地区和过时评估日都有确定表现", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 800 });
  const answers = "lamp-type=ceiling&quantity=2&remove-old=false";
  await page.goto(`/estimate/demo/demo-lamp-install/?region=beijing&asOf=2026-11-20&${answers}`);
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await expect(page.locator(".price")).toHaveText("¥80–120");
  await expect(page.locator(".typical strong")).toHaveText("¥55");
  await expect(page.getByText("价格数据可能已经过时")).toHaveCount(0);
  await page.getByRole("button", { name: "复制分享链接" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("region=beijing");
  expect(copied).toContain("asOf=2026-11-20");
  expect(copied).toContain("quantity=2");
  expect(copied).toContain("remove-old=false");
  expect(copied).not.toContain("a.quantity");
  await page.goto(copied);
  await expect(page.locator(".price")).toHaveText("¥80–120");
  await expect(page.locator(".typical strong")).toHaveText("¥55");

  await page.goto(`/estimate/demo/demo-lamp-install/?region=beijing&asOf=2028-01-01&${answers}`);
  await expect(page.locator(".price")).toHaveText("¥80–120");
  await expect(page.getByText("价格数据可能已经过时")).toBeVisible();
  await expect(page.locator(".evidence").getByText("低", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/estimate/demo/demo-lamp-install/?region=guangdong&asOf=not-a-date&${answers}`);
  await expect(page.getByRole("heading", { name: "选择服务地区" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.getByRole("combobox").locator("option")).toHaveText([
    "请选择城市",
    "北京",
    "上海",
    "广州",
    "我的城市不在列表中（全国参考）",
  ]);

  await page.goto("/estimate/demo/demo-lamp-install/?region=%3Cscript%3Ealert(1)%3C/script%3E&quantity=-999");
  await expect(page.getByRole("heading", { name: "安装哪种灯？" })).toBeVisible();

  await page.goto(`/estimate/demo/demo-lamp-install/?region=cn&asOf=2026-11-20&${answers}`);
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.locator(".typical")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "哪些因素会影响价格" })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});
