import { ModelConfig, ChatMessage, StreamCallbacks, ModelType, AdaptedResponse, StreamChunk } from '../types';

/**
 * 流式数据生成器
 */
export type StreamGenerator = AsyncGenerator<StreamChunk, void, void>;

/**
 * 模型服务接口
 * 定义所有模型实现类必须提供的方法
 */
export interface ModelService {
  /**
   * 获取当前模型类型
   */
  getModelType(): ModelType;

  /**
   * 设置模型配置
   * @param config 模型配置
   */
  setConfig(config: Partial<ModelConfig>): void;

  /**
   * 获取当前配置
   */
  getConfig(): ModelConfig;

  /**
   * 发送非流式请求
   * @param messages 对话消息列表
   * @returns Promise<AdaptedResponse> 适配后的响应
   */
  request(messages: ChatMessage[]): Promise<AdaptedResponse>;

  /**
   * 发送流式请求（回调方式）
   * @param messages 对话消息列表
   * @param callbacks 流式回调函数
   * @returns Promise<void>
   */
  streamRequest(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void>;

  /**
   * 创建流式数据生成器（使用async generator）
   * @param messages 对话消息列表
   * @returns StreamGenerator 异步生成器
   */
  createStreamGenerator(messages: ChatMessage[]): StreamGenerator;

  /**
   * 取消当前请求
   */
  cancel(): void;

  /**
   * 检查是否正在处理请求
   */
  isProcessing(): boolean;
}

/**
 * 模型服务基础类
 * 提供通用功能的实现
 */
export abstract class BaseModelService implements ModelService {
  protected config: ModelConfig;
  protected modelType: ModelType;
  protected isProcessingFlag: boolean = false;
  protected abortController: AbortController | null = null;

  constructor(modelType: ModelType, config: ModelConfig = {}) {
    this.modelType = modelType;
    this.config = {
      ...config,
      mockMode: config.mockMode ?? false,
      mockDelay: config.mockDelay ?? 50
    };
  }

  /**
   * 获取当前模型类型
   */
  public getModelType(): ModelType {
    return this.modelType;
  }

  /**
   * 设置模型配置
   * @param config 模型配置
   */
  public setConfig(config: Partial<ModelConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * 发送非流式请求
   * @param messages 对话消息列表
   * @returns Promise<AdaptedResponse> 适配后的响应
   */
  public abstract request(messages: ChatMessage[]): Promise<AdaptedResponse>;

  /**
   * 创建流式数据生成器（使用async generator）
   * @param messages 对话消息列表
   * @returns StreamGenerator 异步生成器
   */
  public abstract createStreamGenerator(messages: ChatMessage[]): StreamGenerator;

  /**
   * 实现流式请求（基于async generator）
   * @param messages 对话消息列表
   * @param callbacks 流式回调函数
   * @returns Promise<void>
   */
  public async streamRequest(messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    try {
      this.setProcessing(true);
      const generator = this.createStreamGenerator(messages);
      
      for await (const chunk of generator) {
        if (callbacks.onChunk) {
          callbacks.onChunk(chunk);
        }
        
        // 如果请求被取消，停止处理
        if (this.abortController?.signal.aborted) {
          break;
        }
      }
      
      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
    } catch (error) {
      console.error('Stream request error:', error);
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * 取消当前请求
   */
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessingFlag = false;
  }

  /**
   * 检查是否正在处理请求
   */
  public isProcessing(): boolean {
    return this.isProcessingFlag;
  }

  /**
   * 创建新的中止控制器
   */
  protected createAbortController(): AbortController {
    this.cancel(); // 取消之前的请求
    this.abortController = new AbortController();
    return this.abortController;
  }

  /**
   * 设置处理状态
   * @param processing 是否正在处理
   */
  protected setProcessing(processing: boolean): void {
    this.isProcessingFlag = processing;
  }

  /**
   * 准备请求选项
   * @param additionalHeaders 额外的请求头
   * @returns RequestInit 请求选项
   */
  protected prepareRequestOptions(additionalHeaders: Record<string, string> = {}): RequestInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...additionalHeaders
    };

    // 添加API密钥（如果有）
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const options: RequestInit = {
      method: 'POST',
      headers,
      signal: this.abortController?.signal
    };

    // 添加超时设置
    if (this.config.timeout) {
      // 注意：这里不直接设置timeout，因为fetch API不支持
      // 超时处理需要在调用层实现
    }

    return options;
  }

  /**
   * 创建错误响应
   * @param error 错误对象
   * @returns AdaptedResponse 错误响应
   */
  protected createErrorResponse(error: Error): AdaptedResponse {
    return {
      role: 'assistant',
      content: `Error: ${error.message}`,
      status: 'error',
      timestamp: Date.now(),
      modelType: this.modelType,
      metadata: { error: error.message }
    };
  }
}