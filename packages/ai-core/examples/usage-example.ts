// AI核心库使用示例

import { ModelFactory, ModelType, ModelConfig, ChatMessage, StreamChunk } from '../index';

// 为浏览器环境提供process对象兼容
  declare const process: { env: Record<string, string> } | undefined;
  
  // 修复取消请求方法名
  interface ModelWithCancel {
    cancelRequest: () => void;
    abortRequest?: () => void;
  }

/**
 * 使用示例类
 * 展示如何使用AI核心库进行模型调用和流式处理
 */
export class AIUsageExample {
  /**
   * 基本使用示例 - 自定义API
   */
  public static async useCustomModel(): Promise<void> {
    console.log('\n===== 自定义API使用示例 =====');
    
    // 配置自定义API
    const customConfig: ModelConfig = {
      baseUrl: '/api/ai/chat',
      temperature: 0.7,
      mockMode: true, // 使用模拟模式进行开发测试
      mockDelay: 30
    };
    
    // 获取自定义API模型实例
    const customModel = ModelFactory.getInstance(ModelType.CUSTOM, customConfig);
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个AI助手，用中文回复用户问题。' },
      { role: 'user', content: '你好，请介绍一下你自己。' }
    ];
    
    try {
      // 发送非流式请求
      console.log('发送非流式请求...');
      const response = await customModel.request(messages);
      console.log('非流式响应结果:', response);
      
    } catch (error) {
      console.error('自定义API错误:', (error as Error).message || String(error));
    }
  }
  
  /**
   * DeepSeek API使用示例
   */
  public static async useDeepseekModel(): Promise<void> {
    console.log('\n===== DeepSeek API使用示例 =====');
    
    // 配置DeepSeek API
    const deepseekConfig: ModelConfig = {
      apiKey: (typeof process !== 'undefined' && process?.env?.DEEPSEEK_API_KEY) || '', // 从环境变量获取API密钥
      modelName: 'deepseek-chat',
      temperature: 0.5,
      mockMode: true, // 在没有API密钥时使用模拟模式
      mockDelay: 40
    };
    
    // 获取DeepSeek模型实例
    const deepseekModel = ModelFactory.getInstance(ModelType.DEEPSEEK, deepseekConfig);
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是DeepSeek AI助手，用简洁专业的语言回答问题。' },
      { role: 'user', content: '解释什么是机器学习。' }
    ];
    
    try {
      // 发送非流式请求
      console.log('发送DeepSeek非流式请求...');
      const response = await deepseekModel.request(messages);
      console.log('DeepSeek非流式响应结果:', response);
      
    } catch (error) {
      console.error('DeepSeek API错误:', (error as Error).message || String(error));
    }
  }
  
  /**
   * 流式处理示例 - 使用async generator
   */
  public static async streamProcessingExample(): Promise<void> {
    console.log('\n===== 流式处理示例 =====');
    
    // 获取自定义API模型实例（使用模拟模式）
    const customModel = ModelFactory.getInstance(ModelType.CUSTOM, {
      mockMode: true,
      mockDelay: 20
    });
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: 'user', content: '请详细介绍一下流式处理的工作原理。' }
    ];
    
    try {
      console.log('开始流式处理...');
      let fullResponse = '';
      
      // 使用for await...of循环消费async generator
      for await (const chunk of customModel.createStreamGenerator(messages) as AsyncGenerator<StreamChunk>) {
          // 根据事件类型处理不同的消息
          switch (chunk.eventType) {
            case 'START':
              console.log('流式响应开始');
              break;
            case 'TEXT':
              // 累加文本内容
              fullResponse += chunk.content.text;
              // 在实际应用中，这里可以实时更新UI
              console.log('收到文本块:', chunk.content.text);
              break;
            case 'TOOL_START':
              console.log('工具调用开始:', chunk.metadata?.toolName);
              break;
            case 'END':
              console.log('流式响应结束');
              console.log('完整响应:', fullResponse);
              break;
            case 'ERROR':
              console.error('流式响应错误:', chunk.content.text);
              break;
            default:
              console.log('其他事件类型:', chunk.eventType);
          }
        }
      
    } catch (error) {
      console.error('流式处理错误:', (error as Error).message || String(error));
    }
  }
  
  /**
   * 使用回调函数进行流式处理
   */
  public static async streamWithCallbacks(): Promise<void> {
    console.log('\n===== 使用回调函数进行流式处理 =====');
    
    // 获取DeepSeek模型实例（使用模拟模式）
    const deepseekModel = ModelFactory.getInstance(ModelType.DEEPSEEK, {
      mockMode: true,
      mockDelay: 30
    });
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: 'user', content: '如何优化前端性能？' }
    ];
    
    try {
      let fullResponse = '';
      let isCompleted = false;
      
      // 使用streamRequest方法并传入回调
      const stream = deepseekModel.streamRequest(messages, {
        onStart: () => {
          console.log('流式请求开始');
        },
        onChunk: (chunk: StreamChunk) => {
          if (chunk.eventType === 'TEXT') {
            fullResponse += chunk.content.text;
            console.log('实时内容:', fullResponse);
          }
        },
        onComplete: () => {
          isCompleted = true;
          console.log('流式请求完成');
          console.log('最终响应:', fullResponse);
        },
        onError: (error: Error) => {
          console.error('流式请求错误:', error);
        }
      });
      
      // 等待流处理完成
      await stream;
      
    } catch (error) {
      console.error('回调式流式处理错误:', (error as Error).message || String(error));
    }
  }
  
  /**
   * 取消请求示例
   */
  public static async cancelRequestExample(): Promise<void> {
    console.log('\n===== 取消请求示例 =====');
    
    // 获取模型实例
    const model = ModelFactory.getInstance(ModelType.CUSTOM, {
      mockMode: true,
      mockDelay: 100 // 较慢的模拟延迟，方便演示取消
    });
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: 'user', content: '请生成一篇长文章，包含多个段落。' }
    ];
    
    try {
      console.log('开始流式处理，将在3秒后取消...');
      
      // 启动流式处理
      const streamPromise = (async () => {
          for await (const chunk of model.createStreamGenerator(messages) as AsyncGenerator<StreamChunk>) {
            if (chunk.eventType === 'TEXT') {
              console.log('收到文本:', chunk.content.text);
            }
          }
        })();
      
      // 3秒后取消请求
        setTimeout(() => {
          console.log('取消请求...');
          const modelWithCancel = model as unknown as ModelWithCancel;
          if (modelWithCancel.cancelRequest) {
            modelWithCancel.cancelRequest();
          } else if (modelWithCancel.abortRequest) {
            modelWithCancel.abortRequest();
          }
        }, 3000);
        
        // 等待流处理完成（可能被取消）
        await streamPromise;
        
      } catch (error) {
        console.log('捕获到预期的取消错误:', (error as Error).message);
    }
  }
  
  /**
   * 配置管理示例
   */
  public static updateModelConfig(): void {
    console.log('\n===== 配置管理示例 =====');
    
    // 获取实例
    const model = ModelFactory.getInstance(ModelType.CUSTOM);
    
    // 初始配置
    console.log('初始模型类型:', model.getModelType());
    
    // 更新配置
    const newConfig: ModelConfig = {
      temperature: 0.9,
      maxTokens: 2000,
      mockMode: true
    };
    
    // 通过工厂类更新配置
    const updateSuccess = ModelFactory.updateConfig(ModelType.CUSTOM, newConfig);
    console.log('配置更新成功:', updateSuccess);
    
    // 手动更新配置
    model.setConfig({
      mockDelay: 60
    });
    
    console.log('配置管理操作完成');
  }
  
  /**
   * 资源管理示例
   */
  public static resourceManagement(): void {
    console.log('\n===== 资源管理示例 =====');
    
    // 创建多个实例
    const customModel = ModelFactory.getInstance(ModelType.CUSTOM);
    const deepseekModel = ModelFactory.getInstance(ModelType.DEEPSEEK);
    
    // 检查实例存在性
    console.log('自定义API实例存在:', ModelFactory.hasInstance(ModelType.CUSTOM));
    console.log('DeepSeek实例存在:', ModelFactory.hasInstance(ModelType.DEEPSEEK));
    
    // 获取所有实例类型
    console.log('所有实例类型:', ModelFactory.getAllInstanceTypes());
    
    // 销毁特定实例
    ModelFactory.destroyInstance(ModelType.CUSTOM);
    console.log('销毁后自定义API实例存在:', ModelFactory.hasInstance(ModelType.CUSTOM));
    
    // 销毁所有实例
    ModelFactory.destroyAllInstances();
    console.log('销毁所有后实例数量:', ModelFactory.getAllInstanceTypes().length);
  }
  
  /**
   * 运行所有示例
   */
  public static async runAllExamples(): Promise<void> {
    try {
      console.log('===== 开始运行AI核心库使用示例 =====');
      
      // 运行各个示例
      await this.useCustomModel();
      await this.useDeepseekModel();
      await this.streamProcessingExample();
      await this.streamWithCallbacks();
      await this.cancelRequestExample();
      this.updateModelConfig();
      this.resourceManagement();
      
      console.log('\n===== 所有示例运行完成 =====');
      
    } catch (error) {
      console.error('示例运行过程中发生错误:', (error as Error).message || String(error));
    } finally {
      // 清理资源
      ModelFactory.destroyAllInstances();
    }
  }
}

// 运行示例
// 实际使用时，取消下面这行的注释
// AIUsageExample.runAllExamples();
