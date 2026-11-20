# 贡献指南

PriceRight 欢迎两类贡献：改进问答、计价和页面的代码，以及带来源的线下服务价格数据。项目服务的是购买前要判断价格是否合理的普通消费者。MVP 只做参考价查询，不加入登录、支付、商家入驻或广告。

开始前请阅读：

- `AGENTS.md`
- `PRD.md`
- 仓库根目录的 `PriceRight 技术设计文档 TECHNICAL_DESIGN.md`（早期文稿中的 `TECHNICAL_DESIGN.md` 即指该文件）
- [PRICING_METHODOLOGY.md](PRICING_METHODOLOGY.md)
- [DATA_SOURCES.md](DATA_SOURCES.md)

需要 Node.js 22.18 或更高版本，以及 `package.json` 里 `packageManager` 指定的 pnpm。

```sh
pnpm install --frozen-lockfile
```

## 分支与提交

从最新的 `main` 拉出分支。提交信息使用下面的前缀：

```text
feat:
fix:
data:
refactor:
test:
docs:
chore:
```

一次提交只做一件事。价格规则、样本和与之配套的测试可以放在同一个数据提交里，不要把无关的页面改动混进去。

用 Pull Request 合并。说明里写清用户能看到的变化；对应议题使用 `Closes #编号`。PR 模板中的 AGENTS.md 清单需要逐项勾选。

## 改代码

新增服务原则上只增加配置和数据：`service` JSON、问题、条件、价格规则、样本和索引。不要在 React 组件或通用引擎里写某一个服务的分支，也不要为每个服务复制一套页面。

计价必须继续满足：

- 相同输入和相同数据得到相同结果
- `calculatePrice` 保持纯函数，调用方传入 `asOf`，函数内部不读取当前时间
- 结果带有可复算的价格构成
- LLM 不直接决定价格

问题的显示、隐藏和校验放在 Question Engine，用配置里的 `visibility` 表达。改 `lib/pricing/` 或 `lib/question-engine/` 时，补上对应单元测试，并跑下面的全部校验。

URL 参数和 JSON 都要经过 Schema。不要用 `eval`，不要把用户输入交给 `dangerouslySetInnerHTML`。

## 贡献价格数据

提交前先用 Issue 模板「价格数据贡献」写明服务、条件、地区、样本类型、金额、**来源网址**、**采集日期**和 **ODbL 再发布许可**。没有这些材料就不要开数据 PR。

正式文件放在：

```text
data/categories/
data/services/
data/regions/
data/price-samples/
```

`data/fixtures/` 只放合成演示数据。不要把演示金额抄进正式目录，也不要把它写进文档当行情。正式记录的 `demo` 必须为 false。

建议步骤：

1. 按 `schemas/` 写服务、问题和价格规则。显示条件只引用前面的问题。
2. 需要新地区时，在 `data/regions/` 增加城市。城市要用省级回退，就填写 `parentId` 并提交对应的 `province` 记录；要用城市等级回退，城市和一条 `level: "city_tier"` 的记录必须使用同一个 `tier`（`tier_1`、`new_tier_1`、`tier_2` 或 `other`）。全国回退还需要唯一的 `national` 记录。地区 ID 由审核确定，不要整份复制演示地区文件。
3. 样本与规则分开提交。`price` 是观察到的整数元，区间仍由规则计算。
4. 贡献者把样本留为 `verified: false`，把尚未审核的服务留为 `draft`。
5. 在 PR 中给出服务名称、分类、问题流程、来源、地区、采集日期、脱敏情况和再发布依据，以及针对该服务的测试。
6. 审核者核对金额依据和授权之后，才在合并前改为 `verified: true`，并把服务改为 `active`。

无法确认来源或再发布权时，不要为了让服务变成 `active` 而补数据。此时保持数据不足。

## 提交前要跑的命令

```sh
pnpm validate:data
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

改了页面交互、问答或结果展示时，再安装浏览器并跑端到端测试：

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm build` 会再次执行数据校验和 TypeScript 检查。这些命令失败时不要合并。不要删掉失败的测试来换取通过。

## 审核清单

审核代码时确认：

- 计价仍是确定性纯函数，价格构成可以重放
- 没有让 LLM 直接生成价格
- 没有在 UI 写死单一服务
- 演示数据和正式数据的 `demo` 标记与目录一致
- 已运行上一节的命令；改了交互的 PR 包含 `pnpm test:e2e`

审核数据时确认：

- 来源网址、采集日期、地区和样本类型能与金额对应
- 来源等级没有被写高，空来源没有入库
- 规则区间有证据支持，而不是演示数字或模型估计
- 记录不含姓名、手机号、详细地址、订单号、身份证或其他可识别个人信息
- 贡献者已经说明 ODbL 1.0 再发布权利
- 未通过的样本没有标成 `verified: true`，服务也没有提前标成 `active`

## 许可证

仓库所有者已确认：**代码保持 Apache License 2.0，不改为 MIT。** 依据是仓库根目录的 `LICENSE` 和 `package.json` 的 `"license": "Apache-2.0"`。本说明不修改这两个地方。

早期设计草稿曾经建议代码使用 MIT，见 `PRD.md` 第 23 节「开源策略」，以及 `PriceRight 技术设计文档 TECHNICAL_DESIGN.md` 第 38 节「开源规范」。那是草稿建议。现行代码许可证以 `LICENSE` 为准。

对贡献者有实际影响的差异是：Apache-2.0 在允许使用、修改和再分发之外，包含明确的专利许可，并要求保留声明、标明修改、随作品提供许可证文本。按 Apache-2.0 第 5 条，故意提交并被接纳入仓库的代码贡献，默认也以 Apache-2.0 授权，除非贡献者另行书面声明。

**数据使用 Open Database License (ODbL) 1.0**，见 `LICENSE-DATA`。这与上述设计草稿一致。价格样本、地区数据和其他进入数据库的内容按 ODbL 贡献；演示目录中的合成数据同样只作为演示数据，不改变这个许可划分。再发布时需要署名、对公开的衍生数据库保持 ODbL，并且不附加取消这些权利的限制。细节见 [DATA_SOURCES.md](DATA_SOURCES.md)。

普通 PR 不要改 `LICENSE`、`LICENSE-DATA` 或 `package.json` 的 `license` 字段。
