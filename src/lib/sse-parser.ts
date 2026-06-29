/**
 * 共享的 SSE (Server-Sent Events) 流式响应解析器。
 * 从 `generate()` 和 `extractWorldEntries()` 中提取出来的公共逻辑。
 */

export interface SSEParseOptions {
  /** 底层 ReadableStream 的 reader */
  reader: ReadableStreamDefaultReader<Uint8Array>;
  /** 流式数据间隔超时（毫秒），超时后自动中断 */
  idleTimeoutMs?: number;
  /** AbortSignal 用于外部取消 */
  signal?: AbortSignal;
  /** 每个 chunk 的回调 */
  onChunk: (chunk: string) => void;
  /** 请求 ID，用于判断是否仍为活跃请求 */
  requestId: string;
  /** 获取当前活跃请求 ID 的函数（用于并发控制守卫） */
  getActiveRequestId: () => string | null;
  /** 设置流空闲超时回调（宿主负责 clearTimeout） */
  setIdleTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
}

export interface SSEParseResult {
  /** 是否成功 */
  success: boolean;
  /** 完整内容 */
  content: string;
  /** 是否被截断（流中断但收到部分内容） */
  truncated?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 解析 SSE 流式响应。
 * 期望格式：每行 `data: <json>`，`data: [DONE]` 表示结束。
 * JSON 中取 `choices[0].delta.content`。
 */
export async function parseSSEStream(opts: SSEParseOptions): Promise<SSEParseResult> {
  const {
    reader,
    idleTimeoutMs = 30000,
    signal,
    onChunk,
    requestId,
    getActiveRequestId,
    setIdleTimer,
  } = opts;

  const decoder = new TextDecoder();
  let fullContent = '';
  let streamIdleTimer: ReturnType<typeof setTimeout> | null = null;
  // Mutable ref so the timer callback can cancel the reader
  const readerRef = { current: reader };

  // onChunk 守卫：仅当请求仍为活跃请求时才传递 chunk
  const guardedOnChunk = (chunk: string) => {
    if (getActiveRequestId() === requestId) {
      onChunk(chunk);
    }
  };

  const resetStreamIdleTimer = () => {
    if (streamIdleTimer) clearTimeout(streamIdleTimer);
    streamIdleTimer = setTimeout(() => {
      // 空闲超时 → 取消 reader 来解除 reader.read() 的阻塞
      readerRef.current.cancel().catch(() => { /* noop */ });
      setIdleTimer(null);
    }, idleTimeoutMs);
    setIdleTimer(streamIdleTimer);
  };

  resetStreamIdleTimer();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetStreamIdleTimer();

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content ?? '';
            if (chunk) {
              fullContent += chunk;
              guardedOnChunk(chunk);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // 检查外部取消信号
      if (signal?.aborted) {
        if (streamIdleTimer) clearTimeout(streamIdleTimer);
        setIdleTimer(null);
        if (fullContent) {
          return { success: true, content: fullContent, truncated: true };
        }
        return { success: false, content: '', error: '请求已取消' };
      }
    }
  } catch {
    // 流式中断（reader.cancel() 也会触发此处），保留已接收内容
    if (streamIdleTimer) clearTimeout(streamIdleTimer);
    setIdleTimer(null);
    if (fullContent) {
      return { success: true, content: fullContent, truncated: true };
    }
    return { success: false, content: '', error: '流式响应中断，未接收到有效内容。' };
  }

  if (streamIdleTimer) clearTimeout(streamIdleTimer);
  setIdleTimer(null);

  if (!fullContent) {
    return { success: false, content: '', error: 'AI 未生成有效内容，请调整输入后重试。' };
  }

  return { success: true, content: fullContent };
}
