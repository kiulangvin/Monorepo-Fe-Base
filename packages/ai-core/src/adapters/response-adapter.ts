import { ModelType, AdaptedResponse, StreamChunk, EventType, EventTypeEnum } from '../types';

/**
 * 响应适配器接口
 */
export interface ResponseAdapter {
  /**
   * 适配非流式响应
   * @param rawResponse 原始响应
   * @returns 适配后的响应
   */
  adaptResponse(rawResponse: any): AdaptedResponse;

  /**
   * 适配流式响应数据
   * @param rawChunk 原始数据块
   * @param chunkIndex 数据块索引
   * @returns 适配后的流式数据块
   */
  adaptStreamChunk(rawChunk: any, chunkIndex: number): StreamChunk | null;

  /**
   * 获取模型类型
   */
  getModelType(): ModelType;
}

/**
 * 自定义API响应适配器
 */
export class CustomApiResponseAdapter implements ResponseAdapter {
  public getModelType(): ModelType {
    return ModelType.CUSTOM;
  }

  public adaptResponse(rawResponse: any): AdaptedResponse {
    return {
      role: 'assistant',
      content: rawResponse.content || '',
      status: 'success',
      timestamp: Date.now(),
      modelType: ModelType.CUSTOM,
      metadata: {
        responseId: rawResponse.id,
        model: rawResponse.model,
        ...rawResponse.metadata
      }
    };
  }

  public adaptStreamChunk(rawChunk: any, chunkIndex: number): StreamChunk | null {
    // 处理自定义API的SSE数据格式
    if (!rawChunk || typeof rawChunk !== 'string') {
      return null;
    }

    try {
      // 尝试解析SSE消息格式
      const lines = rawChunk.split('\n');
      let data = '';
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          data = line.slice(5).trim();
        }
      }

      if (!data || data === '[DONE]') {
        return null;
      }

      const parsed = JSON.parse(data);
      
      // 根据自定义API返回的格式进行适配
      return {
        eventType: parsed.eventType || EventTypeEnum.TEXT,
        eventSn: parsed.sn || chunkIndex,
        content: {
          text: parsed.content || '',
          ...parsed.data
        },
        metadata: {
          raw: parsed,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to parse custom API stream chunk:', error);
      return null;
    }
  }
}

/**
 * DeepSeek响应适配器
 */
export class DeepseekResponseAdapter implements ResponseAdapter {
  public getModelType(): ModelType {
    return ModelType.DEEPSEEK;
  }

  public adaptResponse(rawResponse: any): AdaptedResponse {
    // DeepSeek非流式响应格式适配
    const content = rawResponse.choices?.[0]?.message?.content || '';
    
    return {
      role: 'assistant',
      content,
      status: 'success',
      timestamp: Date.now(),
      modelType: ModelType.DEEPSEEK,
      metadata: {
        id: rawResponse.id,
        model: rawResponse.model,
        usage: rawResponse.usage,
        ...rawResponse.metadata
      }
    };
  }

  public adaptStreamChunk(rawChunk: any, chunkIndex: number): StreamChunk | null {
    // 处理已经解析好的DeepSeek API JSON对象
    if (!rawChunk || typeof rawChunk !== 'object') {
      return null;
    }

    try {
      // 从对象中提取数据
      if (rawChunk.choices && Array.isArray(rawChunk.choices) && rawChunk.choices[0] && rawChunk.choices[0].delta) {
        const content = rawChunk.choices[0].delta.content || '';
        
        return {
          eventType: EventTypeEnum.TEXT,
          eventSn: chunkIndex,
          content: {
            text: content
          },
          metadata: {
            finish_reason: rawChunk.choices[0].finish_reason,
            model: rawChunk.model,
            created: rawChunk.created,
            id: rawChunk.id
          }
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse DeepSeek stream chunk:', error);
      return null;
    }
  }
}

/**
 * 响应适配器工厂
 */
export class ResponseAdapterFactory {
  private static adapters: Map<ModelType, ResponseAdapter> = new Map();

  static {
    // 注册默认适配器
    ResponseAdapterFactory.adapters.set(ModelType.CUSTOM, new CustomApiResponseAdapter());
    ResponseAdapterFactory.adapters.set(ModelType.DEEPSEEK, new DeepseekResponseAdapter());
  }

  /**
   * 创建响应适配器
   * @param modelType 模型类型
   * @returns ResponseAdapter
   */
  public static createAdapter(modelType: ModelType): ResponseAdapter {
    const adapter = this.adapters.get(modelType);
    if (!adapter) {
      throw new Error(`No response adapter found for model type: ${modelType}`);
    }
    return adapter;
  }

  /**
   * 注册自定义适配器
   * @param modelType 模型类型
   * @param adapter 适配器实例
   */
  public static registerAdapter(modelType: ModelType, adapter: ResponseAdapter): void {
    this.adapters.set(modelType, adapter);
  }

  /**
   * 通用的响应适配方法
   * @param rawResponse 原始响应
   * @param modelType 模型类型
   * @returns 适配后的响应
   */
  public static adaptResponse(rawResponse: any, modelType: ModelType): AdaptedResponse {
    const adapter = this.createAdapter(modelType);
    return adapter.adaptResponse(rawResponse);
  }

  /**
   * 通用的流式数据块适配方法
   * @param rawChunk 原始数据块
   * @param modelType 模型类型
   * @param chunkIndex 数据块索引
   * @returns 适配后的流式数据块
   */
  public static adaptStreamChunk(rawChunk: any, modelType: ModelType, chunkIndex: number): StreamChunk | null {
    const adapter = this.createAdapter(modelType);
    return adapter.adaptStreamChunk(rawChunk, chunkIndex);
  }
}
