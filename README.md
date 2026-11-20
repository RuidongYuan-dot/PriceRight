# PriceRight

面向普通消费者的开源线下服务参考价格查询项目。当前可体验吸顶灯和窗帘安装的完整查询流程。演示使用合成数据，正式价格样本待审核收录。

## 本地开发

需要 Node.js 22.18 或更高版本，以及 package.json 指定版本的 pnpm。安装了 Corepack 的环境也可用 `corepack pnpm` 运行以下命令。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm validate:data
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

`dev` 启动 Next.js 开发服务器。从首页进入「服务目录」中的演示分类，选择吸顶灯安装或窗帘安装并开始查询。浏览器测试覆盖手机与桌面视口、条件问答、地区选择、价格明细和数据不足状态。构建依次执行数据校验、TypeScript 检查和 Next.js 生产构建。

分类、服务和问答页面按已校验目录预渲染。演示页面在各栏目下使用独立的 `demo` 路径段，例如 `/estimate/demo/demo-lamp-install`。问答和报价在浏览器内使用当前服务配置和样本计算。

## 持续集成

`.github/workflows/ci.yml`（工作流名 `CI`）在拉取请求和向 `main` 的推送上运行。同一拉取请求的新推送会取消仍在进行的运行；推送到 `main` 的运行会跑完。运行环境与 `package.json` 一致：Node.js 22（`engines` 要求 22.18 及以上）以及 `packageManager` 声明的 pnpm。依赖用 `pnpm install --frozen-lockfile` 安装，并通过 setup-node 缓存 pnpm store。

以下步骤按顺序执行。任何一步失败，job `ci` 与整个工作流都会失败：

1. `pnpm validate:data`
2. `pnpm lint`
3. `pnpm exec tsc --noEmit`
4. `pnpm test`
5. `pnpm build`
6. 安装 Playwright Chromium 后执行 `pnpm test:e2e`

CI 中的端到端测试会生成 HTML 报告，并在失败时保留截图和 trace。该步骤失败时，工作流上传名为 `playwright-report` 的产物，包含 `playwright-report/` 与 `test-results/`，保留 7 天。本工作流只做检查。

保护 `main` 时，由仓库所有者在 GitHub 的分支保护或规则集里把 status check **`ci`** 设为 required。这是本工作流唯一的检查运行名称（工作流名 `CI`，job 名 `ci`）。规则集界面里它显示为 **`CI / ci`**。需要等该检查至少成功运行一次后，才能在设置里搜到它。

## 数据与审核

| 目录 | 内容 |
| --- | --- |
| `data/categories/` | 分类 |
| `data/services/` | 服务、问题顺序、服务范围、价格规则及更新时间 |
| `data/regions/` | 城市、所属省份、城市等级和全国记录 |
| `data/price-samples/` | 样本金额、币种、条件、来源类型、来源、采集日期与核验状态 |
| `data/fixtures/` | 独立的合成数据集，结构与正式目录相同 |

每个 UTF-8 JSON 文件可包含一条记录或一个记录数组，支持按分类建立子目录。Schema 位于 `schemas/`。问题标识在服务内唯一，条件只能引用当前问题之前的问题（定价条件可以引用任何题）。选项答案使用配置中的 `value` 并保留其原始类型。服务和样本的 `demo` 标记必须与所在目录一致。生产入口 `loadCatalog("data")` 只读取正式数据。

新增服务时，在相应目录提交服务配置和可追溯的样本，运行校验和针对该服务的测试。由审核者核对服务条件、规则及金额依据、地区、采集时间、隐私脱敏和再发布授权，经确认后才将样本设为 `verified: true`、服务设为 `active` 并合入正式数据。自动校验检查格式和引用，业务依据及授权由人工核验。可参考 [吸顶灯 demo](data/fixtures/services/lamp-install.json) 了解配置形状。

## 核心调用

以下代码可以放在项目根目录的 TypeScript 脚本中运行。示例显式加载 demo。

```ts
import { loadCatalog } from "./lib/data/loader";
import { evaluateQuestions } from "./lib/question-engine/evaluate";
import { calculatePrice } from "./lib/pricing/calculate";

const catalog = await loadCatalog("data/fixtures", true);
const service = catalog.services.find(({ id }) => id === "demo.lamp-install");
if (!service) throw new Error("缺少吸顶灯演示服务");
const input = { "lamp-type": "ceiling", quantity: 2, "remove-old": false };
const state = evaluateQuestions(service.questions, input);
if (state.complete) {
  const result = calculatePrice(service, input, "beijing", {
    regions: catalog.regions,
    samples: catalog["price-samples"],
  });
  console.log(result.status, result.status === "estimated" && result.breakdown);
}
```

`evaluateQuestions` 按配置顺序返回可见问题、有效答案和逐题错误。支持单选、多选、数字、布尔、下拉、面积和距离。多个条件取交集，缺失答案使条件不成立。隐藏题的旧答案会退出后续判断和报价。`nextQuestion` 返回下一道可见题，当前题有错误时停留在该题。

## 价格计算

- 金额统一使用 CNY 整数元。基础价格可通过 `unitQuestionId` 绑定数量、小时数、面积或距离。地区 `priceOverride` 替换基础单价。服务级和所选选项上的固定与按量附加费只收一次，按量费再乘其绑定题的用量。按量附加费绑定的题目隐藏或选填未答时，跳过该项。
- 百分比附加费使用同一小计，随后应用匹配地区的系数和最低收费。每次乘法按十进制四舍五入到元。明细中的 `add` 表示加上本行金额，`replace` 表示执行调整后的累计区间，依次应用即可复算结果。
- 样本用于确认价格规则的适用范围及披露依据。只使用服务、数据集和答案条件匹配的已核验样本，多选条件按集合比较。依次检查城市、省份、城市等级、全国，取首个有有效样本的地区。只使用该地区的专用规则，未配置时使用服务基础规则。不同地区的样本不会混算。
- `estimated` 返回区间、明细、实际采用地区、来源等级、样本数和最近采集日期。`invalid_input` 返回答题或地区错误。`insufficient_data` 返回空区间和数据不足说明。demo 结果带有明确标记。
- 当前规则默认将少于 5 条样本标为粗略参考，可按服务配置 `minimumSampleCount`。demo、城市等级及全国推算均为低可信度。地区样本达到门槛时为一般，城市已核验成交或服务商报价达到门槛时为较高。可传入固定的 `asOf` 日期排除晚于该日期的样本并检查时效。最近 365 天达到三倍门槛且含真实成交样本的城市估算可评为高，全部样本超过一年则提示可能过时。相同输入和数据版本始终得到相同结果。这些门槛是初始分级规则，尚待真实数据检验。

代码许可证见 [LICENSE](LICENSE)，数据许可证见 [LICENSE-DATA](LICENSE-DATA)。产品和架构依据见 [PRD](PRD.md) 和 [技术设计](PriceRight%20技术设计文档%20TECHNICAL_DESIGN.md)。
