# PriceRight 技术设计文档

> 版本：v0.1 MVP  
> 对应 PRD：PRD.md  
> 状态：开发基准文档

---

# 1. 技术目标

PriceRight MVP 的技术目标：

> 构建一个由配置驱动的、确定性的、可解释的线下服务价格计算系统。

核心原则：

1. 服务定义与 UI 解耦。
2. 价格规则与 UI 解耦。
3. 价格计算必须确定性。
4. 数据必须可追溯。
5. 第一版尽可能无后端。
6. 所有核心逻辑必须可以自动测试。
7. 新增服务尽可能只增加配置，不修改核心代码。

---

# 2. 技术栈

## 前端

- Next.js
- TypeScript
- React
- Tailwind CSS

## 数据验证

- Zod

## 测试

- Vitest
- Playwright

## 包管理

推荐：

- pnpm

## 部署

MVP：

- Vercel / Cloudflare Pages / GitHub Pages 等静态或近静态部署方式

最终具体部署平台不作为业务逻辑依赖。

---

# 3. 为什么 MVP 不使用数据库

MVP 不需要：

- 用户账户
- 登录
- 订单
- 支付
- 商家
- 实时数据

因此价格数据直接存放在 Git 仓库：

```text
data/
```

优势：

- 完全开源
- Git 有版本历史
- 可以查看价格变化
- 可以通过 Pull Request 修改
- 不需要维护数据库
- AI Coding 非常方便
- 可以做数据审核

未来需要用户提交真实成交数据时，再引入后端数据库。

---

# 4. 项目目录

```text
priceright/
│
├── app/
│   ├── page.tsx
│   ├── categories/
│   │   └── [categoryId]/
│   │       └── page.tsx
│   │
│   ├── services/
│   │   └── [serviceId]/
│   │       └── page.tsx
│   │
│   └── estimate/
│       └── [serviceId]/
│           └── page.tsx
│
├── components/
│   ├── service/
│   ├── question/
│   ├── estimate/
│   ├── region/
│   └── common/
│
├── lib/
│   ├── pricing/
│   │   ├── calculate.ts
│   │   ├── normalize.ts
│   │   ├── confidence.ts
│   │   └── types.ts
│   │
│   ├── question-engine/
│   │   ├── evaluate.ts
│   │   ├── visibility.ts
│   │   └── validation.ts
│   │
│   ├── region/
│   │   └── resolve.ts
│   │
│   └── data/
│       ├── loader.ts
│       └── validator.ts
│
├── data/
│   ├── categories/
│   ├── services/
│   ├── regions/
│   └── price-samples/
│
├── schemas/
│   ├── service.schema.ts
│   ├── price.schema.ts
│   ├── region.schema.ts
│   └── category.schema.ts
│
├── scripts/
│   ├── validate-data.ts
│   └── build-index.ts
│
├── tests/
│   ├── pricing/
│   ├── question-engine/
│   └── e2e/
│
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_DESIGN.md
│   ├── PRICING_METHODOLOGY.md
│   ├── DATA_SOURCES.md
│   └── CONTRIBUTING.md
│
├── public/
│
├── README.md
├── LICENSE
├── LICENSE-DATA
├── package.json
└── tsconfig.json
```

---

# 5. 核心数据模型

PriceRight 的核心不是页面，而是数据模型。

---

# 6. Category

分类：

```typescript
type Category = {
  id: string
  name: string
  description?: string
  icon?: string
  order: number
}
```

例如：

```json
{
  "id": "home-installation",
  "name": "家居安装与维修",
  "order": 1
}
```

---

# 7. Service

服务：

```typescript
type Service = {
  id: string
  categoryId: string
  name: string
  slug: string
  description: string

  keywords?: string[]

  status: "active" | "draft" | "coming_soon"

  questions: Question[]

  pricing: PricingConfig

  scope: {
    included: string[]
    excluded: string[]
  }

  metadata: {
    createdAt: string
    updatedAt: string
  }
}
```

`keywords` 可选，用来记录搜索别名、标签和关键词。目录检索会读取它。价格计算不读取它。

---

# 8. Question

```typescript
type Question = {
  id: string
  type:
    | "single"
    | "multiple"
    | "number"
    | "boolean"
    | "select"
    | "area"
    | "distance"

  title: string
  description?: string

  required: boolean

  options?: QuestionOption[]

  visibility?: Condition[]

  validation?: ValidationRule
}
```

---

# 9. QuestionOption

```typescript
type QuestionOption = {
  id: string
  label: string
  description?: string

  value: string | number | boolean

  priceModifier?: PriceModifier[]
}
```

