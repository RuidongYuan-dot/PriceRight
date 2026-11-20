# AGENTS.md

# PriceRight AI Coding Agent Guidelines

> 本文件是 PriceRight 项目对 Codex、Claude Code 及其他 AI Coding Agent 的最高优先级项目级开发规范。
>
> 在修改代码之前，必须先阅读本文件以及 `PRD.md`、`PriceRight 技术设计文档 TECHNICAL_DESIGN.md`。
>
> 技术设计文档在仓库根目录，文件名是 `PriceRight 技术设计文档 TECHNICAL_DESIGN.md`。早期文稿里的 `TECHNICAL_DESIGN.md` 就是这一份，不在 `docs/` 下。

---

# 1. 项目简介

PriceRight 是一个：

> **面向普通消费者的、完全开源的线下服务价格查询平台。**

核心目标：

> 用户在购买线下服务之前，通过回答几个简单的问题，获得指定地区、指定服务条件下的合理参考价格。

项目第一阶段：

- 面向普通消费者
- 综合所有线下服务
- 完全开源
- 不做服务商入驻
- 不做订单
- 不做支付
- 不做派单
- 不做平台交易
- 不做用户账号

MVP 的核心能力只有：

```text
服务选择
    ↓
动态问题
    ↓
用户回答
    ↓
地区选择
    ↓
确定性价格计算
    ↓
合理价格区间
    ↓
价格构成
    ↓
数据来源与可信度
```

---

# 2. 核心产品原则

## 2.1 消费者优先

PriceRight 的第一服务对象是：

> 普通消费者。

所有产品设计都应该首先回答：

> “消费者在购买线下服务之前，能不能更容易判断价格是否合理？”

不要优先考虑：

- 商家获客
- 商家营销
- 平台抽佣
- 服务商利益
- 广告收入

这些属于未来阶段。

---

# 3. 最重要的技术原则

## 3.1 配置驱动，而不是代码驱动

必须遵守：

> **新增一个服务，原则上应该只需要新增配置和数据，而不是修改核心业务代码。**

理想结构：

```text
service.json
    +
price data
    +
region data
    ↓
Question Engine
    +
Pricing Engine
    ↓
UI
```

禁止：

```typescript
if (service === "lamp") {
  // 灯具业务
}

if (service === "moving") {
  // 搬家业务
}
```

不要把具体服务业务逻辑硬编码到 React Component 或通用 Engine 中。

---

# 4. 服务必须是数据

一个服务应该由配置描述：

```text
Service
├── metadata
├── questions
├── conditions
├── pricing
├── scope
└── data metadata
```

而不是：

```text
LampInstallPage.tsx
MovingPage.tsx
CleaningPage.tsx
```

不允许为每个服务复制一套页面逻辑。

---

# 5. 价格计算是核心基础设施

Pricing Engine 是项目核心模块。

必须满足：

> **相同输入，永远得到相同输出。**

例如：

```text
service = lamp-install
city = Beijing
lampType = ceiling
quantity = 2
removeOld = false
```

无论：

- 第一次计算
- 第十次计算
- 今天计算
- 明天计算

只要价格数据没有变化：

> 结果必须一致。

---

# 6. 禁止 LLM 直接决定价格

这是项目的硬性规则。

禁止：

```text
用户输入
 ↓
调用 GPT
 ↓
GPT 判断
 ↓
“我认为价格应该是 180 元”
```

禁止任何：

```typescript
await llm.generatePrice(...)
```

或者：

```typescript
const price = await aiEstimate(...)
```

---

# 7. AI 的正确用途

AI 可以帮助：

- 生成服务配置草稿
- 生成问题列表
- 整理公开价格数据
- 辅助分类
- 检查配置
- 发现异常数据
- 生成测试用例
- 编写代码
- 编写文档
- 分析用户反馈

但是：

> **AI 生成的任何价格、规则和服务配置，都必须经过明确的数据审核流程后才能成为正式数据。**

---

# 8. 不允许编造价格

这是数据层面的最高优先级规则。

如果没有可靠价格数据：

> 不得为了让页面看起来完整而随意填写价格。

