import { ModelConfig, ChatMessage, ModelType, AdaptedResponse, StreamChunk, StreamGenerator } from '../types';
import { BaseModelService } from '../services/model-service';
import { RequestAdapterFactory } from '../adapters/request-adapter';
import { ResponseAdapterFactory } from '../adapters/response-adapter';

/**
 * 自定义API实现类
 */
export class CustomApiImplementation extends BaseModelService {
  private requestAdapter: any;
  private responseAdapter: any;
  private mockMode: boolean = false;
  private mockResponses = [
    "您好！我是AI助手，很高兴为您提供帮助。请问有什么我可以协助您的吗？",
    "这是一个很好的问题。让我为您详细解答...",
    "根据您的需求，我建议您可以考虑以下几个方案：\n1. 首先...\n2. 其次...\n3. 最后...",
    "非常感谢您的提问！这个问题涉及到多个方面，让我逐一为您分析：",
    "我理解您的困惑。让我用简单的方式为您解释这个概念...",
    "您的想法很有创意！让我们进一步探讨这个可能性...",
    "为了更好地帮助您，我需要了解一些额外信息...",
    "基于当前的情况，我的建议是...",
    "这是一个复杂的问题，让我为您提供一些参考信息...",
    "我很高兴能帮助您解决这个问题。祝您工作顺利！"
  ];

  constructor(config: ModelConfig = {}) {
    // 默认配置
    const defaultConfig: ModelConfig = {
      modelName: 'custom-model',
      baseUrl: '/api/ai/chat',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      mockMode: false,
      mockDelay: 50,
      ...config
    };
    super(ModelType.CUSTOM, defaultConfig);
    
    // 初始化适配器
    this.requestAdapter = RequestAdapterFactory.createAdapter(ModelType.CUSTOM);
    this.responseAdapter = ResponseAdapterFactory.createAdapter(ModelType.CUSTOM);
    this.mockMode = defaultConfig.mockMode || !defaultConfig.baseUrl;
  }

  /**
   * 发送非流式请求
   * @param messages 对话消息列表
   * @returns Promise<AdaptedResponse> 适配后的响应
   */
  
  /**
   * 实现基类要求的streamRequest方法
   * @param messages 对话消息列表
   * @param callbacks 流式回调函数
   */
  async streamRequest(messages: ChatMessage[], callbacks?: any): Promise<void> {
    try {
      const generator = this.createStreamGenerator(messages);
      let eventSn = 0;
      
      for await (const chunk of generator) {
        if (callbacks?.onChunk) {
          callbacks.onChunk(chunk);
        }
        eventSn++;
      }
      
      if (callbacks?.onComplete) {
        callbacks.onComplete();
      }
    } catch (error) {
      if (callbacks?.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      // 确保资源清理
      this.setProcessing(false);
    }
  }
  public async request(messages: ChatMessage[]): Promise<AdaptedResponse> {
    try {
      this.setProcessing(true);
      
      // 如果是模拟模式，返回模拟响应
      if (this.mockMode) {
        return this.generateMockResponse();
      }
      
      const controller = this.createAbortController();
      const requestOptions = this.prepareRequestOptions();
      const requestBody = this.requestAdapter.adaptRequest(messages, this.config);
      
      // 添加超时处理
      const timeoutPromise = new Promise<AdaptedResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, this.config.timeout || 30000);
      });
      
      const fetchPromise = fetch(this.config.baseUrl || '/api/ai/chat', {
        ...requestOptions,
        body: JSON.stringify(requestBody)
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawResponse = await response.json();
        return this.responseAdapter.adaptResponse(rawResponse);
      });
      
