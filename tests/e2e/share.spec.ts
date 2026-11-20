import { expect, test, type Page } from "@playwright/test";
import { SHARE_FEEDBACK } from "../../lib/share/query";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

function failOnCrash(page: Page) {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("dialog", (dialog) => {
    throw new Error(`意外弹窗：${dialog.message()}`);
  });
}

async function quoteSnapshot(page: Page) {
  const section = (name: string) =>
    page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
  return {
    price: (await page.locator(".price").innerText()).trim(),
    region: (await page.locator(".result-summary > p").first().innerText()).trim(),
    conditions: (await section("查询条件").innerText()).trim(),
    breakdown: (await section("价格构成").innerText()).trim(),
    evidence: (await section("数据依据").innerText()).trim(),
  };
}

test("完成演示查询后，分享链接在新页面重算相同结果", async ({ page }) => {
  failOnCrash(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/estimate/demo/demo-lamp-install/");
  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: "普通吸顶灯" }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "安装数量" }).fill("2");
  await next.click();
  await page.getByRole("radio", { name: "否" }).check();
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();

  const original = await quoteSnapshot(page);
  expect(original.region).toBe("北京");
  expect(original.price).toBe("¥80–120");
  expect(original.conditions).toContain("普通吸顶灯");
  expect(original.conditions).toContain("安装数量");
  expect(original.conditions).toContain("否");
  expect(original.conditions).not.toContain("加固");
  expect(original.breakdown).toContain("基础价格");
  expect(original.breakdown).toContain("¥40–60");
  expect(original.breakdown).toContain("安装数量 × 2");
  expect(original.breakdown).toContain("¥80–120");
  expect(original.evidence).toContain("可信度");
  expect(original.evidence).toContain("低");
  expect(original.evidence).toContain("数据样本有限，结果仅供粗略参考");
  expect(original.evidence).toContain("demo 测试数据，仅用于验证计算");
  expect(original.evidence).toContain("2026-11-01");
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByRole("button", { name: "复制分享链接" }).click();
  await expect(page.getByRole("status").filter({ hasText: "链接已复制。" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const canonical = "/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false";
  expect(copied).toBe(`${new URL(page.url()).origin}${canonical}`);
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(canonical);

  const fresh = await page.context().newPage();
  failOnCrash(fresh);
  await fresh.setViewportSize({ width: 390, height: 844 });
  await fresh.goto(copied);
  await expect(fresh.getByRole("status").filter({ hasText: SHARE_FEEDBACK.restored })).toBeVisible();
  expect(await quoteSnapshot(fresh)).toEqual(original);

  await fresh.getByRole("button", { name: "更换地区" }).click();
  await expect(fresh.getByRole("combobox", { name: "选择服务地区" })).toHaveValue("beijing");
  await fresh.getByRole("button", { name: "上一步" }).click();
  await expect(fresh.getByRole("radio", { name: "否" })).toBeChecked();
  await fresh.getByRole("button", { name: "上一步" }).click();
  await expect(fresh.getByRole("spinbutton", { name: "安装数量" })).toHaveValue("2");
  await fresh.getByRole("button", { name: "上一步" }).click();
  await expect(fresh.getByRole("radio", { name: "普通吸顶灯" })).toBeChecked();
  await fresh.getByRole("button", { name: "下一步" }).click();
  await fresh.getByRole("button", { name: "下一步" }).click();
  await fresh.getByRole("button", { name: "下一步" }).click();
  await fresh.getByRole("combobox", { name: "选择服务地区" }).selectOption("shanghai");
  await fresh.getByRole("button", { name: "查看结果" }).click();
  await expect(fresh.locator(".price")).toHaveText("¥100–150");
  await expect(fresh.getByRole("heading", { name: "查询条件" })).toBeVisible();
  expect(await fresh.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
});

test("剪贴板不可用时可以手动复制当前分享地址", async ({ page }) => {
  failOnCrash(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("denied")),
        readText: () => Promise.reject(new Error("denied")),
      },
    });
  });
  await page.goto(
    "/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false",
  );
  await expect(page.getByRole("heading", { name: "演示价格区间" })).toBeVisible();
  await page.getByRole("button", { name: "复制分享链接" }).click();
  await expect(page.getByRole("status").filter({ hasText: "无法写入剪贴板，请手动复制下面的链接。" })).toBeVisible();
  const input = page.getByRole("textbox", { name: "分享链接" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(
    /\/estimate\/demo\/demo-lamp-install\/\?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false$/,
  );
});

test("部分分享链接恢复有效答案，并允许继续填写", async ({ page }) => {
  failOnCrash(page);
  await page.goto("/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&remove-old=false");
  await expect(page.getByRole("status").filter({ hasText: SHARE_FEEDBACK.partial })).toBeVisible();
  await expect(page.getByRole("heading", { name: "安装数量" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);
  await page.getByRole("spinbutton", { name: "安装数量" }).fill("2");
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("radio", { name: "否" })).toBeChecked();
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("combobox", { name: "选择服务地区" })).toHaveValue("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥80–120");
  await expect(page.getByText("普通吸顶灯")).toBeVisible();
});

test("畸形分享链接不会崩溃，问卷仍可使用", async ({ page }) => {
  failOnCrash(page);
  const hostile = [
    "region=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "lamp-type=%3Cimg+src%3Dx+onerror%3Dalert(1)%3E",
    "quantity=-999",
    "remove-old=no",
    "__proto__=1",
    "unknown=%3C%2Ftitle%3E",
  ].join("&");
  await page.goto(`/estimate/demo/demo-lamp-install/?${hostile}`);
  await expect(page.locator(".notice.warning")).toHaveText(SHARE_FEEDBACK.invalid);
  await expect(page.getByText(/alert\(1\)|onerror/)).toHaveCount(0);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "安装哪种灯？" })).toBeVisible();
  await expect(page.locator(".price")).toHaveCount(0);

  const next = page.getByRole("button", { name: "下一步" });
  await page.getByRole("radio", { name: "普通吸顶灯" }).check();
  await next.click();
  await page.getByRole("spinbutton", { name: "安装数量" }).fill("1");
  await next.click();
  await page.getByRole("radio", { name: "否" }).check();
  await next.click();
  await page.getByRole("combobox", { name: "选择服务地区" }).selectOption("beijing");
  await page.getByRole("button", { name: "查看结果" }).click();
  await expect(page.locator(".price")).toHaveText("¥50–60");
});
