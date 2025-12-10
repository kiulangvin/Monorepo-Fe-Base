import { ModelType, ModelConfig, ModelService } from '../types';
import { CustomApiImplementation } from '../implementations/custom-api-implementation';
import { DeepseekImplementation } from '../implementations/deepseek-implementation';

/**
 * 模型工厂类
 * 使用工厂模式和单例模式管理不同类型的AI模型实例
 */
export class ModelFactory {
  // 存储单例实例的映射
  private static instances: Map<ModelType, ModelService> = new Map();
  
  // 私有构造函数，防止外部实例化
  private constructor() {}
  
  /**
   * 获取模型实例（单例模式）
   * @param modelType 模型类型
   * @param config 模型配置（仅在首次创建实例时使用）
   * @returns ModelService 模型服务实例
   */
  public static getInstance(modelType: ModelType, config?: ModelConfig): ModelService {
    // 检查是否已经存在对应类型的实例
    if (!this.instances.has(modelType)) {
      // 创建新实例并存储
      const instance = this.createInstance(modelType, config || {});
      this.instances.set(modelType, instance);
    }
    
    // 返回已存在的实例
    const instance = this.instances.get(modelType);
    if (!instance) {
      throw new Error(`Failed to create model instance for type: ${modelType}`);
    }
    
    return instance;
  }
  
  /**
   * 创建新的模型实例
   * @param modelType 模型类型
   * @param config 模型配置
   * @returns ModelService 新创建的模型服务实例
   */
  private static createInstance(modelType: ModelType, config: ModelConfig): ModelService {
    switch (modelType) {
      case ModelType.CUSTOM:
        return new CustomApiImplementation(config);
      case ModelType.DEEPSEEK:
        return new DeepseekImplementation(config);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }
  
  /**
   * 更新指定类型模型的配置
   * @param modelType 模型类型
   * @param config 新的配置
   * @returns boolean 是否更新成功
   */
  public static updateConfig(modelType: ModelType, config: ModelConfig): boolean {
    const instance = this.instances.get(modelType);
    if (instance) {
      instance.setConfig(config);
      return true;
    }
    return false;
  }
  
  /**
   * 销毁指定类型的模型实例
   * @param modelType 模型类型
   * @returns boolean 是否销毁成功
   */
  public static destroyInstance(modelType: ModelType): boolean {
    if (this.instances.has(modelType)) {
      const instance = this.instances.get(modelType);
      if (instance) {
        instance.cancel();
      }
      this.instances.delete(modelType);
      return true;
    }
    return false;
  }
  
  /**
   * 销毁所有模型实例
   */
  public static destroyAllInstances(): void {
    this.instances.forEach((instance, modelType) => {
      instance.cancel();
      this.instances.delete(modelType);
    });
  }
  
  /**
   * 检查指定类型的模型实例是否存在
   * @param modelType 模型类型
   * @returns boolean 实例是否存在
   */
  public static hasInstance(modelType: ModelType): boolean {
    return this.instances.has(modelType);
  }
  
  /**
   * 获取当前所有实例的类型
   * @returns ModelType[] 所有实例的类型数组
   */
  public static getAllInstanceTypes(): ModelType[] {
    return Array.from(this.instances.keys());
  }
}