正确行为：

```text
数据不足

目前暂无足够的本地价格数据，
暂不能提供可靠参考价格。
```

而不是：

```text
北京吸顶灯安装：
¥150–200
```

如果这个价格没有可靠来源，就不能存在。

---

# 9. 示例数据必须明确标记

开发过程中允许使用测试数据。

但必须：

- 明确标记为 demo
- 与正式价格数据隔离
- 不得误显示为真实市场价格

例如：

```text
data/fixtures/
```

可以存在：

```json
{
  "price": {
    "min": 100,
    "max": 150
  }
}
```

但正式数据目录不能直接复制这些测试数字。

---

# 10. 参考价格 ≠ 成交价格

PriceRight MVP 提供的是：

> 合理参考价格

不是：

> 平台保证成交价格。

UI、文案、代码和文档不得混淆这两个概念。

推荐使用：

- 合理参考价格
- 参考价格区间
- 常见价格
- 市场参考

避免使用：

- 最终价格
- 保证价格
- 必须成交价格
- 标准收费价格

除非未来平台真正拥有交易和履约能力。

---

# 11. 不要过度工程化

MVP 阶段：

> 能简单解决的问题，不要复杂化。

禁止无必要引入：

- 微服务
- Redis
- Kafka
- RabbitMQ
- Kubernetes
- Docker Compose
- GraphQL
- CQRS
- Event Sourcing
- Service Mesh
- 多数据库
- 复杂状态管理框架

除非有明确的产品需求证明它们是必要的。

---

# 12. MVP 默认无后端

第一阶段优先采用：

```text
Next.js
+
TypeScript
+
静态数据
+
客户端/服务端确定性计算
```

不因为“以后可能需要”就提前建立：

```text
API Server
Database
Authentication
User Service
Order Service
Payment Service
```

未来真正需要时再增加。

---

# 13. 技术栈

默认技术栈：

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zod
- Vitest
- Playwright
- pnpm

如果确实需要引入新的依赖：

必须先判断：

1. 是否真的需要？
2. 原生代码能否解决？
3. 是否增加维护成本？
4. 是否与现有架构冲突？

没有必要不要增加依赖。

---

# 14. 修改代码之前必须做什么

任何非简单修改，在开始编码之前：

### 第一步

阅读：

```text
AGENTS.md
PRD.md
PriceRight 技术设计文档 TECHNICAL_DESIGN.md
```

### 第二步

检查当前项目结构。

### 第三步

搜索已有实现。

不要重复实现已经存在的功能。

### 第四步

确认修改是否符合现有架构。

---

# 15. 不要盲目重构

如果用户只要求：

> 增加一个服务

不要顺便：

- 重写 Pricing Engine
- 更换 UI 框架
- 更换状态管理
- 修改目录结构
- 重写整个数据模型

除非现有架构确实无法完成需求。

原则：

> **最小必要修改。**

---

# 16. 不要为了修一个问题制造另一个问题

修改之前必须考虑：

- 是否影响其他服务？
- 是否影响已有价格？
- 是否影响 URL？
- 是否影响 SEO？
- 是否影响测试？
- 是否破坏已有配置？

任何核心模块修改之后必须运行相关测试。

---

# 17. Question Engine 规则

Question Engine 必须是通用的。

它负责：

- 显示问题
- 隐藏问题
- 条件判断
- 答案验证
- 必填验证
- 下一步逻辑

不负责：

- 具体服务业务
- 页面布局
- 具体价格计算

---

# 18. Question 类型

MVP 支持：

```text
single
multiple
number
boolean
select
area
distance
```

未来可以扩展：

```text
image
address
date
time
dimension
```

增加新类型时：

1. 更新 TypeScript 类型
2. 更新 Schema
3. 更新 Question Renderer
4. 增加测试
5. 更新文档

不能只改 UI。

---

# 19. 条件问题

条件逻辑必须配置化。

例如：

```json
{
  "visibility": [
    {
      "questionId": "lamp-type",
      "operator": "equals",
      "value": "chandelier"
    }
  ]
}
```

不要在 React 中写：