---

# 10. 条件规则

必须支持：

```typescript
type Condition = {
  questionId: string

  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "greater_than"
    | "less_than"

  value: string | number | boolean
}
```

例如：

```json
{
  "questionId": "lamp-type",
  "operator": "equals",
  "value": "large-chandelier"
}
```

含义：

> 只有灯具类型选择大型吊灯时才显示该问题。

---

# 11. PriceModifier

```typescript
type PriceModifier = {
  type:
    | "fixed"
    | "per_unit"
    | "percentage"

  min?: number
  max?: number

  value?: number

  label: string
}
```

---

# 12. PricingConfig

```typescript
type PricingConfig = {
  model:
    | "fixed"
    | "range"
    | "per_unit"
    | "hourly"
    | "area"
    | "distance"
    | "composite"

  basePrice: {
    min: number
    max: number
  }

  modifiers: PriceModifier[]

  regionRules?: RegionRule[]

  minimumPrice?: number
}
```

---

# 13. RegionRule

```typescript
type RegionRule = {
  regionId: string

  multiplier?: number

  priceOverride?: {
    min: number
    max: number
  }
}
```

---

# 14. PriceSample

价格样本必须和价格规则分离。

```typescript
type PriceSample = {
  id: string

  serviceId: string

  regionId: string

  price: number

  currency: "CNY"

  sampleType:
    | "actual_transaction"
    | "provider_quote"
    | "public_price"
    | "manual_reference"

  source?: string

  collectedAt: string

  conditions?: Record<string, unknown>

  verified: boolean
}
```

---

# 15. 数据来源等级

内部定义：

```typescript
type SourceLevel =
  | "A"
  | "B"
  | "C"
  | "D"
```

含义：

```text
A = 实际成交数据
B = 服务商公开报价
C = 公开平台报价
D = 人工整理参考
```

---

# 16. 价格计算模型

MVP 采用：

```text
基础价格
+
选项附加价格
+
地区调整
+
数量/面积/距离因素
=
参考价格
```

统一表示：

```typescript
type PriceRange = {
  min: number
  max: number
}
```

---

# 17. 价格计算必须是纯函数

核心函数：

```typescript
calculatePrice(
  service: Service,
  answers: Record<string, unknown>,
  region: Region
): PriceResult
```

必须满足：

```text
相同 service
+
相同 answers
+
相同 region
=
完全相同的 PriceResult
```

不能：

- 调用随机数
- 调用当前时间决定价格
- 调用 LLM
- 调用实时搜索
- 根据用户身份改变价格

---

# 18. PriceResult

```typescript
type PriceResult = {
  currency: "CNY"

  range: {
    min: number
    max: number
  }

  typical?: number

  breakdown: PriceBreakdownItem[]

  confidence: ConfidenceLevel

  sampleCount: number

  dataUpdatedAt: string

  warnings: string[]

  assumptions: string[]
}
```

---

# 19. PriceBreakdown

```typescript
type PriceBreakdownItem = {
  label: string

  range: {
    min: number
    max: number
  }

  source:
    | "base"
    | "modifier"
    | "region"
    | "quantity"
    | "distance"
    | "manual"
}
```

---

# 20. Confidence

```typescript
type ConfidenceLevel =
  | "high"
  | "medium_high"
  | "medium"
  | "low"
```

MVP 不要求建立特别复杂的统计模型。

先采用简单规则：

```text
高：
大量样本 + 城市级 + 数据较新

较高：
足够样本 + 城市级

一般：
样本有限

低：
数据很少或使用城市等级推算
```

以后再升级统计模型。

---

# 21. 地区模型

地区数据：

```typescript
type Region = {
  id: string

  name: string

  level:
    | "city"
    | "province"
    | "city_tier"

  tier?:
    | "tier_1"
    | "new_tier_1"
    | "tier_2"
    | "other"

  parentId?: string
}
```

例如：

```json
{
  "id": "cn-beijing",
  "name": "北京",
  "level": "city",
  "tier": "tier_1"
}
```

---

# 22. 地区优先级

价格数据匹配必须遵守：

```text
城市
 ↓
省级
 ↓
城市等级
 ↓
全国
```

如果北京有城市级数据：

> 禁止优先使用一线城市平均价格。

只有城市数据不足时才允许降级。

结果页面必须显示：

```text
本结果基于北京本地数据
```

或者：

```text
北京本地数据不足，
当前使用一线城市参考数据进行估算。
```

---

# 23. 数据不足处理

这是系统非常重要的规则。

如果：

```text
sampleCount < minimumSampleCount
```

