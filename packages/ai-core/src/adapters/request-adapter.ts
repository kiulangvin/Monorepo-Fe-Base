import { ChatMessage, ModelType, ModelConfig } from '../types';

/**
 * 请求适配器接口
 */
export interface RequestAdapter {
  /**
   * 适配请求参数
   * @param messages 消息列表
   * @param config 配置
   * @returns 适配后的请求参数
   */
  adaptRequest(messages: ChatMessage[], config: ModelConfig): Record<string, any>;

  /**
   * 获取模型类型
   */
  getModelType(): ModelType;
}

/**
 * 自定义API请求适配器
 */
export class CustomApiRequestAdapter implements RequestAdapter {
  public getModelType(): ModelType {
    return ModelType.CUSTOM;
  }

  public adaptRequest(messages: ChatMessage[], config: ModelConfig): Record<string, any> {
    return {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata
      })),
      model: config.modelName || 'custom-model',
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1000,
      ...config.customParams
    };
  }
}

/**
 * DeepSeek请求适配器
 */
export class DeepseekRequestAdapter implements RequestAdapter {
  public getModelType(): ModelType {
    return ModelType.DEEPSEEK;
  }

  public adaptRequest(messages: ChatMessage[], config: ModelConfig): Record<string, any> {
    // DeepSeek API 兼容 OpenAI 格式
    return {
      model: config.modelName || 'deepseek-chat',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1000,
      stream: true, // DeepSeek 流式请求需要设置
      ...config.customParams
    };
  }
}

/**
 * 请求适配器工厂
 */
export class RequestAdapterFactory {
  private static adapters: Map<ModelType, RequestAdapter> = new Map();

  static {
    // 注册默认适配器
    RequestAdapterFactory.adapters.set(ModelType.CUSTOM, new CustomApiRequestAdapter());
    RequestAdapterFactory.adapters.set(ModelType.DEEPSEEK, new DeepseekRequestAdapter());
  }

  /**
   * 创建请求适配器
   * @param modelType 模型类型
   * @returns RequestAdapter
   */
  public static createAdapter(modelType: ModelType): RequestAdapter {
    const adapter = this.adapters.get(modelType);
    if (!adapter) {
      throw new Error(`No request adapter found for model type: ${modelType}`);
    }
    return adapter;
  }

  /**
   * 注册自定义适配器
   * @param modelType 模型类型
   * @param adapter 适配器实例
   */
  public static registerAdapter(modelType: ModelType, adapter: RequestAdapter): void {
    this.adapters.set(modelType, adapter);
  }

  /**
   * 获取所有可用的适配器类型
   */
  public static getAvailableAdapterTypes(): ModelType[] {
    return Array.from(this.adapters.keys());
  }
}