```typescript
if (lampType === "chandelier") {
  showWeightQuestion()
}
```

---

# 20. Pricing Engine 规则

Pricing Engine 必须：

- 无副作用
- 可测试
- 可重复
- 可解释

推荐：

```typescript
calculatePrice(
  service,
  answers,
  region,
  priceData
)
```

返回：

```typescript
PriceResult
```

不得直接操作：

- DOM
- React State
- Browser Storage
- URL
- 网络请求

Pricing Engine 不应该知道 UI 的存在。

---

# 21. 价格构成必须可解释

如果最终结果：

```text
¥150–220
```

用户应该能够知道：

```text
基础人工
¥100–130

上门服务
¥30–50

拆除费用
¥20–40
```

因此价格计算不能只返回：

```typescript
{
  min: 150,
  max: 220
}
```

还必须返回 Breakdown。

---

# 22. 地区计算规则

地区优先级：

```text
城市级数据
↓
省级数据
↓
城市等级数据
↓
全国参考
```

禁止：

> 有北京数据，却强制套用一线城市平均价格。

必须优先使用更具体的数据。

---

# 23. 数据不足必须透明

如果数据不足：

必须显示：

```text
数据样本有限
```

或者：

```text
目前只有少量有效数据，
结果仅供粗略参考。
```

禁止隐藏：

- 样本数量
- 数据来源
- 更新时间
- 数据等级

---

# 24. 数据 Schema 是公共 API

即使项目目前没有后端 API：

> Service Schema、Price Sample Schema、Region Schema 都应该视为公共接口。

修改 Schema 时必须考虑：

- 已有数据
- 已有服务
- 社区贡献
- 向后兼容

不要随意修改字段含义。

---

# 25. 删除字段要谨慎

如果字段已经进入正式数据：

不要直接删除。

优先：

```text
deprecated
```

然后：

1. 更新所有使用方
2. 更新数据
3. 更新文档
4. 增加迁移逻辑
5. 最后删除

---

# 26. 数据文件格式

正式数据优先使用：

```text
JSON
```

要求：

- UTF-8
- 格式统一
- 缩进统一
- 不允许注释
- ID 唯一
- 字段符合 Schema

---

# 27. 数据来源要求

任何正式价格数据至少需要记录：

```text
serviceId
regionId
price
sampleType
source
collectedAt
verified
```

如果无法记录来源：

> 不应该进入高可信度数据。

---

# 28. 不允许公开隐私数据

如果未来引入真实成交价格：

不得公开：

- 姓名
- 手机号
- 地址
- 订单号
- 身份证
- 联系方式
- 可识别个人身份的信息

价格数据必须脱敏。

---

# 29. 第三方数据

不得因为项目开源，就随意复制：

- 商业数据库
- 第三方网站完整价格表
- 用户订单数据
- 未授权商家数据

必须确认数据的：

- 来源
- 使用许可
- 再发布权限

如果无法确认：

> 不要加入正式公开数据库。

---

# 30. 测试原则

任何核心业务逻辑必须有测试。

重点测试：

```text
Question Engine
Pricing Engine
Region Resolver
Data Validator
```

---

# 31. 修改 Pricing Engine 的最低要求

如果修改：

```text
lib/pricing/*
```

必须：

1. 添加或修改单元测试
2. 运行 Pricing Engine 测试
3. 运行全部测试
4. 检查已有服务结果

不得只运行：

```bash
pnpm dev
```

然后认为修改完成。

---

# 32. 修改 Question Engine 的最低要求

如果修改：

```text
lib/question-engine/*
```

必须测试：

- 条件显示
- 条件隐藏
- 必填
- 类型校验
- 多选
- 数字输入

---

# 33. E2E 测试

至少保证核心流程：

```text
首页
↓
选择分类
↓
选择服务
↓
回答问题
↓
选择城市
↓
查看价格
```

可以完整执行。

---

# 34. 每次开发完成后必须执行

至少执行：

```bash
pnpm lint
pnpm test
pnpm build
```

如果存在数据校验：

```bash
pnpm validate:data
```

如果存在 E2E：