不能假装价格准确。

应该：

```text
价格参考有限

¥150–250

目前只有 4 条有效价格样本，
建议将本结果作为粗略参考。
```

---

# 24. 禁止 AI 直接生成价格

以下行为禁止：

```text
用户输入
 ↓
发送给 GPT
 ↓
GPT：“我认为应该是 180 元”
```

这是不可接受的。

正确方式：

```text
用户输入
 ↓
结构化 answers
 ↓
Pricing Engine
 ↓
PriceResult
```

AI 只能辅助：

```text
AI
 ↓
生成服务配置
 ↓
人工审核
 ↓
Git commit
 ↓
Pricing Engine
```

---

# 25. 服务配置示例

文件：

```text
data/services/home/lamp-install.json
```

示意：

```json
{
  "id": "home.lamp-install",
  "categoryId": "home-installation",
  "name": "吸顶灯安装",
  "slug": "lamp-install",
  "status": "active",

  "questions": [
    {
      "id": "lamp-type",
      "type": "single",
      "title": "灯具类型",
      "required": true,
      "options": [
        {
          "id": "ceiling",
          "label": "普通吸顶灯",
          "value": "ceiling"
        },
        {
          "id": "chandelier",
          "label": "吊灯",
          "value": "chandelier"
        }
      ]
    }
  ],

  "pricing": {
    "model": "composite",

    "basePrice": {
      "min": 100,
      "max": 130
    },

    "minimumPrice": 100
  }
}
```

注意：

以上价格仅为 Schema 示例。

MVP 正式数据必须来自经过记录的数据来源，不能直接把示例数字当作真实市场价格。

---

# 26. UI 架构

核心组件：

```text
QuestionRenderer
```

根据：

```typescript
question.type
```

自动渲染：

```text
single
→ RadioGroup

multiple
→ CheckboxGroup

number
→ NumberInput

boolean
→ Switch / Radio

select
→ Select

area
→ AreaInput

distance
→ DistanceInput
```

---

# 27. Question Engine

Question Engine 负责：

1. 当前问题是否应该显示。
2. 用户答案是否合法。
3. 是否完成当前服务所需问题。
4. 是否进入下一题。

核心函数：

```typescript
isQuestionVisible(
  question,
  answers
): boolean
```

以及：

```typescript
validateAnswer(
  question,
  answer
): ValidationResult
```

---

# 28. Pricing Engine

Pricing Engine 负责：

```text
基础价格
↓
选项价格
↓
数量
↓
面积
↓
距离
↓
地区
↓
最低价格
↓
结果标准化
```

最终输出：

```typescript
PriceResult
```

---

# 29. 数据验证

必须提供：

```bash
pnpm validate:data
```

执行：

```text
检查所有 JSON
 ↓
Schema 校验
 ↓
Service ID 唯一性
 ↓
Question ID 唯一性
 ↓
引用是否存在
 ↓
Category 是否存在
 ↓
Region 是否存在
 ↓
PriceRule 是否合法
```

如果失败：

```text
exit code 1
```

禁止部署。

---

# 30. 测试策略

## 单元测试

重点测试：

### Question Engine

- 条件显示
- 条件隐藏
- 多选
- 必填
- 数值校验

### Pricing Engine

- 基础价格
- 附加价格
- 地区系数
- 数量
- 面积
- 距离
- 最低价
- 多条件组合

---

# 31. 必须测试的核心案例

例如：

```text
服务：
吸顶灯安装

答案：
普通吸顶灯
2 个
北京
不拆旧灯
```

结果：

```text
必须稳定得到相同结果。
```

再测试：

```text
普通吸顶灯
2 个
上海
不拆旧灯
```

结果应该发生合理变化。

---

# 32. E2E 测试

至少测试：

```text
打开首页
 ↓
点击服务
 ↓
完成问答
 ↓
选择城市
 ↓
看到价格
```

以及：

```text
直接访问分享 URL
 ↓
恢复答案
 ↓
显示相同报价
```

---

# 33. URL 设计

首页：

```text
/
```

分类：

```text
/categories/home-installation
```

服务：

```text
/services/lamp-install
```

报价：

```text
/estimate/lamp-install
```

分享结果：

```text
/estimate/lamp-install?city=beijing&type=ceiling&quantity=2
```

---

# 34. SEO

虽然 MVP 不是以 SEO 为第一目标，但架构必须支持。

每个服务拥有：

```text
Title
Description
```

例如：

```text
北京吸顶灯安装多少钱？2026价格参考｜PriceRight
```

后续可以自动生成：

