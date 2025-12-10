// 前向声明，用于循环依赖
import type { ModelService } from './services/model-service';

// 事件类型定义
export type EventType = 
  | 'START'
  | 'TOOL_START'
  | 'TOOL'
  | 'TOOL_END'
  | 'THINK_START'
  | 'THINK'
  | 'THINK_END'
  | 'ECHARTS_START'
  | 'ECHARTS'
  | 'ECHARTS_END'
  | 'INTENTION_RECOGNIZE'
  | 'RETRIEVE'
  | 'TEXT'
  | 'END'
  | 'ERROR'
  | 'UPDATE_STATUS'; // 新增状态更新事件

// 导出ModelService接口
export type { ModelService };

export enum EventTypeEnum {
  START = 'START',
  TOOL_START = 'TOOL_START',
  TOOL = 'TOOL',
  TOOL_END = 'TOOL_END',
  THINK_START = 'THINK_START',
  THINK = 'THINK',
  THINK_END = 'THINK_END',
  ECHARTS_START = 'ECHARTS_START',
  ECHARTS = 'ECHARTS',
  ECHARTS_END = 'ECHARTS_END',
  INTENTION_RECOGNIZE = 'INTENTION_RECOGNIZE',
  RETRIEVE = 'RETRIEVE',
  TEXT = 'TEXT',
  END = 'END',
  ERROR = 'ERROR',
  UPDATE_STATUS = 'UPDATE_STATUS', // 新增状态更新枚举
}

// 模型类型枚举
export enum ModelType {
  CUSTOM = 'custom',
  DEEPSEEK = 'deepseek'
}

// 模型配置接口
export interface ModelConfig {
  // 基础配置
  apiKey?: string;          // API密钥
  baseUrl?: string;         // API基础URL
  modelName?: string;       // 模型名称
  temperature?: number;     // 生成温度 (0-1)
  maxTokens?: number;       // 最大响应长度
  timeout?: number;         // 请求超时时间（毫秒）
  
  // 高级配置
  headers?: Record<string, string>;  // 自定义请求头
  customParams?: Record<string, any>; // 自定义参数
  mockMode?: boolean;       // 模拟模式
  mockDelay?: number;       // 模拟延迟（毫秒）
  
  // 重试配置
  maxRetries?: number;      // 最大重试次数
  retryDelay?: number;      // 重试延迟（毫秒）
}

// 统一的流式的数据块
export interface StreamChunk {
  eventType: EventType;
  eventSn: number;
  content: {
    text: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

// 流式请求回调接口
export interface StreamCallbacks {
  onStart?: () => void;
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// 适配后的响应接口
export interface AdaptedResponse {
  role: 'assistant';
  content: string;
  status: 'success' | 'error';
  timestamp: number;
  modelType: ModelType;
  metadata?: Record<string, any>;
}

// 统一的模型返回的消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

// Async Generator流式生成器类型
export type StreamGenerator = AsyncGenerator<StreamChunk, void, void>;