```bash
pnpm test:e2e
```

---

# 35. 不允许带着错误提交

禁止在最终状态存在：

- TypeScript error
- ESLint error
- 测试失败
- Build failure
- Schema validation failure

除非用户明确要求暂时保留，并且必须在最终回复中明确说明。

---

# 36. 开发任务执行顺序

MVP 必须优先：

```text
1. 项目初始化
2. Schema
3. Data Validation
4. Question Engine
5. Pricing Engine
6. 第一个完整服务
7. UI
8. 其他服务
9. 分享
10. SEO
11. E2E
```

不要先做：

- 登录
- 数据库
- 支付
- 商家
- 订单
- AI 聊天
- 推荐系统

---

# 37. 第一项服务必须跑通完整闭环

第一项服务建议：

> 吸顶灯安装

必须完整实现：

```text
服务选择
↓
灯具类型
↓
数量
↓
拆除旧灯
↓
地区
↓
价格计算
↓
价格构成
↓
数据说明
```

在第一个服务没有跑通之前：

> 不要同时开发十几个服务。

---

# 38. 新增服务流程

以后新增服务时必须遵循：

```text
1. 创建 Service JSON
2. 创建 Questions
3. 创建 Conditions
4. 创建 Pricing Config
5. 创建 Price Samples
6. Schema Validation
7. Unit Test
8. E2E Test
9. 更新服务索引
10. 更新 README / 文档（必要时）
```

理想情况下：

> 不需要修改核心 React Component。

---

# 39. 新增服务的验收标准

新增服务后：

```bash
pnpm validate:data
pnpm test
pnpm build
```

全部通过。

然后手动检查：

- 手机端
- 问题流程
- 条件问题
- 价格结果
- 价格构成
- 地区
- 数据说明

---

# 40. Git Commit 规范

使用：

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
```

```text
feat: add lamp installation service
```

```text
data: add Beijing lamp installation samples
```

```text
fix: correct region fallback
```

```text
test: add pricing engine coverage
```

---

# 41. Commit 要小

不要：

```text
feat: build entire PriceRight MVP
```

应该拆成：

```text
feat: initialize project
feat: add service schema
feat: add question engine
feat: add pricing engine
feat: add lamp installation service
```

这样便于：

- Review
- 回滚
- Debug
- GitHub 协作

---

# 42. 不要修改用户没有要求的内容

如果用户要求：

> 增加窗帘安装

不要顺便：

- 修改首页设计
- 修改字体
- 修改颜色
- 修改价格模型
- 重构项目目录

除非必要。

---

# 43. UI 原则

PriceRight 是移动端优先。

优先考虑：

```text
手机
↓
平板
↓
桌面
```

而不是反过来。

核心操作应该适合：

- 单手操作
- 快速点击
- 大按钮
- 清晰选项
- 少输入

---

# 44. 用户不要被表单吓到

线下服务的真实问题可能非常复杂。

但是 UI 不应该一次展示几十个问题。

应该：

```text
一步一个问题
```

或者：

```text
一个页面 1～3 个相关问题
```

根据服务复杂度决定。

---

# 45. 不要让用户理解专业术语

错误：

> 电气线路预埋状态？

更好的表达：

> 现在安装位置有没有可以直接使用的电线？

如果必须使用专业术语：

> 普通消费者看得懂优先。

---

# 46. 价格结果必须是最重要的信息

结果页：

```text
合理参考价格