```text
北京吸顶灯安装价格
上海吸顶灯安装价格
成都吸顶灯安装价格
```

但必须保证页面有真实数据。

不能为了 SEO 批量生成没有价格依据的城市页面。

---

# 35. 性能要求

MVP：

- 首屏快速加载
- 手机端优先
- 不依赖大型 JS 库
- 不加载不必要的第三方 SDK
- 服务数据按需加载

如果服务数据量变大：

```text
静态索引
+
按服务动态加载
```

避免把所有服务数据一次性发送给用户。

---

# 36. 隐私

MVP 不需要用户账号。

原则：

> 能不收集用户个人信息，就不收集。

第一版不收集：

- 手机号
- 姓名
- 精确地址
- 身份证
- 联系方式

用户填写的价格条件只保存在浏览器或 URL 中。

如果未来允许用户提交实际成交价格：

必须重新设计：

- 隐私政策
- 数据脱敏
- 数据审核
- 用户授权

---

# 37. 安全

MVP 虽然没有后端，但仍需要：

- 对 URL 参数进行严格校验
- 对 JSON 数据进行 Schema 校验
- 防止恶意构造参数导致前端异常
- 不执行用户输入内容
- 不使用 `eval`
- 不把用户输入直接作为 HTML 注入

---

# 38. 开源规范

代码：

```text
MIT
```

数据：

```text
ODbL 1.0
```

仓库必须包含：

```text
LICENSE
LICENSE-DATA
```

---

# 39. GitHub Issue 标签

推荐：

```text
feature
bug
data
pricing
ui
question-engine
pricing-engine
documentation
good-first-issue
help-wanted
```

---

# 40. Commit 规范

建议：

```text
feat:
fix:
data:
refactor:
test:
docs:
chore:
```

例如：

```text
feat: add dynamic question renderer
data: add Beijing lamp installation samples
fix: correct region fallback
test: add pricing engine cases
```

---

# 41. 第一阶段开发顺序

不要同时开发所有功能。

必须按照下面顺序执行。

---

## Phase 1：项目初始化

任务：

- 创建 Next.js 项目
- TypeScript
- Tailwind
- ESLint
- Vitest
- Playwright
- Git 初始化
- README
- LICENSE

验收：

```bash
pnpm dev
pnpm test
pnpm lint
```

全部通过。

---

# Phase 2：数据 Schema

实现：

```text
Category
Service
Question
QuestionOption
Condition
PricingConfig
Region
PriceSample
```

加入 Zod Schema。

实现：

```bash
pnpm validate:data
```

---

# Phase 3：Question Engine

实现：

```text
single
multiple
number
boolean
select
area
distance
```

实现条件显示。

完成单元测试。

---

# Phase 4：Pricing Engine

实现：

```text
base price
modifier
quantity
area
distance
region
minimum price
```

实现：

```typescript
calculatePrice()
```

必须纯函数。

完成单元测试。

---

# Phase 5：第一个完整服务

只实现：

> 吸顶灯安装

完整跑通：

```text
首页
 ↓
服务
 ↓
问题
 ↓
城市
 ↓
价格
 ↓
价格构成
```

不要在此阶段同时开发 8 个服务。

---

# Phase 6：复制服务配置

使用相同引擎增加：

1. 窗帘安装
2. 家具组装
3. 日常保洁
4. 小型搬家
5. 汽车洗车
6. 裤脚修改
7. 水龙头更换

如果增加这些服务必须修改核心引擎代码：

> 停下来重新设计。

理想状态：

```text
新增服务
=
新增 JSON
+
新增价格数据
```

---

# Phase 7：结果页

完善：

- 价格区间
- 典型价格
- 价格构成
- 数据样本数量
- 数据更新时间
- 可信度
- 服务包含范围
- 不包含范围
- 特殊情况
- 数据来源说明

---

# Phase 8：分享

实现：

```text
答案
 ↓
URL Query
 ↓
重新打开
 ↓
恢复答案
 ↓
重新计算
```

不要保存服务器 Session。

---

# Phase 9：SEO

实现：

- Service metadata
- Category metadata
- sitemap
- robots
- Open Graph

---

# Phase 10：GitHub 开源

README 必须说明：

```text
项目是什么
为什么做
如何运行
如何增加服务
如何增加价格数据
如何贡献
价格计算方法
数据来源规则
许可证
```

---

# 42. 第一版 GitHub Issues

建议直接建立以下 Issue：

