# 实施计划：AI 并发安全机制（ai-concurrency-safety）

## 概述

按照设计文档，分步实施 AI 辅助写作调用层的并发安全机制：先扩展类型定义（AIGenerateResult、AIAssistantEngine），再改造引擎核心的并发控制逻辑（请求 ID 跟踪、AbortController 管理、onChunk 守卫），然后改造 UI 层的取消交互和状态管理，最后通过属性基测试和单元测试验证正确性。

## Tasks

- [x] 1. 扩展类型定义
  - [x] 1.1 为 AIGenerateResult 添加 cancelled 字段
    - 修改 `src/types/ai.ts`，在 `AIGenerateResult` 接口中新增 `cancelled?: boolean` 可选字段
    - _需求: 1.3_
  - [x] 1.2 为 AIAssistantEngine 接口添加 abort() 方法
    - 修改 `src/types/engines.ts`，在 `AIAssistantEngine` 接口中新增 `abort(): void` 方法签名
    - _需求: 1.6_

- [x] 2. 改造 ai-assistant-engine.ts 核心并发控制逻辑
  - [x] 2.1 引入并发控制闭包变量和 abort() 方法
    - 在 `src/lib/ai-assistant-engine.ts` 的 `createAIAssistantEngine` 工厂函数内部新增两个闭包变量：`activeRequestId: string | null` 和 `activeController: AbortController | null`
    - 实现 `abort()` 方法：若 `activeController` 存在则调用 `activeController.abort()` 并置空，同时将 `activeRequestId` 置空
    - _需求: 1.6_
  - [x] 2.2 改造 generate() 方法实现自动取消和请求 ID 跟踪
    - 在 `generate()` 入口处通过 `crypto.randomUUID()` 生成唯一 `requestId`
    - 若 `activeController` 存在，调用 `activeController.abort()` 取消旧请求
    - 创建新的 `AbortController`，将 `activeRequestId` 和 `activeController` 更新为当前请求
    - 将超时控制合并到同一个 controller，超时回调中校验 `activeRequestId === requestId` 后再 abort
    - 使用新 controller 的 `signal` 传递给 `fetch`
    - _需求: 1.1, 1.2, 1.4, 3.1_
  - [x] 2.3 实现 onChunk 守卫和取消结果区分
    - 在流式响应处理中，包装 `onChunk` 为 `guardedOnChunk`：仅当 `activeRequestId === requestId` 时执行原始 `onChunk`，否则静默丢弃
    - 在 catch 块中区分取消和超时：`AbortError` 触发时，若 `activeRequestId !== requestId` 则返回 `{ success: false, cancelled: true }`，否则返回超时错误
    - 请求正常完成后，若 `activeRequestId === requestId` 则清理闭包状态（置空）
    - _需求: 1.3, 3.2, 3.3, 3.5_
  - [x]* 2.4 编写属性基测试：自动取消与独立控制器（Property 1）
    - 新建 `src/lib/ai-assistant-engine.property.test.ts`
    - **Property 1: 自动取消与独立控制器**
    - 使用 fast-check 生成随机连续调用序列，验证第一次调用的 AbortController 在第二次调用开始时被 abort，且第二次调用使用全新的 AbortController 实例
    - **验证: 需求 1.1, 1.4**
  - [x]* 2.5 编写属性基测试：取消结果标识（Property 2）
    - **Property 2: 取消结果标识**
    - 验证被取消的 `generate()` 调用返回 `cancelled === true` 且 `success === false`，不包含错误类型的 `error` 消息
    - **验证: 需求 1.3**
  - [x]* 2.6 编写属性基测试：请求标识唯一性（Property 3）
    - **Property 3: 请求标识唯一性**
    - 使用 fast-check 生成 N 次（N ≥ 2）`generate()` 调用序列，验证每次分配的 requestId 互不相同
    - **验证: 需求 3.1**
  - [x]* 2.7 编写属性基测试：仅活跃请求的 onChunk 被传递（Property 4）
    - **Property 4: 仅活跃请求的 onChunk 被传递**
    - 模拟两个重叠的流式 `generate()` 调用，验证只有最后一次（活跃）请求的 onChunk 回调被执行，先前请求的 onChunk 数据被静默丢弃
    - **验证: 需求 3.2, 3.3, 3.5**

- [x] 3. 检查点 - 验证引擎层改造
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 4. 改造 AIAssistantPanel.tsx UI 层
  - [x] 4.1 实现取消按钮和面板关闭取消逻辑
    - 修改 `src/components/ai/AIAssistantPanel.tsx`
    - 新增 `handleCancel` 函数：调用 `aiEngine.abort()`，将 `isGenerating` 设为 false；若 `resultRef.current` 为空则设置 error 为"已取消生成"
    - 修改面板关闭逻辑（overlay 点击和关闭按钮）：若 `isGenerating` 为 true，先调用 `aiEngine.abort()` 再关闭
    - 改造生成按钮区域：`isGenerating` 为 true 时显示"取消"按钮（调用 `handleCancel`），否则显示"生成"按钮
    - _需求: 1.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.2 处理 cancelled 结果和新请求清空逻辑
    - 在 `handleGenerate` 中处理 `res.cancelled`：若为 true 则直接 return，不更新 UI 状态（由新请求接管）
    - 在 `handleGenerate` 开始时清空上一次结果（`setResult('')`、`resultRef.current = ''`），确保新旧内容不拼接
    - 确保生成中状态下"生成"按钮显示"生成中..."文本且禁用
    - 确保生成中状态下所有写作技能按钮禁用（已有 `disabled={isGenerating}`，验证覆盖完整）
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4_
  - [x]* 4.3 编写属性基测试：任意完成类型后按钮恢复（Property 5）
    - **Property 5: 任意完成类型后按钮恢复**
    - 模拟 `generate()` 的三种完成结果（成功、失败、取消），验证完成后 `isGenerating` 状态变为 false，生成按钮和写作技能按钮恢复可用
    - **验证: 需求 2.3, 2.4**
  - [x]* 4.4 编写属性基测试：取消时保留已接收的部分内容（Property 6）
    - **Property 6: 取消时保留已接收的部分内容**
    - 模拟流式 `generate()` 在接收到 K 个 chunk（K ≥ 1）后被取消，验证已接收的 K 个 chunk 拼接内容被保留并显示
    - **验证: 需求 4.4**
  - [x]* 4.5 编写 UI 单元测试
    - 扩展或新建 `src/components/ai/AIAssistantPanel.test.tsx`
    - 测试生成中状态下生成按钮显示"生成中..."（需求 2.5）
    - 测试生成中状态下显示取消按钮（需求 4.1）
    - 测试点击取消按钮调用 engine.abort()（需求 4.2）
    - 测试取消后无内容时显示"已取消生成"（需求 4.5）
    - 测试面板关闭时取消活跃请求（需求 1.5）
    - 测试新请求发起时清空结果区域（需求 3.4）
    - _需求: 1.5, 2.5, 3.4, 4.1, 4.2, 4.5_

- [x] 5. 最终检查点 - 全面验证
  - 运行所有测试确保通过，如有疑问请向用户确认。

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证，避免问题累积
- 属性基测试使用 fast-check（项目已安装 `fast-check@^4.6.0`），每个属性至少运行 100 次迭代
- 单元测试使用 Vitest 框架
