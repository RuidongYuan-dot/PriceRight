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

`dev` 启动 Next.js 开发服务器。首页服务目录可以按关键词或分类筛选服务，演示结果会标明「演示数据」。也可以从「服务目录」进入演示分类，选择吸顶灯安装或窗帘安装并开始查询。浏览器测试覆盖手机与桌面视口、目录搜索、条件问答、地区选择、价格明细和数据不足状态。构建依次执行数据校验、TypeScript 检查和 Next.js 静态导出。本地两种导出命令见下方「静态导出」。

分类、服务和问答页面按已校验目录预渲染。演示页面在各栏目下使用独立的 `demo` 路径段，例如 `/estimate/demo/demo-lamp-install/`。问答和报价在浏览器内使用当前服务配置和样本计算。

## 静态导出

`pnpm build` 依次执行数据校验、TypeScript 检查，并以 `output: "export"` 把站点写到 `out/`。静态导出不使用 Next.js 图片优化服务，因此 `images.unoptimized` 为 `true`。路由带尾部斜杠，页面文件是目录中的 `index.html`，与现有 `gh-pages` 分支一致。`public/` 会原样复制到 `out/`，其中包含空的 `.nojekyll`，避免 Jekyll 跳过 `_next`。

`basePath` 与 `assetPrefix` 都来自 `NEXT_PUBLIC_BASE_PATH`。未设置或设为空字符串时不做前缀，用于本地开发、CI 和根路径托管。值必须为空，或以 `/` 开头且不以 `/` 结尾，例如 `/PriceRight`。根目录 [`.env.example`](.env.example) 记录了这个变量：本地和根路径构建留空，GitHub Pages 构建使用 `/PriceRight`。`next/link` 会自动加上该前缀。`public/` 图片经 `publicAssetPath()` 拼接同一前缀后传给 `next/image`。

根路径导出：

```sh
pnpm build
```

`out/index.html` 引用 `/_next/static/...` 与 `/images/ceiling-light.jpg`。对应文件在 `out/_next/` 和 `out/images/`。

GitHub Pages 项目站点导出：

```sh
NEXT_PUBLIC_BASE_PATH=/PriceRight pnpm build
```

HTML 改为引用 `/PriceRight/_next/static/...` 与 `/PriceRight/images/ceiling-light.jpg`。导出文件位于 `out/` 根目录（`out/_next/`、`out/images/`、`out/index.html`）。`/PriceRight` 只出现在 URL 里。GitHub Pages 项目站点把发布根目录挂到 `/PriceRight`，因此与 `https://ruidongyuan-dot.github.io/PriceRight/` 以及当前 `gh-pages` 分支的文件布局一致。CI 的 `pnpm build` 和端到端测试使用默认空前缀。端到端测试通过后，CI 再执行 `NEXT_PUBLIC_BASE_PATH=/PriceRight pnpm build`，并确认 `out/.nojekyll` 存在。

## 分享查询结果

报价结果可以分享。页面把地区和已生效的答案写进当前地址的查询参数，再用原来的计价函数重算。不需要账号，也不保存服务器会话。打开链接时按该服务的问题配置用 Zod 校验参数。相同条件和相同数据得到相同区间、构成、可信度和提示。

`region` 是地区 id，只接受城市或「我的城市不在列表中（全国参考）」对应的全国记录。其他参数名是服务配置里的问题 id：布尔值为 `true` 或 `false`，数字为十进制，单选和多选为选项的 `value`，多选重复同一个参数名。问题 id 如果正好是 `region` 或 `asOf`，答案写在 `~region` 或 `~asOf`。可选的 `asOf` 是 `YYYY-MM-DD` 评估日。选项的文本、数字和布尔值若会写成同一个字符串，该题改用 `b:`、`n:`、`s:` 前缀。

```text
/estimate/demo/demo-lamp-install/?region=beijing&lamp-type=ceiling&quantity=2&remove-old=false
```

静态导出下，分享地址使用浏览器当前的 origin、`basePath` 和路径。结果页的「复制分享链接」复制这个地址；如果剪贴板不可用，页面会给出可手动复制的链接。无法识别、超长、超出范围或残缺的参数会被忽略并提示，问卷仍可继续。

## 手动发布到 GitHub Pages

线上站点是 <https://ruidongyuan-dot.github.io/PriceRight/>。仓库 Pages 当前从 **`gh-pages` 分支根目录**发布（Pages API 的 `build_type` 为 `legacy`，由 GitHub 内置工作流 `pages-build-deployment` 构建）。