¥150–220
```

应该明显高于：

- 数据来源
- 服务描述
- 技术信息
- 免责声明

但不能夸大准确性。

---

# 47. 不要制造“虚假精确”

禁止：

```text
¥183.27
```

除非数据模型确实支持这种精度。

线下服务通常更适合：

```text
¥150–220
```

或者：

```text
常见价格 ¥180
参考范围 ¥150–220
```

---

# 48. 免责声明必须简洁

不要在结果页放一大段法律文字。

核心说明：

> PriceRight 提供市场参考价格，不代表最终成交价格。实际价格可能因服务条件、材料、现场情况等因素发生变化。

即可。

---

# 49. SEO 原则

SEO 页面必须有真实内容。

禁止为了 SEO 批量生成：

```text
北京吸顶灯价格
上海吸顶灯价格
广州吸顶灯价格
……
```

但所有页面都使用相同虚假价格。

如果没有足够数据：

> 页面应该明确显示数据建设中。

---

# 50. 分享 URL

分享结果必须可以：

```text
URL
↓
恢复 answers
↓
重新计算
↓
得到相同结果
```

不要依赖：

```text
服务器 Session
```

MVP 优先使用 URL 参数。

---

# 51. URL 参数必须校验

不要直接相信：

```text
?quantity=-999
```

或者：

```text
?city=<malicious-input>
```

所有 URL 参数必须经过 Schema 验证。

---

# 52. 浏览器端安全

禁止：

```typescript
eval()
```

禁止：

```typescript
dangerouslySetInnerHTML
```

除非有明确且经过审查的必要性。

用户输入不得直接作为 HTML 执行。

---

# 53. 错误处理

错误必须对用户友好。

不要显示：

```text
TypeError: Cannot read properties of undefined
```

用户应该看到：

> 暂时无法计算该服务价格，请稍后再试。

开发环境保留详细错误信息。

---

# 54. 日志

MVP 不需要复杂日志系统。

开发阶段可以使用：

```typescript
console.error()
```

但：

- 不打印隐私信息
- 不打印完整用户输入
- 不打印敏感数据

---

# 55. Accessibility

至少做到：

- 键盘可操作
- 表单有 label
- button 使用 button
- link 使用 link
- 颜色不能成为唯一信息来源
- focus 状态清晰

---

# 56. 国际化

MVP：

> 只支持简体中文。

不要提前实现完整 i18n 系统。

但代码中避免把大量不可维护的中文字符串散落在核心逻辑中。

---

# 57. 货币

MVP：

> 只支持人民币 CNY。

所有内部价格统一使用：

```text
CNY
```

金额不要使用浮点数进行复杂计算。

优先使用：

```text
整数“分”
```

或者明确的整数人民币计算。

---

# 58. 四舍五入

价格最终展示必须统一。

建议：

```text
内部计算
→
整数人民币
→
展示
```

避免出现：

```text
¥149.999999
```

---

# 59. 性能原则

不要为了一个简单服务加载全部服务数据。

随着服务数量增加：

```text
按需加载
```

优先于：

```text
一次加载整个数据库
```

---

# 60. 不要过早优化

MVP 阶段：

不要为了假设中的：

> “以后可能有 100 万用户”

提前设计复杂缓存架构。

先让：

> 100 个真实用户可以顺畅使用。

---

# 61. AI Coding 的工作方式

AI Agent 每次开始一个任务时：

### 1.

理解需求。

### 2.

阅读相关文档。

### 3.

检查现有代码。

### 4.

制定最小修改方案。

### 5.

实施。

### 6.

运行测试。

### 7.

检查 diff。

### 8.

总结修改。

---

# 62. 不要直接重写整个文件

如果只需要修改一个函数：

> 优先修改函数。

不要：

> 删除整个文件重新生成。

尤其是：

- Service Schema
- Pricing Engine
- Question Engine
- 配置文件

这些都是高价值代码。

---

# 63. 不要删除已有测试

如果测试失败：

> 修复代码。

不要：

> 删除测试。

除非测试本身已经不符合新需求，而且必须同时更新测试设计。

---

# 64. 测试不是为了让 CI 通过

不要为了让测试通过：

```typescript
expect(result).toBeTruthy()
```

这种测试价值很低。

核心价格测试应该验证：

```text
输入
→
具体输出
```

例如：

```typescript
expect(result.range.min).toBe(150)
expect(result.range.max).toBe(220)
```

---

# 65. Pricing Engine 测试必须覆盖边界条件

至少测试：

- 0
- 1
- 最大数量
- 最低价格
- 地区不存在
- 数据不足
- 多个附加项
- 互斥条件
- 空答案
- 非法答案

---

# 66. 数据验证必须严格

如果：

```text
serviceId 不存在
categoryId 不存在
questionId 重复
regionId 不存在
price < 0
min > max
```

必须阻止构建。

---

# 67. 不允许负价格

所有价格字段：

```text
>= 0
```

除非未来明确支持优惠/折扣机制。

MVP 暂时不支持负价格。

---

# 68. 不允许 min > max

所有价格区间必须：

```text
min <= max
```

这是硬性 Schema 规则。

---

# 69. 数据版本

正式价格数据应该可以追踪 Git 历史。

未来可以增加：

```text
dataVersion
```

但 MVP 可以直接依赖 Git commit。

---

# 70. 未来数据统计

未来可能增加：

```text
actualPrice
quotePrice
sampleCount
median
p25
p75
```

但 MVP 不需要复杂统计系统。

先建立可靠的数据结构。

---

# 71. 不要把未来商业模式写进 MVP

未来可能：

```text
消费者
↓
查询价格
↓
找师傅
↓
平台抽佣
```

但 MVP：

```text
消费者
↓
查询价格
```

仅此而已。

---

# 72. 不要主动增加登录

如果某功能可以通过：

```text
URL
LocalStorage
Cookie
```

简单完成：

> 不要为了它增加用户账号系统。

---

# 73. 不要主动增加广告

MVP 不放：

- 广告
- 商家推广
- 联盟链接
- 付费排名

首先验证：

> PriceRight 的价格信息本身有没有价值。

---

# 74. 不要主动增加聊天机器人

PriceRight 不是：

> “问 AI 什么服务多少钱？”

它是：

> **结构化、可解释、可复现的价格计算系统。**

如果未来增加 AI：

AI 应该成为辅助入口，而不是替代 Pricing Engine。

---

# 75. 产品核心护城河

代码完全开源。

因此：

> 代码不是壁垒。

真正值得积累：

```text
价格数据
+
服务标准
+
服务问题树
+
地区数据
+
真实成交数据
+
用户信任
```

开发过程中优先保护这些数据结构的质量。

---

# 76. 开发者体验

任何开发者 Clone 仓库之后：

```bash
pnpm install
pnpm dev
```

应该能够运行。

同时：

```bash
pnpm validate:data
pnpm lint
pnpm test
pnpm build
```

应该能够执行。

---

# 77. README 必须持续更新

如果发生以下变化：

- 安装方式变化
- 环境变量变化
- 数据格式变化
- 新增服务机制变化
- 开发命令变化

必须同步更新 README。

---

# 78. 环境变量

MVP 尽量：

> 0 个环境变量。

如果必须增加：

必须更新：

```text
README
.env.example
```

禁止把 Secret 写进 Git。

---

# 79. GitHub Actions

建议至少建立：

```text
CI
```

自动执行：

```text
install
↓
validate:data
↓
lint
↓
test
↓
build
```

任何一步失败：

> CI 失败。

---

# 80. Pull Request 原则

未来社区贡献服务时：

PR 必须包含：

```text
服务名称
服务分类
问题流程
价格数据来源
地区
数据时间
测试
```

不能只提交：

```text
“新增 XX 服务”
```

而没有价格依据。

---

# 81. 数据贡献优先于代码贡献

PriceRight 的特殊之处：

> 一个普通用户可能不会写代码，但可以贡献真实价格信息。

未来应该让：

```text
开发者
消费者
服务商
```

都能贡献数据。

---

# 82. 未来真实成交价格

如果未来加入：

> “我实际花了多少钱？”

必须区分：

```text
用户主动提交
```

与：

```text
平台验证成交
```

不能把未经验证的用户提交数据直接标记为高可信数据。

---

# 83. 价格异常检测

未来可以检测：

```text
同城市同服务：

