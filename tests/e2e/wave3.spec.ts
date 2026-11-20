import { expect, test } from "@playwright/test";

test("首页能搜到第三批服务，原有灯具和空调词条不被带走", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "搜索服务" });

  await search.fill("小型搬家");
  await expect(page.getByRole("link", { name: /小型搬家与同城货运/ }).filter({ hasText: "正式数据" })).toBeVisible();
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toHaveCount(0);

  await search.fill("家具组装");
  await expect(page.getByRole("link", { name: /家具组装与旧家具拆运/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /窗帘安装/ })).toHaveCount(0);

  await search.fill("日常保洁");
  await expect(page.getByRole("link", { name: /日常保洁与深度保洁/ })).toBeVisible();

  await search.fill("油烟机清洗");
  await expect(page.getByRole("link", { name: /冰箱洗衣机与油烟机清洗/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /空调清洗/ })).toHaveCount(0);

  await search.fill("空调清洗");
  await expect(page.getByRole("link", { name: /空调清洗/ }).filter({ hasText: "正式数据" })).toBeVisible();
  await expect(page.getByRole("link", { name: /冰箱洗衣机与油烟机清洗/ })).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("快狗小面用北京起步价，广州没有这一档", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/small-moving");
  const excluded = page.locator("section").filter({ has: page.getByRole("heading", { name: "服务不包含", exact: true }) });
  await expect(excluded.getByRole("listitem").filter({ hasText: "2.85" })).toHaveCount(1);
  await expect(excluded.getByRole("listitem").filter({ hasText: "4.5 元/公里" })).toHaveCount(2);
  await page.getByRole("link", { name: "开始查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /^快狗起步价/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^小面/ }).check();
  await next.click();
  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "合理参考价格" })).toBeVisible();
  await expect(page.locator(".price")).toHaveText("¥30");
  await expect(page.locator(".typical strong")).toHaveText("¥30");
  await expect(page.getByText("使用北京数据")).toBeVisible();
  await expect(page.locator(".breakdown").getByText("起步价（含 5 公里）", { exact: true })).toBeVisible();
  const samples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(samples.locator("summary")).toHaveCount(0);
  await expect(samples.getByText("北京 · 城市")).toBeVisible();
  await expect(samples.getByText("服务商公示价")).toBeVisible();
  await expect(samples.getByText("非演示样本")).toBeVisible();
  const source = samples.locator('a[href*="suyun.daojia.com"]');
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("href", /cityId=1/);
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("guangzhou");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("暂无可展示的公开样本。")).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("深圳蓝犀牛厢货周末价与日式搬家都使用该城页面", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/small-moving");
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /^蓝犀牛放心搬家起步价/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^厢货/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^周六日/ }).check();
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("shenzhen");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥448");
  await expect(page.locator(".typical strong")).toHaveText("¥448");
  await expect(page.getByText("使用深圳数据")).toBeVisible();
  const samples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(samples.locator("summary")).toHaveCount(0);
  await expect(samples.getByText("深圳 · 城市")).toBeVisible();
  const link = samples.locator('a[href*="lanxiniu.com/price/440300"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("button", { name: "重新查询" }).click();
  await page.getByRole("radio", { name: /^蓝犀牛日式搬家/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^全日式/ }).check();
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("hangzhou");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥1,400");
  await expect(page.getByText("使用杭州数据")).toBeVisible();
  const hangzhou = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(hangzhou.getByText("杭州 · 城市")).toBeVisible();
  await expect(hangzhou.locator('a[href*="lanxiniu.com/price/330100"]')).toBeVisible();
});

test("家具组装用全国参考，北京深度保洁和上海家电清洗不外借", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/estimate/furniture-assembly");
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /^宜家组装公式/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^5 分钟展示价/ }).check();
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥59");
  await expect(page.getByText("本地数据不足，使用全国参考数据")).toBeVisible();
  const furnitureSamples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(furnitureSamples.locator("summary")).toHaveCount(0);
  await expect(furnitureSamples.getByText("全国 · 全国参考")).toBeVisible();
  const ikea = furnitureSamples.locator('a[href*="ikea.cn"][href*="assembly-intro"]');
  await expect(ikea).toBeVisible();
  await expect(ikea).toHaveAttribute("target", "_blank");
  await expect(ikea).toHaveAttribute("rel", "noopener noreferrer");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/home-cleaning");
  await page.getByRole("radio", { name: /^自如深度保洁/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^一居室/ }).check();
  await next.click();
  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥550");
  await expect(page.getByText("使用北京数据")).toBeVisible();
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("北京 · 城市")).toBeVisible();

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("暂无可展示的公开样本。")).toBeVisible();

  await page.goto("/estimate/home-appliance-cleaning");
  await page.getByRole("radio", { name: /^对开门冰箱/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "台数" }).fill("1");
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥158");
  await expect(page.locator(".typical strong")).toHaveText("¥158");
  await expect(page.getByText("使用上海数据")).toBeVisible();
  const hotline = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(hotline.locator("summary")).toHaveCount(0);
  await expect(hotline.getByText("公开参考价")).toBeVisible();
  const link = hotline.locator('a[href*="962121.fgj.sh.gov.cn"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /^https:\/\/962121\.fgj\.sh\.gov\.cn\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("button", { name: "更换地区" }).click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});