`.github/workflows/deploy-pages.yml`（工作流名 `Deploy GitHub Pages`）只能在 Actions 页面手动运行（`workflow_dispatch`）。拉取请求和向 `main` 的推送都不会触发它。

手动运行时，工作流使用 Node.js 22 和 `pnpm install --frozen-lockfile`，然后按顺序执行：

1. `pnpm validate:data`
2. `pnpm lint`
3. `pnpm exec tsc --noEmit`
4. `pnpm test`
5. `NEXT_PUBLIC_BASE_PATH=/PriceRight pnpm build`
6. 确认 `out/.nojekyll` 存在
7. 上传包含隐藏文件的 Pages 制品，并部署到 GitHub Pages

`actions/deploy-pages` 要求 Pages 的 Source 为 **GitHub Actions**（`build_type: workflow`）。在 Settings → Pages → Build and deployment 完成这次切换之前，部署步骤会失败并保留现有站点；该工作流不会向 `gh-pages` 推送。切换之后，线上内容只随这个手动工作流更新，`gh-pages` 分支不再是发布来源。部署 job 使用名为 `github-pages` 的环境。若要在点击运行之后再要求批准，由仓库所有者给该环境加上 Required reviewers。

## 持续集成

`.github/workflows/ci.yml`（工作流名 `CI`）在拉取请求和向 `main` 的推送上运行。同一拉取请求的新推送会取消仍在进行的运行；推送到 `main` 的运行会跑完。运行环境与 `package.json` 一致：Node.js 22（`engines` 要求 22.18 及以上）以及 `packageManager` 声明的 pnpm。依赖用 `pnpm install --frozen-lockfile` 安装，并通过 setup-node 缓存 pnpm store。

以下步骤按顺序执行。任何一步失败，job `ci` 与整个工作流都会失败：

1. `pnpm validate:data`
2. `pnpm lint`
3. `pnpm exec tsc --noEmit`
4. `pnpm test`
5. `pnpm build`
6. 安装 Playwright Chromium 后执行 `pnpm test:e2e`
7. `NEXT_PUBLIC_BASE_PATH=/PriceRight pnpm build`，并确认 `out/.nojekyll` 存在

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

每个 UTF-8 JSON 文件可包含一条记录或一个记录数组，支持按分类建立子目录。Schema 位于 `schemas/`。问题标识在服务内唯一，条件只能引用当前问题之前的问题（定价条件可以引用任何题）。选项答案使用配置中的 `value` 并保留其原始类型。服务和样本的 `demo` 标记必须与所在目录一致。服务可以写可选的 `keywords`（别名、标签、关键词），只用于目录搜索，不参与计价。生产入口 `loadCatalog("data")` 只读取正式数据。

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
- `estimated` 返回区间、常见价格、明细、实际采用地区、来源等级、样本数和最近采集日期。常见价格是已匹配样本金额的中位数；没有可用样本时结果为 `insufficient_data`，不返回金额。`invalid_input` 返回答题或地区错误。demo 结果带有明确标记。
- 查询页只把城市和「我的城市不在列表中（全国参考）」放进地区选择器。引擎仍按城市、省、城市等级、全国回退。分享链接使用 `region`、问题 id，以及可选的 `asOf`。不可选地区、非法日期和非法答案会被忽略。
- 当前规则默认将少于 5 条样本标为粗略参考，可按服务配置 `minimumSampleCount`。demo、城市等级及全国推算均为低可信度。地区样本达到门槛时为一般，城市已核验成交或服务商报价达到门槛时为较高。调用方传入固定的 `asOf` 后，才会排除更晚的样本并检查时效。查询页使用分享链接中的合法 `asOf`，否则使用打开页面时的上海日历日。最近 365 天达到三倍门槛且含真实成交样本的城市估算可评为高，全部样本超过一年则提示可能过时。相同输入、数据和 `asOf` 始终得到相同结果。评估日、常见价格和影响因素的规则见 [价格计算方法](docs/PRICING_METHODOLOGY.md)。这些门槛是初始分级规则，尚待真实数据检验。

代码许可证见 [LICENSE](LICENSE)，数据许可证见 [LICENSE-DATA](LICENSE-DATA)。产品和架构依据见 [PRD](PRD.md) 和 [技术设计](PriceRight%20技术设计文档%20TECHNICAL_DESIGN.md)。