¥100
¥110
¥120
¥115
¥900
```

¥900 可能是：

- 特殊情况
- 数据错误
- 高端服务
- 输入条件不同

不能简单删除。

应该进入：

> 异常数据审核。

---

# 84. 任何“智能”功能都必须可解释

如果未来增加：

- AI
- 推荐
- 异常检测
- 价格预测

必须尽量提供：

> 为什么得到这个结果？

PriceRight 的核心品牌是：

> **透明。**

不能变成一个“AI 黑箱报价器”。

---

# 85. 代码质量优先级

优先级：

```text
正确性
>
可维护性
>
可测试性
>
可读性
>
性能
>
代码数量
```

不要为了“代码看起来高级”增加复杂度。

---

# 86. 发生架构冲突时

优先级：

```text
PRD
>
TECHNICAL_DESIGN（仓库根目录：PriceRight 技术设计文档 TECHNICAL_DESIGN.md）
>
AGENTS
>
当前实现
```

如果当前代码与设计文档冲突：

> 不要默默绕过去。

应该判断：

1. 当前代码是否错误？
2. 设计是否需要更新？
3. 是否属于历史技术债？

必要时修改文档。

---

# 87. 任务完成后的最终回复

AI Agent 完成开发任务后，必须简洁说明：

```text
完成：

