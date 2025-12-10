import { ModelConfig, ChatMessage, ModelType, AdaptedResponse, StreamChunk, StreamGenerator } from '../types';
import { BaseModelService } from '../services/model-service';
import { RequestAdapterFactory } from '../adapters/request-adapter';
import { ResponseAdapterFactory } from '../adapters/response-adapter';

/**
 * DeepSeek API实现类
 */
export class DeepseekImplementation extends BaseModelService {
  private requestAdapter: any;
  private responseAdapter: any;
  private mockMode: boolean = false;
  private mockResponses = [
    "感谢您的提问！我是DeepSeek AI，很高兴为您服务。",
    "基于您的问题，我为您准备了详细的解答：",
    "DeepSeek模型在处理复杂任务方面表现出色。让我为您分析一下：",
    "我理解您的需求。以下是我的建议和解决方案：",
    "这是一个很有意思的问题。根据我的知识，答案如下：",
    "为了更好地帮助您，我需要进一步了解一些细节：",
    "在实际应用中，这个问题通常有几种解决方案：\n• 方案一：...\n• 方案二：...\n• 方案三：...",
    "根据您提供的信息，我可以推断出以下结论：",
    "DeepSeek支持多种高级功能，如多轮对话、函数调用等。",
    "非常感谢您的耐心等待。希望我的回答能够解决您的问题。"
  ];

  constructor(config: ModelConfig = {}) {
    // DeepSeek默认配置
    const defaultConfig: ModelConfig = {
      modelName: 'deepseek-chat', // DeepSeek默认模型
      baseUrl: 'https://api.deepseek.com/v1/chat/completions', // DeepSeek API地址
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      mockMode: false,
      mockDelay: 50,
      apiKey: '',
      ...config
    };
    super(ModelType.DEEPSEEK, defaultConfig);
    
    // 初始化适配器
    this.requestAdapter = RequestAdapterFactory.createAdapter(ModelType.DEEPSEEK);
    this.responseAdapter = ResponseAdapterFactory.createAdapter(ModelType.DEEPSEEK);
    this.mockMode = defaultConfig.mockMode || !defaultConfig.apiKey;
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
      
      // 如果是模拟模式或没有API密钥，返回模拟响应
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
      
      const fetchPromise = fetch(this.config.baseUrl || 'https://api.deepseek.com/v1/chat/completions', {
        ...requestOptions,
        body: JSON.stringify(requestBody)
      }).then(async (response) => {
        if (!response.ok) {
          // DeepSeek的错误处理
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }
        
        const rawResponse = await response.json();
        return this.responseAdapter.adaptResponse(rawResponse);
      });
      
      // 使用Promise.race处理超时
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('DeepSeek API request error:', error);
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
      
      // 如果是模拟模式或没有API密钥，使用模拟数据生成器
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
      
      const response = await fetch(this.config.baseUrl || 'https://api.deepseek.com/v1/chat/completions', {
        ...requestOptions,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        // 处理DeepSeek的错误响应
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // 忽略JSON解析错误
        }
        throw new Error(errorMessage);
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
        
        // 处理DeepSeek的流式响应格式
        // DeepSeek使用SSE格式，每行以data: 开头
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line && line.startsWith('data: ')) {
            const data = line.substring(6); // 移除 'data: ' 前缀
            
            // 处理结束标记
            if (data === '[DONE]') {
              // 直接生成结束事件
              yield {
                eventType: 'END',
                eventSn: chunkIndex,
                content: { text: '' },
                metadata: { completed: true }
              };
              break;
            }
            
            try {
              // 预先解析JSON，然后将对象传递给适配器
              const parsedData = JSON.parse(data);
              const adaptedChunk = this.responseAdapter.adaptStreamChunk(parsedData, chunkIndex++);
              if (adaptedChunk) {
                yield adaptedChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse stream chunk:', parseError);
            }
          }
        }
        
        // 保留未处理的部分
        buffer = lines[lines.length - 1];
      }
      
      // 如果没有收到[DONE]标记，发送结束事件
      if (chunkIndex > 0) {
        yield {
          eventType: 'END',
          eventSn: chunkIndex,
          content: { text: '' },
          metadata: { completed: true }
        };
      }
      
    } catch (error) {
      console.error('DeepSeek API stream error:', error);
      
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
      metadata: { 
        mock: true,
        model: this.config.modelName 
      }
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
      metadata: { 
        mock: true,
        model: this.config.modelName 
      }
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
          model: this.config.modelName,
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
        model: this.config.modelName,
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
   * 准备请求选项
   * @returns 请求选项对象
   */
  protected override prepareRequestOptions(): RequestInit {
    const options = super.prepareRequestOptions();
    
    // 确保添加DeepSeek API所需的Authorization头
    if (this.config.apiKey) {
      options.headers = {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
    }
    
    return options;
  }

  /**
   * 创建错误响应
   * @param error 错误对象
   * @returns AdaptedResponse 错误响应
   */
  protected override createErrorResponse(error: Error): AdaptedResponse {
    return {
      role: 'assistant',
      content: `DeepSeek Error: ${error.message}`,
      status: 'error',
      timestamp: Date.now(),
      modelType: this.modelType,
      metadata: { 
        error: error.message, 
        code: error.name,
        mock: this.mockMode,
        model: this.config.modelName 
      }
    };
  }
}
