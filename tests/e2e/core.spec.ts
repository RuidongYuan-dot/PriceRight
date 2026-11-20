import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDemo } from "../demo";
import { evaluateQuestions } from "../../lib/question-engine/evaluate";

test("通过公开引擎入口走完服务选择、答题、选城和报价", async () => {
  const { catalog, service, answers, quote } = await loadDemo();
  expect(catalog.categories[0].id).toBe(service.categoryId);
  expect(evaluateQuestions(service.questions, {}).complete).toBe(false);
  expect(evaluateQuestions(service.questions, answers).complete).toBe(true);
  const result = quote({}, "beijing");
  expect(result).toMatchObject({
    status: "estimated",
    demo: true,
    range: { min: 80, max: 120 },
    typical: 55,
    sampleCount: 1,
  });
});

test("数据校验命令通过有效目录，并以退出码 1 阻止错误数据", async () => {
  const args = ["--import", "tsx", "scripts/validate-data.ts"];
  expect(execFileSync(process.execPath, args, { encoding: "utf8" })).toContain("demo 校验通过");
  const root = await mkdtemp(join(tmpdir(), "priceright-cli-"));
  try {
    await mkdir(join(root, "services"));
    await writeFile(join(root, "services", "broken.json"), "{}");
    const failed = spawnSync(process.execPath, [...args, root], { encoding: "utf8" });
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("broken.json");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