- xxx
- xxx
- xxx

测试：

- pnpm lint ✅
- pnpm test ✅
- pnpm build ✅
- pnpm validate:data ✅

未完成：

- xxx
```

不要只回复：

> Done.

---

# 88. 如果发现需求有问题

不要为了完成任务而硬写。

如果发现：

- 数据模型不合理
- 价格规则存在逻辑冲突
- PRD 与技术设计冲突
- 新需求破坏核心架构
- 数据来源不可信

应该先指出问题。

如果存在简单、安全的解决方案：

> 可以直接采用。

如果会改变产品方向：

> 必须明确说明。

---

# 89. 最重要的禁止事项

以下行为默认禁止：

```text
❌ 编造价格
❌ 让 LLM 直接决定价格
❌ 把业务逻辑硬编码进 UI
❌ 为每个服务复制页面
❌ 删除测试来解决失败
❌ 为 MVP 引入不必要的基础设施
❌ 擅自增加登录
❌ 擅自增加支付
❌ 擅自增加商家系统
❌ 擅自增加广告
❌ 擅自改变产品定位
❌ 暴露用户隐私
❌ 使用未经授权的第三方数据
❌ 让相同输入产生随机价格
❌ 生成虚假的数据可信度
```

---

# 90. 最重要的允许事项

以下行为应该积极鼓励：

```text
✅ 配置驱动
✅ 数据与代码分离
✅ 小步提交
✅ 自动化测试
✅ Schema 校验
✅ 数据来源记录
✅ 价格可解释
✅ Git 历史可追踪
✅ 开源文档完善
✅ 新服务无需修改核心代码
✅ 使用 AI 加速开发
```

---

# 91. 最终架构目标

PriceRight 最终应该做到：

```text
新增服务
    ↓
新增 Service JSON
    ↓
新增 Price Data
    ↓
Schema Validation
    ↓
自动生成服务页面
    ↓
自动进入报价系统
```

而不是：

```text
新增服务
    ↓
写 React 页面
    ↓
写业务逻辑
    ↓
写价格逻辑
    ↓
写新的 API
    ↓
写新的数据库表
    ↓
写新的测试
```

---

# 92. 最终判断标准

每次开发都问自己：

> **“如果明天要增加 100 个新的线下服务，我今天写的代码会不会让我痛苦？”**

如果答案是：

> 会。

那么应该优先改进抽象。

如果答案是：

> 不会，只需要增加配置和数据。

那么架构方向正确。

---

# 93. PriceRight 的核心理念

最终请始终记住：

> **PriceRight 不是一个“AI 告诉你服务多少钱”的网站。**

它是：

> **一个开放的、结构化的、可解释的线下服务价格知识库与计算引擎。**

AI 是开发工具。

价格规则是核心逻辑。

价格数据是核心资产。

消费者信任是最终价值。

---

# 94. MVP 第一阶段目标

不要追求“大”。

只需要做到：

```text
8 个真实服务
+
若干真实城市数据
+
稳定的 Question Engine
+
稳定的 Pricing Engine
+
清晰的价格结果
+
完全开源
+
任何开发者可以贡献新服务
```

然后：

> **上线，让真实消费者使用。**

真实用户反馈比继续增加 100 个“看起来很完整”的功能更有价值。