```text
#1 初始化 Next.js 项目
#2 配置 TypeScript / ESLint / Tailwind
#3 配置 Vitest
#4 配置 Playwright
#5 建立数据目录结构
#6 建立 Zod Schema
#7 实现数据校验脚本
#8 实现 Question Engine
#9 实现条件问题
#10 实现 Pricing Engine
#11 实现地区匹配
#12 实现价格可信度
#13 创建首页
#14 创建分类页面
#15 创建服务页面
#16 创建问答页面
#17 创建报价结果页面
#18 创建吸顶灯安装服务
#19 创建窗帘安装服务
#20 创建家具组装服务
#21 创建日常保洁服务
#22 创建小型搬家服务
#23 创建汽车洗车服务
#24 创建裤脚修改服务
#25 创建水龙头更换服务
#26 实现报价分享 URL
#27 增加 SEO
#28 增加 E2E 测试
#29 完善 README
#30 发布 MVP
```

---

# 43. Codex 开发约束

如果由 AI Coding Agent 开发，必须遵守：

### 约束 1

不要为了未来需求提前引入：

- 数据库
- Redis
- 消息队列
- 微服务
- Docker 编排
- 用户系统

---

### 约束 2

不要把服务逻辑硬编码在 React Component。

错误：

```typescript
if (service === "lamp") {
  ...
}
```

正确：

```typescript
service.questions
service.pricing
```

---

### 约束 3

不要把价格硬编码在页面。

错误：

```typescript
const price = 180
```

正确：

```typescript
const result = calculatePrice(...)
```

---

### 约束 4

不要让 LLM 参与最终价格计算。

---

### 约束 5

新增服务原则：

```text
新增 JSON
+
新增数据
+
测试
```

而不是：

```text
修改 React
+
修改 Pricing Engine
+
修改页面
```

---

### 约束 6

所有价格相关逻辑必须有测试。

---

# 44. Definition of Done

一个功能只有同时满足以下条件才算完成：

- TypeScript 无错误
- ESLint 无错误
- 单元测试通过
- E2E 测试通过
- 手机端可用
- 无明显 UI 错误
- 无硬编码业务逻辑
- 数据通过 Schema 校验
- README 已更新
- Git commit 清晰

---

# 45. MVP 最终架构

```text
                 ┌──────────────────┐
                 │     Consumer     │
                 │      Mobile      │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │    Next.js H5    │
                 └────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
      ┌───────────────┐      ┌────────────────┐
      │Question Engine│      │ Pricing Engine  │
      └───────┬───────┘      └────────┬───────┘
              │                       │
              └───────────┬───────────┘
                          ▼
                 ┌──────────────────┐
                 │   Open Data      │
                 │                  │
                 │ Services         │
                 │ Questions        │
                 │ Price Rules      │
                 │ Regions          │
                 │ Price Samples    │
                 └────────┬─────────┘
                          │
                          ▼
                    ┌────────────┐
                    │   GitHub   │
                    │ Open Source │
                    └────────────┘
```

---

# 46. 未来架构演进

当项目开始产生真实用户数据以后：

```text
                    Consumer
                       │
                       ▼
                 PriceRight H5
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
       Pricing Engine       User Data
              │                 │
              ▼                 ▼
       Open Price DB      Transaction DB
              │
              ▼
        Service Provider
              │
              ▼
        Order Platform
```

也就是说：

> **报价引擎是第一阶段的产品核心，交易平台是未来可能出现的商业化层。**

不要反过来。

---

# 47. 最终技术原则

PriceRight 最核心的技术原则只有一句话：

> **让“新增一个线下服务”变成增加一份数据，而不是增加一套代码。**

最终理想状态：

```text
service.json
      +
price data
      +
region data
      ↓
PriceRight Engine
      ↓
消费者得到可解释的价格
```

这才是整个项目真正的技术基础。

---

# 48. MVP 完成后的下一步

MVP 发布后不要立即开发更多功能。

首先观察：

1. 有多少人访问？
2. 用户最常查询什么服务？
3. 哪个服务完成率最高？
4. 用户在哪一步退出？
5. 用户是否分享报价？
6. 用户是否再次访问？
7. 用户是否主动提交实际成交价格？
8. 用户是否认为价格结果有帮助？

如果用户开始主动问：

> “这个师傅报价 380 元，你帮我看看合理吗？”

那么说明产品已经出现了非常重要的第二阶段需求：

> **从“查询合理价格”升级为“审核具体报价”。**

届时可以增加：

```text
上传报价单
        ↓
识别服务项目
        ↓
提取报价
        ↓
匹配 PriceRight 标准服务
        ↓
计算合理价格区间
        ↓
告诉用户
“这个报价比我们的参考区间高 32%”
```

这可能成为 PriceRight 最有价值的下一阶段产品。
