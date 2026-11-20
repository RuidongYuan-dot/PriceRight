import { expect, test, type Page } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

function failOnCrash(page: Page) {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("dialog", (dialog) => {
    throw new Error(`意外弹窗：${dialog.message()}`);
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
}

test("服务详情按各自配置展示常见加价项，手机宽度不横向溢出", async ({ page }) => {
  failOnCrash(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/demo/demo-lamp-install/");
  await expect(page.getByRole("heading", { name: "服务包含", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "服务不包含", exact: true })).toBeVisible();
  const lamp = page.getByRole("region", { name: "预约前建议确认的常见加价项" });
  await expect(lamp).toContainText("拆除旧灯");
  await expect(lamp).toContainText("加固");
  await expect(lamp).not.toContainText("导轨安装人工");
  await expect(page.getByRole("region", { name: "服务包含" })).toContainText("已有安装点的常规灯具安装");
  await expect(page.getByRole("region", { name: "服务不包含" })).toContainText("灯具、安装材料及线路改造");
  await expectNoHorizontalOverflow(page);

  await page.goto("/services/demo/demo-curtain-install/");
  const curtain = page.getByRole("region", { name: "预约前建议确认的常见加价项" });
  await expect(curtain).toContainText("导轨安装人工");
  await expect(curtain).not.toContainText("拆除旧灯");
  await expect(page.getByRole("region", { name: "服务不包含" })).toContainText("电动窗帘布线及高空作业");
  await expectNoHorizontalOverflow(page);
});

test("结果页复制询价清单，剪贴板成功与数据不足都不编造价格", async ({ page }) => {
  failOnCrash(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false");
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await expect(page.getByRole("region", { name: "服务包含" })).toContainText("已有安装点的常规灯具安装");
  await expect(page.getByRole("region", { name: "预约前建议确认的常见加价项" })).toContainText("拆除旧灯");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "复制询价清单" }).click();
  await expect(page.getByRole("status").filter({ hasText: "询价清单已复制。" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "询价清单" })).toHaveCount(0);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("给师傅的询价确认清单");
  expect(copied).toContain("服务：吸顶灯安装");
  expect(copied).toContain("地区：北京");
  expect(copied).toContain("普通吸顶灯");
  expect(copied).toContain("演示价格区间 ¥80–120");
  expect(copied).toContain("合成演示数据，请勿作为实际询价依据");
  expect(copied).toContain("灯具、安装材料及线路改造");
  const applied = copied.split("请确认这些附加项是否已包含在对方总价中：")[1]?.split("以下情况当前选择未计入")[0] ?? "";
  const rest = copied.split("以下情况当前选择未计入，请先问清是否另收费：")[1] ?? "";
  expect(applied).not.toContain("拆除旧灯");
  expect(rest).toContain("拆除旧灯");
  expect(rest).toContain("加固");
  await expectNoHorizontalOverflow(page);

  await page.goto("/estimate/demo/demo-lamp-install/?region=guangzhou&lamp-type=ceiling&quantity=2&remove-old=false");
  await expect(page.getByRole("heading", { name: "数据不足" })).toBeVisible();
  await page.getByRole("button", { name: "复制询价清单" }).click();
  await expect(page.getByRole("status").filter({ hasText: "询价清单已复制。" })).toBeVisible();
  const missing = await page.evaluate(() => navigator.clipboard.readText());
  expect(missing).toContain("暂无公开参考区间，请要求对方先报总价明细");
  expect(missing).toContain("合成演示数据，请勿作为实际询价依据");
  expect(missing).not.toContain("¥");
  expect(missing).not.toContain("合理参考价格");
  await expectNoHorizontalOverflow(page);
});

test("剪贴板不可用时可以手动复制询价清单，且手机宽度不横向溢出", async ({ page }) => {
  failOnCrash(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("denied")),
        readText: () => Promise.reject(new Error("denied")),
      },
    });
  });
  await page.goto("/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false");
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await page.getByRole("button", { name: "复制询价清单" }).click();
  await expect(page.getByRole("status").filter({ hasText: "无法写入剪贴板，请手动复制下面的询价清单。" })).toBeVisible();
  const box = page.getByRole("textbox", { name: "询价清单" });
  await expect(box).toBeFocused();
  await expect(box).toHaveValue(/给师傅的询价确认清单/);
  await expect(box).toHaveValue(/演示价格区间 ¥80–120/);
  await expect(box).toHaveValue(/灯具、安装材料及线路改造/);
  await expect(page.getByRole("textbox", { name: "分享链接" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "复制分享链接" }).click();
  await expect(page.getByRole("status").filter({ hasText: "无法写入剪贴板，请手动复制下面的链接。" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "分享链接" })).toBeFocused();
  await expectNoHorizontalOverflow(page);
});
