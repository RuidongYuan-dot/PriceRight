import { expect, test } from "@playwright/test";

test("首页能搜到第二批服务，开锁词条进入的是智能门锁说明", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "搜索服务" });

  await search.fill("空调清洗");
  await expect(page.getByRole("link", { name: /空调清洗/ }).filter({ hasText: "正式数据" })).toBeVisible();
  await expect(page.getByRole("link", { name: /吸顶灯安装/ })).toHaveCount(0);

  await search.fill("指纹锁");
  await expect(page.getByRole("link", { name: /智能门锁安装/ }).filter({ hasText: "正式数据" })).toBeVisible();

  await search.fill("换水龙头");
  await expect(page.getByRole("link", { name: /水龙头与角阀/ })).toBeVisible();

  await search.fill("换插座");
  const outlet = page.getByRole("link", { name: /开关插座安装更换/ });
  await expect(outlet).toBeVisible();

  await search.fill("开锁");
  await page.getByRole("link", { name: /智能门锁安装/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "智能门锁安装" })).toBeVisible();
  const excluded = page.locator("section").filter({ has: page.getByRole("heading", { name: "服务不包含", exact: true }) });
  await expect(excluded.getByRole("listitem").filter({ hasText: "传统机械锁应急开锁" })).toBeVisible();
  await expect(excluded.getByRole("listitem").filter({ hasText: "更换普通机械锁芯" })).toBeVisible();
  await expect(page.getByText("演示金额为合成数据")).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("空调清洗：上海挂机用热线价，北京没有这条本地公示", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/ac-cleaning");
  const included = page.locator("section").filter({ has: page.getByRole("heading", { name: "服务包含", exact: true }) });
  await expect(included.getByRole("listitem").filter({ hasText: "海尔柜挂 2025–2026" })).toHaveCount(2);
  await expect(included.getByRole("listitem").filter({ hasText: "海尔家中机 2024–2025" })).toBeVisible();
  await page.getByRole("link", { name: "开始查询" }).click();

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /上海住宅热线的标准清洗/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /挂机空调/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "数量" }).fill("1");
  await next.click();

  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await city.selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "合理参考价格" })).toBeVisible();
  await expect(page.locator(".price")).toHaveText("¥99");
  await expect(page.locator(".typical strong")).toHaveText("¥99");
  await expect(page.getByText("使用上海数据")).toBeVisible();
  await expect(page.locator(".breakdown").getByText("挂机空调清洗", { exact: true })).toBeVisible();
  await expect(page.locator(".breakdown").getByText("高空作业费", { exact: true })).toHaveCount(0);
  const shanghaiSamples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(shanghaiSamples.locator("summary")).toHaveCount(0);
  await expect(shanghaiSamples.getByText("上海 · 城市")).toBeVisible();
  await expect(shanghaiSamples.getByText("公开参考价")).toBeVisible();
  await expect(shanghaiSamples.getByText("非演示样本")).toBeVisible();
  const hotline = shanghaiSamples.locator('a[href*="962121.fgj.sh.gov.cn"]');
  await expect(hotline).toBeVisible();
  await expect(hotline).toHaveAttribute("href", /^https:\/\/962121\.fgj\.sh\.gov\.cn\//);
  await expect(hotline).toHaveAttribute("target", "_blank");
  await expect(hotline).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("暂无可展示的公开样本。")).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("智能门锁后续安装用全国官方价，首次安装保持免费", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/smart-lock-install");
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /小米智能门锁/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /后续安装（普通系列）/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "数量" }).fill("1");
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥170");
  await expect(page.locator(".typical strong")).toHaveText("¥170");
  await expect(page.getByText("本地数据不足，使用全国参考数据")).toBeVisible();
  const lockSamples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(lockSamples.locator("summary")).toHaveCount(0);
  await expect(lockSamples.getByText("全国 · 全国参考").first()).toBeVisible();
  await expect(lockSamples.getByText("服务商公示价").first()).toBeVisible();
  await expect(lockSamples.getByText("非演示样本").first()).toBeVisible();
  const notes = lockSamples.locator('a[href*="www.mi.com/mj-smartlock/notes"]');
  await expect(notes).toBeVisible();
  await expect(notes).toHaveAttribute("target", "_blank");
  await expect(notes).toHaveAttribute("rel", "noopener noreferrer");

  await page.getByRole("button", { name: "重新查询" }).click();
  await page.getByRole("radio", { name: /小米智能门锁/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /^首次安装/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "数量" }).fill("1");
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥0");
  await expect(page.locator(".typical strong")).toHaveText("¥0");
});

test("换水龙头和换插座使用上海 2026 版一口价，其他城市不借用", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/faucet-valve-install");
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /上海住宅热线/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /单冷水龙头/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "个数" }).fill("1");
  await next.click();
  const city = page.getByRole("combobox", { name: "选择服务地区" });
  await city.selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥80");
  await expect(page.getByText("使用上海数据")).toBeVisible();

  await page.getByRole("button", { name: "更换地区" }).click();
  await city.selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await expect(page.getByRole("region", { name: "公开样本来源明细" }).getByText("暂无可展示的公开样本。")).toBeVisible();

  await page.goto("/estimate/switch-outlet-install");
  await page.getByRole("radio", { name: /安装开关或插座/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "个数" }).fill("4");
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("shanghai");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥200");
  await expect(page.locator(".typical strong")).toHaveText("¥50");
  await expect(page.locator(".price")).not.toHaveText("¥190");
});

test("箭牌龙头保持基础价，不把系数乘成新的一口价", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/services/faucet-valve-install");
  await expect(page.getByText("不乘 1.2")).toBeVisible();
  await page.getByRole("link", { name: "开始查询" }).click();
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: /箭牌基础价/ }).check();
  await next.click();
  await page.getByRole("radio", { name: /龙头或延时水嘴安装/ }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "件数" }).fill("1");
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥35");
  await expect(page.locator(".typical strong")).toHaveText("¥35");
  await expect(page.getByText("本地数据不足，使用全国参考数据")).toBeVisible();
  await expect(page.locator(".price")).not.toHaveText("¥42");
  const arrowSamples = page.getByRole("region", { name: "公开样本来源明细" });
  await expect(arrowSamples.locator("summary")).toHaveCount(0);
  await expect(arrowSamples.getByText("全国 · 全国参考")).toBeVisible();
  await expect(arrowSamples.getByText("服务商公示价")).toBeVisible();
  const arrow = arrowSamples.locator('a[href*="arrow-home.cn"]');
  await expect(arrow).toBeVisible();
  await expect(arrow).toHaveAttribute("href", /^https:\/\/www\.arrow-home\.cn\//);
  await expect(arrow).toHaveAttribute("target", "_blank");
  await expect(arrow).toHaveAttribute("rel", "noopener noreferrer");
});
