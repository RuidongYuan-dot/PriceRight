# 数据来源

正式价格数据记录的是可追溯的观察，不是为了把页面填满而补上的数字。没有可靠来源时，服务应保持不可报价，并向用户说明数据不足。

样本和规则是分开的。样本证明「在这个地区、这组条件下，曾经观察到什么，以及依据从哪来」。服务配置里的 `pricing` 才是计算合理参考价格的规则。引擎不会把样本金额汇总成区间。审核时要同时看规则是否配得上这些证据。计算口径见 [PRICING_METHODOLOGY.md](PRICING_METHODOLOGY.md)。

## 正式数据与演示数据

| 路径 | 用途 |
| --- | --- |
| `data/categories/` | 正式分类 |
| `data/services/` | 正式服务、问题、范围和价格规则 |
| `data/regions/` | 正式城市、省份、城市等级和全国记录 |
| `data/price-samples/` | 正式价格样本 |
| `data/fixtures/` | 合成演示数据，目录结构与正式数据相同 |

生产入口 `loadCatalog("data")` 只读正式目录，并跳过 `fixtures`。演示流程必须显式加载 `data/fixtures`。校验会分别检查两套数据。

每条服务和样本都有 `demo`。正式目录中必须为 false，演示目录中必须为 true。两套标记不能混放。演示结果在页面上是「演示价格区间」和「合成数据」，不是合理参考价格。

正式目录里的样本是已核验的公开价格。演示文件里的金额只用于把问答和计价跑通，不能写入正式数据，也不能在文档或页面里当成行情。

## 一条样本要记录什么

正式样本是 UTF-8 JSON，无注释。文件可以是一条记录，也可以是数组，并可以按分类放在子目录中。字段至少包括：

```text
id
serviceId
regionId
price
currency
sampleType
source
collectedAt
verified
demo
```

约定如下：

- `id` 在价格样本中唯一；服务、分类、地区 ID 也各自唯一
- `price` 是非负整数元，`currency` 固定为 `CNY`
- `collectedAt` 是采集日期，格式 `YYYY-MM-DD`
- `conditions` 可选，键必须是该服务的问题 ID。值是合法答案，或数值题（`number`、`area`、`distance`）上的闭区间 `{ min?: number, max?: number }`。区间至少有一个边界，且下限不超过上限。匹配规则见 [PRICING_METHODOLOGY.md](PRICING_METHODOLOGY.md)
- `source` 是可核对的来源名称；能公开的网址写在这里或 PR 说明中
- 新提交的正式样本 `verified` 为 false，`demo` 为 false

`price` 是证据金额，供审核对照规则。它不是结果页上的合理参考价格。

## 来源等级

`sampleType` 决定披露给用户的来源等级：

| 字段值 | 等级 | 含义 |
| --- | --- | --- |
| `actual_transaction` | A | 实际成交 |
| `provider_quote` | B | 服务商公开报价 |
| `public_price` | C | 公开平台报价 |
| `manual_reference` | D | 人工整理参考 |

无法记录来源的数据不能进入样本，Schema 会拒绝空的 `source`。只靠 C、D 两类样本，可信度到不了「较高」。等级如何影响可信度，见计价方法中的分级规则。

人工整理参考仍然必须指向整理时所依据的公开材料或可复核记录。不能用「经验上大概是这个数」充当 D 类来源。

## 第二批已入库来源（2026-11-20）

仓库所有者已批准将下列经原文核验的公开人民币价格写入正式目录，样本为 `verified: true`、`demo: false`，服务为 `active`。采集日一律 `2026-11-20`。金额只来自页面或 PDF 原文中的整数元；「xx 元起」、非整数元，以及原文没有写明计算顺序的系数，都没有换算成新的一口价。`data/fixtures/` 未改。

