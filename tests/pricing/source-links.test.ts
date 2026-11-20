import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractSafeSourceLinks, isSafeLinkHref } from "../../lib/source-links";

it("提取合法 https 链接，并把主机名补成规范地址", () => {
  expect(extractSafeSourceLinks("https://example.com")).toEqual([
    { type: "link", text: "https://example.com", href: "https://example.com/" },
  ]);
  expect(extractSafeSourceLinks("HTTPS://Example.com/Path")).toEqual([
    { type: "link", text: "HTTPS://Example.com/Path", href: "https://example.com/Path" },
  ]);
  expect(isSafeLinkHref("https://example.com/")).toBe(true);
  expect(isSafeLinkHref("https://example.com")).toBe(false);
});

it("从夹杂文本里提取多个 http 与 https 链接", () => {
  expect(extractSafeSourceLinks("参见 https://a.example/p 与 http://b.example/q。")).toEqual([
    { type: "text", text: "参见 " },
    { type: "link", text: "https://a.example/p", href: "https://a.example/p" },
    { type: "text", text: " 与 " },
    { type: "link", text: "http://b.example/q", href: "http://b.example/q" },
    { type: "text", text: "。" },
  ]);
  expect(extractSafeSourceLinks("（https://a.example/p）")).toEqual([
    { type: "text", text: "（" },
    { type: "link", text: "https://a.example/p", href: "https://a.example/p" },
    { type: "text", text: "）" },
  ]);
  expect(extractSafeSourceLinks("见 http://archive.example/lamp。拒绝 javascript:alert(1)")).toEqual([
    { type: "text", text: "见 " },
    { type: "link", text: "http://archive.example/lamp", href: "http://archive.example/lamp" },
    { type: "text", text: "。拒绝 javascript:alert(1)" },
  ]);
});

it("拦截 javascript 与 data 协议，只保留其中真正的 http(s) 链接", () => {
  const blocked = "说明 javascript:alert(1) 以及 data:text/html,hi 不能打开";
  expect(extractSafeSourceLinks(blocked)).toEqual([{ type: "text", text: blocked }]);
  expect(extractSafeSourceLinks("JavaScript:alert(1) DATA:text/html,hi")).toEqual([
    { type: "text", text: "JavaScript:alert(1) DATA:text/html,hi" },
  ]);

  const mixed = "公示 https://prices.example/lamp 拒绝 javascript:alert(1) 与 data:text/html,<script>alert(1)</script>";
  const segments = extractSafeSourceLinks(mixed);
  const links = segments.filter((segment) => segment.type === "link");
  expect(links).toEqual([{ type: "link", text: "https://prices.example/lamp", href: "https://prices.example/lamp" }]);
  const text = segments
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.text)
    .join("");
  expect(text).toContain("javascript:alert(1)");
  expect(text).toContain("data:text/html,<script>alert(1)</script>");
  for (const link of links) {
    if (link.type !== "link") continue;
    expect(new URL(link.href).protocol).toMatch(/^https?:$/);
    expect(isSafeLinkHref(link.href)).toBe(true);
  }
  expect(isSafeLinkHref("javascript:alert(1)")).toBe(false);
  expect(isSafeLinkHref("data:text/html,hi")).toBe(false);
});

it("路径里的 javascript 字样仍是 http 链接，反斜杠不会并进地址", () => {
  expect(extractSafeSourceLinks("http://example.com/javascript:alert(1)")).toEqual([
    {
      type: "link",
      text: "http://example.com/javascript:alert(1)",
      href: "http://example.com/javascript:alert(1)",
    },
  ]);
  expect(extractSafeSourceLinks("https://example.com\\@evil.com")).toEqual([
    { type: "link", text: "https://example.com", href: "https://example.com/" },
    { type: "text", text: "\\@evil.com" },
  ]);
});

it("来源渲染不使用 HTML 注入", () => {
  for (const file of ["components/estimate/sample-provenance.tsx", "components/estimate/result.tsx", "lib/source-links.ts"]) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("eval(");
  }
});
