import { SSEMessage, EventType, StreamProgress } from './types';

export interface AIServiceOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: StreamProgress) => void;
}

export interface StreamChatOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  }>;
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface StreamResponse {
  stream: AsyncGenerator<SSEMessage, void, unknown>;
  progress: StreamProgress;
  cancel: () => void;
}

export class AIService {
  private controller: AbortController | null = null;
  private isStreaming = false;
  private currentProgress: StreamProgress = {
    totalChunks: 0,
    receivedChunks: 0
  };
  private streamStartTime = 0;

  constructor(private options: AIServiceOptions) {}

  /**
   * 使用fetch进行流式聊天
   */
  async streamChat(options: StreamChatOptions): Promise<StreamResponse> {
    if (this.isStreaming) {
      throw new Error('Already streaming');
    }

    this.isStreaming = true;
    this.streamStartTime = Date.now();
    this.currentProgress = {
      totalChunks: 0,
      receivedChunks: 0
    };
    
    const { endpoint, headers = {}, timeout = 30000 } = this.options;
    
    this.controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      this.isStreaming = false;
      this.options.onClose?.();
    };

    try {
      // 设置超时
      timeoutId = setTimeout(() => {
        this.controller?.abort();
        this.options.onError?.(new Error('Request timeout'));
      }, timeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...headers
        },
        body: JSON.stringify({
          messages: options.messages,
          model: options.model,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true,
          system_prompt: options.systemPrompt,
          tools: options.tools,
          tool_choice: options.toolChoice
        }),
        signal: this.controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      this.options.onOpen?.();

      const streamGenerator = this.createStreamGenerator(response);
      
      return {
        stream: streamGenerator,
        progress: this.currentProgress,
        cancel: () => this.cancel()
      };

    } catch (error) {
      cleanup();
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(errorObj);
      throw errorObj;
    }
  }

  /**
   * 创建流式生成器
   */
  private async *createStreamGenerator(response: Response): AsyncGenerator<SSEMessage, void, unknown> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const sseMessage = this.parseSSELine(line);
                if (sseMessage) {
                  this.updateProgress();
                  yield sseMessage;
                }
              }
            }
          }
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // 保留最后不完整的行
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          const sseMessage = this.parseSSELine(line);
          if (sseMessage) {
            this.updateProgress();
            yield sseMessage;
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.isStreaming = false;
      this.options.onClose?.();
    }
  }

  /**
   * 更新进度信息
   */
  private updateProgress(): void {
    this.currentProgress.receivedChunks++;
    this.currentProgress.totalChunks = Math.max(
      this.currentProgress.totalChunks,
      this.currentProgress.receivedChunks
    );
    
    const elapsed = Date.now() - this.streamStartTime;
    if (this.currentProgress.receivedChunks > 1) {
      this.currentProgress.speed = this.currentProgress.receivedChunks / (elapsed / 1000);
      if (this.currentProgress.speed > 0) {
        this.currentProgress.estimatedTimeRemaining = 
          (this.currentProgress.totalChunks - this.currentProgress.receivedChunks) / this.currentProgress.speed * 1000;
      }
    }
    
    this.options.onProgress?.(this.currentProgress);
  }

  /**
   * 解析SSE行
   */
  private parseSSELine(line: string): SSEMessage | null {
    try {
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) return null;
        
        const data = JSON.parse(jsonStr);
        
        // 标准化数据格式
        const eventType = this.normalizeEventType(data.eventType || data.type || 'TEXT');
        
        return {
          eventType,
          eventSn: data.eventSn || data.sn || 0,
          content: {
            text: data.content?.text || data.text || data.content || '',
            ...(data.content || {})
          },
          metadata: data.metadata || data.meta || {}
        };
      }
      return null;
    } catch (error) {
      console.error('Parse SSE line error:', error, 'Line:', line);
      
      // 返回错误消息
      return {
        eventType: 'ERROR',
        eventSn: 0,
        content: {
          text: `Data parsing error: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }

  /**
   * 标准化事件类型
   */
  private normalizeEventType(eventType: string): EventType {
    const upperType = eventType.toUpperCase();
    const validTypes: EventType[] = [
      'START', 'TOOL_START', 'TOOL', 'TOOL_END', 'THINK_START', 'THINK',
      'THINK_END', 'ECHARTS_START', 'ECHARTS', 'ECHARTS_END',
      'INTENTION_RECOGNIZE', 'RETRIEVE', 'TEXT', 'END', 'ERROR'
    ];
    
    return validTypes.includes(upperType as EventType) 
      ? upperType as EventType 
      : 'TEXT';
  }

  /**
   * 停止流式响应
   */
  cancel(): void {
    if (this.controller && !this.controller.signal.aborted) {
      this.controller.abort('User cancelled');
    }
    this.isStreaming = false;
    this.options.onClose?.();
  }

  /**
   * 检查是否正在流式传输
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * 获取当前进度
   */
  getProgress(): StreamProgress {
    return { ...this.currentProgress };
  }

  /**
   * 重置服务状态
   */
  reset(): void {
    this.cancel();
    this.currentProgress = {
      totalChunks: 0,
      receivedChunks: 0
    };
  }

  /**
   * 创建模拟SSE流（用于开发测试）
   */
  static createMockStream(messages: SSEMessage[], delay: number = 100): AsyncGenerator<SSEMessage> {
    return (async function* () {
      for (const message of messages) {
        await new Promise(resolve => setTimeout(resolve, delay));
        yield message;
      }
    })();
  }

  /**
   * 创建模拟测试消息
   */
  static createTestMessages(): SSEMessage[] {
    return [
      {
        eventType: 'START',
        eventSn: 0,
        content: { text: '正在进行智能体分析...' }
      },
      {
        eventType: 'THINK_START',
        eventSn: 0,
        content: { text: '<think>' }
      },
      {
        eventType: 'THINK',
        eventSn: 0,
        content: { text: '\n好的，' }
      },
      {
        eventType: 'THINK',
        eventSn: 0,
        content: { text: '用户想要了解状态机的工作原理。' }
      },
      {
        eventType: 'THINK_END',
        eventSn: 0,
        content: { text: '</think>' }
      },
      {
        eventType: 'TOOL_START',
        eventSn: 0,
        content: { text: '' },
        metadata: { 
          toolName: 'search_database',
          toolParams: { query: 'state machine implementation' }
        }
      },
      {
        eventType: 'TOOL',
        eventSn: 0,
        content: { text: '正在搜索数据库...' }
      },
      {
        eventType: 'TOOL_END',
        eventSn: 0,
        content: { text: '' },
        metadata: { 
          toolResult: { 
            found: true,
            data: '状态机是一种数学模型，用于描述系统状态和状态之间的转换。'
          }
        }
      },
      {
        eventType: 'TEXT',
        eventSn: 0,
        content: { text: '状态机是一种非常重要的编程模式。' }
      },
      {
        eventType: 'TEXT',
        eventSn: 0,
        content: { text: '它可以帮助我们管理复杂的应用状态。' }
      },
      {
        eventType: 'END',
        eventSn: 0,
        content: { text: '以上就是关于状态机的介绍。' },
        metadata: {
          duration: 5000,
          messageId: 'test-123',
          promptTokens: 150,
          totalTokens: 300,
          completionTokens: 150
        }
      }
    ];
  }
}

/**
 * 创建AIService实例的工厂函数
 */
export function createAIService(options: Partial<AIServiceOptions> = {}): AIService {
  const defaultOptions: AIServiceOptions = {
    endpoint: '/api/chat/stream',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000
  };

  return new AIService({
    ...defaultOptions,
    ...options
  });
}

/**
 * 重试机制包装器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number } = { retries: 3, delay: 1000 }
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < options.retries - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delay * (i + 1)));
        continue;
      }
    }
  }
  
  throw lastError!;
}