| 服务 | 地区 | 来源 |
| --- | --- | --- |
| 空调清洗 `ac-cleaning` | `shanghai` | 上海住宅物业网 [962121 热线特约维修服务收费标准（2026 版）](https://962121.fgj.sh.gov.cn/wyweb/web/front/13weixiu/hongkouqu.jsp)。挂机 99 元/台、立式 128 元/台、吊顶式 115 元/台、中央空调 115 元/组。这是表内标准项，深度清洁仍是面议 |
| 空调清洗 | `cn` | [海尔空调售后收费标准](https://www.haier.com/support/charges/air_conditioners/)。柜挂清洗用「2025～2026 年度」表；家中机、柜嵌和水机保养用「2024～2025 年度」表。高空、远程、上门和加氟按各自表格单列，不加到清洗价上 |
| 智能门锁安装 `smart-lock-install` | `cn` | [小米米家智能门锁安装须知](https://www.mi.com/mj-smartlock/notes)、[安装服务介绍](https://ics-resources.xiaomi.com/ics-resources/articles/5d5d193d022dacc0cc80a828.html)、[公牛服务政策](https://www.gongniu.cn/server/policy.html)、[凯迪仕售后政策](https://www.kaadas.com/About/service.html) |
| 卫浴洁具安装 `bathroom-fixture-install` | `shanghai` 或 `cn` | 同上 962121 2026 版；[上海市室内装饰行业协会 2025 版通知](https://www.snzsxh.com/node/25945)及 [PDF](https://www.snzsxh.com/sites/default/files/2025-01/%E5%85%B3%E4%BA%8E%E3%80%8A%E4%B8%8A%E6%B5%B7%E5%B8%82%E4%BD%8F%E5%AE%85%E8%A3%85%E9%A5%B0%E8%A3%85%E4%BF%AE%E4%BA%BA%E5%B7%A5%E8%B4%B9%E5%8F%82%E8%80%83%E4%BB%B7%EF%BC%882025%E7%89%88%EF%BC%89%E3%80%8B%E7%9A%84%E5%8F%91%E5%B8%83%E9%80%9A%E7%9F%A5.pdf)中的整数元项；[宜家中国浴室安装](https://www.ikea.cn/cn/zh/customer-service/services/kitchen-installation/)；[箭牌安装服务收费标准参考](https://www.arrow-home.cn/col37/index)；[TOTO 安装政策](https://www.toto.com.cn/cn/service_installment.html) |
| 水龙头与角阀 `faucet-valve-install` | `shanghai` 或 `cn` | 962121 2026 版分档、协会整数项、宜家龙头/皂液器、箭牌龙头与小五金件基础价 |
| 开关插座安装更换 `switch-outlet-install` | `shanghai` 或 `cn` | 962121 2026 版统一单价；箭牌电路改造 198 元/次整包 |

口径边界：

- 全国官方指导价的 `regionId` 是 `cn`。用户选北京、广州、深圳或杭州时，引擎回退并说明用的是全国参考，不把这些样本复制成城市价。
- 上海热线价和协会价的 `regionId` 是 `shanghai`。其他城市没有对应样本时返回数据不足，不用上海价填上。
- 普陀、徐汇、嘉定区应急中心与 2026 版冲突的项目（换水龙头「70 元起」、马桶更换 240 元、配件 70 元、开关插座分档）不入库、不取平均。空调清洗金额与 2026 版一致，因此不重复入库。
- 海尔家中机远程费、公牛和箭牌的「超出部分 1.5 元/公里」不是整数元，未入库，也不改用另一张表的档位。
- 箭牌北上广深杭系数 1.2 与「不满 50 元按 50 元收」的先后顺序原文未写明。入库的是基础价和单独的 50 元规则，没有写成 42 元或其他乘算结果。空跑费按原文分城：五城 50 元，其余已列入地区 40 元。新疆、西藏的 60 元因地区列表中没有这两地，未另建样本。
- 小米首次安装、凯迪仕官方渠道、TOTO 官方授权智能产品的上门及人工是 0 元，并且只在对应条件下参与，避免把免费样本算进常规收费的中位数。辅材和坑管修补没有标价。
- 智能门锁服务明确排除传统机械锁应急开锁和换锁芯。这两项在五城都没有可核验的公开官方价。

后续贡献仍按下一节执行：新样本在审核通过前为 `verified: false`，服务在审核通过前不为 `active`。

## 第三批已入库来源（2026-11-20）

仓库所有者已批准把下列经 HTTP 200 原文核验的公开人民币价格写入正式目录。样本为 `verified: true`、`demo: false`、`currency: "CNY"`、`collectedAt: "2026-11-20"`，服务为 `active`。金额只使用调研原文里的整数元。小数元单价不四舍五入，原文没写单位的项目不补单位。`data/fixtures/` 未改。本批不部署、不切换线上 GitHub Pages。

| 服务 | 地区 | 来源 |
| --- | --- | --- |
| 小型搬家与同城货运 `small-moving` | `beijing`、`shanghai`、`guangzhou`、`shenzhen`、`hangzhou` 各自独立 | 快狗打车（原 58 速运）分城价格表：[北京](https://suyun.daojia.com/m/changecity?cityId=1&cityName=%E5%8C%97%E4%BA%AC)、[上海](https://suyun.daojia.com/m/changecity?cityId=2&cityName=%E4%B8%8A%E6%B5%B7)、[广州](https://suyun.daojia.com/m/changecity?cityId=3&cityName=%E5%B9%BF%E5%B7%9E)、[深圳](https://suyun.daojia.com/m/changecity?cityId=4&cityName=%E6%B7%B1%E5%9C%B3)、[杭州](https://suyun.daojia.com/m/changecity?cityId=79&cityName=%E6%9D%AD%E5%B7%9E)。只收起步价、整数超里程，以及整数等候超时（每 15 分钟 10 元、每 30 分钟 40 元；广州部分小车每 10 分钟 5 元） |
| 小型搬家与同城货运 | 同上五城，各用各城 URL | 蓝犀牛搬家资费页：[北京](https://www.lanxiniu.com/price/110100)、[上海](https://www.lanxiniu.com/price/310100)、[广州](https://www.lanxiniu.com/price/440100)、[深圳](https://www.lanxiniu.com/price/440300)、[杭州](https://www.lanxiniu.com/price/330100)。放心搬家小面、中面、小厢货、厢货的工作日和周末起步价；同城超公里 5、6、7 元/公里；日式搬家全日式 1400 元、半日式 1150 元（五城金额相同，仍按城建样）；超出 5 立方米全日式 280 元、半日式 230 元 |
| 家具组装与旧家具拆运 `furniture-assembly` | `cn` | 宜家中国[《组装服务介绍》](https://www.ikea.cn/cn/zh/customer-service/services/assembly-intro/)：59 元展示价、基础费 49 元、每分钟 2 元、上墙 30 元/件。[《旧家具拆运服务》](https://www.ikea.cn/cn/zh/customer-service/services/removal-recycling/)：149 元/件与 249 元/件。[厨房与浴室安装](https://www.ikea.cn/cn/zh/customer-service/services/kitchen-installation/)：旧厨房拆除 499 元/套、旧浴室拆除 299 元/套、完整浴室安装 200 元/套、安纳特系列 169 元/套、单个浴室柜或配件 100 元/个 |
| 日常保洁与深度保洁 `home-cleaning` | 日常保洁为 `beijing`、`shanghai`、`shenzhen`、`hangzhou`；深度和消杀仅为 `beijing` | [自如日常保洁](https://sm.ziroom.com/clean/general/dailyIntro.shtml)：35 元/小时、2 小时起约，85 平方米以下 70 元。价表未写城市；同页脚本有京沪深杭服务 ID，没有广州。[深度保洁](https://sm.ziroom.com/clean/general/depthIntro.shtml)与[消杀保洁](https://sm.ziroom.com/clean/general/killIntro.shtml)写明北京五环内，以及天通苑、大兴、通州 |
| 日常保洁与深度保洁 | `cn` | [好慷在家官网百科](https://www.homeking365.com/guide/home-cleaning/price/)（正文更新于 2026-10-20）。45 元/小时与 55 元/小时、4 小时约 180 元与 220 元分开记录，不取中点。3 次体验 599 元起，厨卫深度 359 元起/间。实际以下单页为准 |
| 冰箱洗衣机与油烟机清洗 `home-appliance-cleaning` | `shanghai` | 同上 [962121 热线 2026 版](https://962121.fgj.sh.gov.cn/wyweb/web/front/13weixiu/hongkouqu.jsp) 的冰箱、洗衣机、油烟机。不是日常保洁，也不重复空调清洗 |

口径边界：

- 快狗微面超里程原文是 2.85 元/公里，上海依维柯超里程原文是 4.5 元/公里，跑腿和微面等候超时原文是每分钟 0.5 元。这三项都不是整数元，没有取整入库。
- 蓝犀牛跨城小面和中面超公里原文是 4.5 元/公里，未入库。日式搬家「超过 20 公里 7 元」原文没有写单位，没有补成每公里。
- 页面没写夜间费的车型不按 0 元。已经写明的夜间费（例如部分城市小面 20 元，广州、深圳部分车型 40 元或 80 元）本次不加进起步价。深圳厢货周六日是 448 元，不是北上广的 428 元。杭州放心搬家页面没有工作日和周末两个价。
- 快狗搬运费官方写明与司机商议。货拉拉价格页是动态加载，没有静态金额，不入库。
- 楼层、拆装、加人、远郊等价已在蓝犀牛页面核验，本次不与起步价相加。日式钢琴搬运 350 元、450 元、650 元也只记在服务范围里，不单列成查询项。
- 宜家 59 元是 5 分钟展示价，不是每件一口价。基础费 49 元和每分钟 2 元分开查。万师傅通道是竞价，没有固定价。源氏木语只有免费上门安装，不记成 0 元。完整厨房安装本体价没有公示。协会的橱柜拆除和成品木门不是成品家具组装。
- 自如 105 至 140 元、好慷 45 至 55 元和 180 至 220 元都按端点分开，不取中位数。四居以上的 9 元/平方米和 1200 元起也不自动取较高者。轻喜到家 37 元/小时只有新客促销、没有时长和城市，未入库。
- 洗车：途虎等官网没有可核验的静态有偿价表，五城都不建正式服务。改裤脚：优衣库中国官方 FAQ（<https://www.uniqlo.cn/public/code/DH/DH3.html>）只说明天猫官方旗舰店购买的裤装可到实体店免费修改裤长（明线处理），运动裤等不适合，部分门店暂不能改，改后不可退换。这不是社会有偿改衣价，本批不建改衣服务。宜家成品窗帘改高拼宽 39 元/两片是纺织品改尺，不是服装裤脚，本批也不并入。

## 结果页上的样本明细

报价结果列出本次实际参与计算的合格样本。展示字段限于 `id`、`price`、`currency`、`sampleType`、`regionId`、`source`、`collectedAt`、`verified`、`demo`。页面用地区名称、样本类型、采集日期、核验状态和是否演示样本说明这些记录。样本标价是观察金额，不是合理参考价格。

来源文字里的 `http://` 与 `https://` 可以在新标签页打开，并带上 `rel="noopener noreferrer"`。`javascript:`、`data:` 和其他纯文本只按文本显示。没有合格样本时，页面说明暂无可展示样本，不编造来源。

## 机器校验与人工审核

`pnpm validate:data` 检查两边目录的 JSON、Schema、唯一 ID、分类和服务引用、地区引用、问题与条件、`min <= max`、非负金额，以及 `demo` 是否和目录一致。定价条件可以引用该服务的任一问题；问题的显示条件只能引用它前面的问题。

自动校验不判断金额是否真实，也不判断能不能再发布。合并前由审核者核对：

- 服务条件、包含范围和价格规则与证据一致
- 样本金额、地区、采集日期和来源能够对上
- 来源等级没有被写高
- 记录已脱敏
- 贡献者有权按 ODbL 1.0 再发布

确认之后，才把样本改为 `verified: true`，并把服务改为 `active`，然后合并进正式目录。未通过审核的样本不要写入 `data/`。`verified: false` 的样本即使出现在目录里，也不会参与计价。`draft` 和 `coming_soon` 服务即使已有样本，也只返回数据不足。

## 禁止编造

没有可靠本地数据时，正确结果是数据不足：

```text
目前暂无足够的可用价格数据，暂不能提供可靠参考价格。
```

不允许为了让区间看起来完整而填写价格、来源、采集日期或 `verified: true`。不允许把 LLM 的估计写进正式样本或规则。AI 草稿只有经过这条审核路径之后，才能成为正式数据。

同样不允许因为仓库开源就复制：

- 商业数据库
- 第三方网站的完整价格表
- 用户订单
- 未经授权的商家数据

许可范围无法确认时，不要放入正式数据。

样本若包含姓名、手机号、详细地址、订单号、身份证或其他可识别个人信息，不能公开。成交记录入库前必须脱敏，只保留计价和审核需要的条件与金额。

## 时效

每条样本以 `collectedAt` 记录采集日期。评估某天的时效时，调用方传入固定的 `asOf`：晚于该日的样本不参与，全部早于该日超过 365 天的样本仍可参与，但结果必须提示「价格数据可能已经过时」，且可信度保持低。不要回填一个更近的采集日期来回避这个提示。

## 数据许可证与再发布

`LICENSE-DATA` 规定：PriceRight 数据库以 [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 提供。`data/fixtures/` 下的合成数据是演示数据。第三方材料只有在获得再发布许可后才能贡献。

ODbL 1.0 允许在遵守下列条件时复制、分发、改编数据库，并用它制作作品：

- **署名**：公开使用时保留数据库的来源和许可说明
- **相同方式共享**：公开使用改编后的数据库时，该衍生数据库仍以 ODbL 提供，并提供机器可读副本
- **保持开放**：不再附加会取消这些权利的技术限制或额外条款

向用户展示一次合理参考价格，是使用数据库产生的作品。把样本整理成另一份可再发布的数据集，则仍受 ODbL 约束。贡献即表示这些内容可以按 ODbL 1.0 再发布；依据写在数据贡献说明或 PR 中。当前样本 Schema 没有单独的许可字段。

代码许可证是 Apache-2.0，与数据库许可证分开，见 [CONTRIBUTING.md](CONTRIBUTING.md)。
