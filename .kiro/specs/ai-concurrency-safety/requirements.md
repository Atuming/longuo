# 需求文档

## 简介

本文档定义火龙果编辑器（Pitaya Editor）AI 辅助写作调用层的并发安全机制需求。当前 AI 调用层存在以下并发问题：

1. `generate()` 方法内部的 `AbortController` 仅用于超时控制，未暴露给调用方，用户快速连续触发请求时旧请求无法取消，旧结果可能覆盖新结果。
2. UI 层缺少加载状态锁，用户可多次点击触发并行 AI 请求。
3. 两个流式请求同时运行时，`onChunk` 回调会交错执行，导致内容混乱。

本需求旨在引入请求取消、重复提交防护和流式响应竞态保护三项机制，确保 AI 调用在并发场景下行为正确。

## 术语表

- **AI_引擎（AI_Engine）**: `createAIAssistantEngine` 创建的 AI 辅助写作引擎实例，负责上下文打包、Prompt 构建和 API 调用（对应 `src/lib/ai-assistant-engine.ts`）
- **AI_面板（AI_Panel）**: AI 辅助写作的 UI 面板组件 `AIAssistantPanel`（对应 `src/components/ai/AIAssistantPanel.tsx`）
- **生成请求（Generate_Request）**: 调用 `AI_Engine.generate()` 发起的一次 AI 内容生成请求
- **请求标识（Request_ID）**: 每次生成请求的唯一标识符，用于区分不同请求
- **AbortController**: 浏览器原生 API，用于取消进行中的 fetch 请求
- **流式响应（Streaming_Response）**: AI API 以 Server-Sent Events（SSE）格式逐块返回内容的响应模式
- **onChunk 回调**: `generate()` 方法的可选参数，用于接收流式响应的每个内容片段
- **竞态条件（Race_Condition）**: 多个异步操作并发执行时，因执行顺序不确定导致的结果不一致问题
- **加载状态锁（Loading_Lock）**: UI 层通过 `isGenerating` 状态阻止用户重复提交的机制

## 需求

### 需求 1：请求取消机制

**用户故事：** 作为用户，我希望发起新的 AI 生成请求时自动取消上一个未完成的请求，以便始终获得最新请求的结果而非被旧结果覆盖。

#### 验收标准

1. WHEN 调用方调用 `generate()` 发起新的生成请求时，THE AI_引擎 SHALL 自动取消上一个仍在进行中的生成请求
2. WHEN 一个生成请求被取消时，THE AI_引擎 SHALL 通过 AbortController 中止对应的 fetch 请求，释放网络资源
3. WHEN 一个生成请求被取消时，THE AI_引擎 SHALL 返回一个明确标识为"已取消"的结果（包含 `cancelled: true` 字段），而非返回错误
4. THE AI_引擎 SHALL 为每次 `generate()` 调用创建独立的 AbortController 实例，确保取消操作仅影响目标请求
5. WHEN 用户关闭 AI_面板时，THE AI_面板 SHALL 取消当前正在进行的生成请求
6. THE AI_引擎 SHALL 提供 `abort()` 方法，允许调用方主动取消当前正在进行的生成请求

### 需求 2：重复提交防护

**用户故事：** 作为用户，我希望在 AI 正在生成内容时无法重复点击生成按钮，以避免触发多个并行请求导致结果混乱。

#### 验收标准

1. WHILE AI_面板处于生成中状态（`isGenerating` 为 true），THE AI_面板 SHALL 禁用"生成"按钮，阻止用户点击
2. WHILE AI_面板处于生成中状态，THE AI_面板 SHALL 禁用所有写作技能按钮，阻止用户通过技能按钮触发新请求
3. WHEN 生成请求完成（成功或失败）时，THE AI_面板 SHALL 立即恢复"生成"按钮和写作技能按钮为可用状态
4. WHEN 生成请求被取消时，THE AI_面板 SHALL 立即恢复"生成"按钮和写作技能按钮为可用状态
5. THE AI_面板 SHALL 在生成中状态下显示"生成中..."文本替代"生成"按钮文本，向用户提供视觉反馈

### 需求 3：流式响应竞态保护

**用户故事：** 作为用户，我希望在快速切换写作技能或重新生成时，面板中显示的内容始终来自最新的请求，而非多个请求的混合内容。

#### 验收标准

1. THE AI_引擎 SHALL 为每次 `generate()` 调用分配唯一的请求标识
2. WHEN 流式响应的 onChunk 回调被调用时，THE AI_引擎 SHALL 验证该回调对应的请求标识与当前活跃请求标识一致，仅在一致时执行回调
3. WHEN 请求标识不一致时，THE AI_引擎 SHALL 静默丢弃该 onChunk 回调的内容，不执行任何副作用
4. WHEN 新的生成请求发起时，THE AI_面板 SHALL 清空上一次请求的结果显示区域，避免新旧内容拼接
5. IF 被取消的流式请求在取消后仍有数据到达，THEN THE AI_引擎 SHALL 忽略这些数据，不传递给 onChunk 回调

### 需求 4：取消操作的用户交互

**用户故事：** 作为用户，我希望在 AI 生成过程中能主动取消请求，以便在发现输入错误或不想等待时快速中止。

#### 验收标准

1. WHILE AI_面板处于生成中状态，THE AI_面板 SHALL 显示一个"取消"按钮
2. WHEN 用户点击"取消"按钮时，THE AI_面板 SHALL 调用 AI_引擎 的 `abort()` 方法取消当前请求
3. WHEN 用户点击"取消"按钮时，THE AI_面板 SHALL 将生成中状态设为 false，恢复界面为可交互状态
4. WHEN 取消操作执行后且已有部分流式内容到达时，THE AI_面板 SHALL 保留并显示已接收的部分内容
5. WHEN 取消操作执行后且无任何内容到达时，THE AI_面板 SHALL 显示"已取消生成"的提示信息