      // 使用Promise.race处理超时
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('Custom API request error:', error);
      return this.createErrorResponse(error as Error);
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * 创建流式数据生成器（使用async generator）
   * @param messages 对话消息列表
   * @returns StreamGenerator 异步生成器
   */
  public async *createStreamGenerator(messages: ChatMessage[]): StreamGenerator {
    try {
      this.setProcessing(true);
      
      // 如果是模拟模式，使用模拟数据生成器
      if (this.mockMode) {
        yield* this.generateMockStream();
        return;
      }
      
      const controller = this.createAbortController();
      const requestOptions = this.prepareRequestOptions();
      const requestBody = this.requestAdapter.adaptRequest(messages, {
        ...this.config,
        customParams: {
          ...this.config.customParams,
          stream: true // 确保启用流式请求
        }
      });
      
      const response = await fetch(this.config.baseUrl || '/api/ai/chat', {
        ...requestOptions,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream');
      }
      
      const decoder = new TextDecoder();
      let chunkIndex = 0;
      let buffer = '';
      
      // 开始读取流式响应
      while (true) {
        // 检查是否被取消
        if (controller.signal.aborted) {
          throw new Error('Stream aborted');
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解码并处理响应数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 处理SSE格式的消息
        const lines = buffer.split('\n\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            const adaptedChunk = this.responseAdapter.adaptStreamChunk(line, chunkIndex++);
            if (adaptedChunk) {
              yield adaptedChunk;
            }
          }
        }
        
        // 保留未处理的部分
        buffer = lines[lines.length - 1];
      }
      
      // 处理剩余的缓冲区内容
      if (buffer.trim()) {
        const adaptedChunk = this.responseAdapter.adaptStreamChunk(buffer, chunkIndex++);
        if (adaptedChunk) {
          yield adaptedChunk;
        }
      }
      
      // 发送结束事件
      yield {
        eventType: 'END',
        eventSn: chunkIndex,
        content: { text: '' },
        metadata: { completed: true }
      };
      
    } catch (error) {
      console.error('Custom API stream error:', error);
      
      // 发送错误事件
      yield {
        eventType: 'ERROR',
        eventSn: 0,
        content: { text: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
      
      throw error;
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * 生成模拟响应
   * @returns AdaptedResponse 模拟的响应
   */
  private generateMockResponse(): AdaptedResponse {
    const randomResponse = this.mockResponses[Math.floor(Math.random() * this.mockResponses.length)];
    
    return {
      role: 'assistant',
      content: randomResponse,
      status: 'success',
      timestamp: Date.now(),
      modelType: this.modelType,
      metadata: { mock: true }
    };
  }

  /**
   * 生成模拟的流式数据
   */
  private async *generateMockStream(): AsyncGenerator<StreamChunk> {
    const randomResponse = this.mockResponses[Math.floor(Math.random() * this.mockResponses.length)];
    const words = randomResponse.split('');
    const delay = this.config.mockDelay || 50;
    let eventSn = 0;
    
    // 发送开始事件
    yield {
      eventType: 'START',
      eventSn: eventSn++,
      content: { text: '' },
      metadata: { mock: true }
    };
    
    // 逐字符发送内容
    for (let i = 0; i < words.length; i++) {
      // 检查是否被取消
      if (this.abortController?.signal.aborted) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 20));
      
      yield {
        eventType: 'TEXT',
        eventSn: eventSn++,
        content: { text: words[i] },
        metadata: { 
          mock: true,
          progress: (i + 1) / words.length 
        }
      };
    }
    
    // 发送结束事件
    yield {
      eventType: 'END',
      eventSn: eventSn++,
      content: { text: '' },
      metadata: { 
        mock: true,
        completed: true 
      }
    };
  }

  /**
   * 启用/禁用模拟模式
   * @param enable 是否启用
   */
  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  /**
   * 检查是否处于模拟模式
   */
  public isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * 设置模拟回复列表
   */
  public setMockResponses(responses: string[]): void {
    this.mockResponses = responses;
  }

  /**
   * 创建错误响应
   * @param error 错误对象
   * @returns AdaptedResponse 错误响应
   */
  protected override createErrorResponse(error: Error): AdaptedResponse {
    return {
      role: 'assistant',
      content: `Error: ${error.message}`,
      status: 'error',
      timestamp: Date.now(),
      modelType: this.modelType,
      metadata: { 
        error: error.message, 
        code: error.name,
        mock: this.mockMode 
      }
    };
  }
}
