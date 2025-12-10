# AI Core 库

一个功能强大、易于使用的AI对话前端核心库，支持多种模型集成、流式输出和响应式状态管理。

## 功能特性

- **多模型支持**：集成OpenAI、GPT-4和自定义API
- **流式输出**：实时显示AI回复，提升用户体验
- **响应式设计**：完全响应式的UI组件，适配各种设备
- **统一接口**：使用工厂模式和适配器模式，屏蔽不同模型的差异
- **状态管理**：内置的状态管理系统，自动保存对话历史
- **主题定制**：支持自定义主题颜色和界面样式
- **TypeScript支持**：完整的类型定义，提供良好的开发体验

## 快速开始

### 安装

使用pnpm安装：

```bash
pnpm add @fe-base/ai-core
```

### 基本使用

#### 1. 使用ModelFactory进行API调用

```ts
import { ModelFactory, ModelType, ChatMessage } from '@fe-base/ai-core';

// 创建模型实例
const model = ModelFactory.createInstance(ModelType.OPENAI, {
  apiKey: 'your-api-key',
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7
});

// 准备消息
const messages: ChatMessage[] = [
  {
    role: 'user',
    content: 'Hello, AI!'
  }
];

// 发送请求
async function sendRequest() {
  try {
    const response = await model.request(messages);
    console.log('Response:', response.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

// 流式请求
async function sendStreamRequest() {
  let fullResponse = '';
  
  await model.streamRequest(messages, {
    onMessage: (chunk) => {
      fullResponse += chunk.content;
      console.log('Stream chunk:', chunk.content);
    },
    onComplete: () => {
      console.log('Full response:', fullResponse);
    },
    onError: (error) => {
      console.error('Stream error:', error);
    }
  });
}
```

#### 2. 使用Chat组件

```vue
<template>
  <div class="chat-app">
    <Chat
      title="我的AI助手"
      :model-type="modelType"
      :show-avatars="true"
      theme-color="#4a9eff"
      :enable-file-upload="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ModelType } from '@fe-base/ai-core';
import { Chat } from '@fe-base/ai-core';
</script>

<style>
.chat-app {
  width: 100%;
  height: 600px;
}
</style>
```

## API文档

### ModelFactory

工厂类，负责创建和管理不同类型的AI模型实例。

#### 方法

- **createInstance(modelType, config?, instanceId?)**: 创建或获取模型实例
  - `modelType`: 模型类型（`ModelType.OPENAI`, `ModelType.GPT4`, `ModelType.CUSTOM`）
  - `config`: 可选的模型配置
  - `instanceId`: 可选的实例ID

- **setDefaultConfig(modelType, config)**: 设置指定模型类型的默认配置

- **getDefaultConfig(modelType)**: 获取指定模型类型的默认配置

- **clearInstance(instanceId)**: 清除指定实例

- **clearAllInstances()**: 清除所有实例

- **getAllInstanceIds()**: 获取所有实例ID列表

- **getInstance(instanceId)**: 获取指定ID的实例

- **hasInstance(instanceId)**: 检查实例是否存在

### ModelService 接口

所有模型实现都遵循的接口。

#### 方法

- **getModelType()**: 获取模型类型

- **setConfig(config)**: 设置配置

- **getConfig()**: 获取配置

- **request(messages)**: 发送非流式请求

- **streamRequest(messages, callbacks)**: 发送流式请求

- **createReactiveStream(messages)**: 创建响应式数据流

- **cancel()**: 取消当前请求

- **isProcessing()**: 检查是否正在处理请求

### ResponseAdapterFactory

响应适配器工厂，用于处理不同模型返回结果的差异。

#### 方法

- **createAdapter(modelType)**: 根据模型类型创建响应适配器

- **adaptResponse(rawResponse, modelType, config?)**: 通用的响应适配方法

- **adaptSSEMessage(rawMessage, modelType, config?)**: 通用的SSE消息适配方法

- **autoDetectAndAdapt(rawResponse, config?)**: 尝试智能检测并适配响应

### Chat 组件

完整的聊天UI组件。

#### 属性

- **title**: 聊天标题，默认 'AI 助手'
- **emptyMessage**: 空状态消息，默认 '开始对话吧！'
- **showHeader**: 是否显示头部，默认 true
- **showAvatars**: 是否显示头像，默认 true
- **showSenderNames**: 是否显示发送者名称，默认 true
- **showTimestamps**: 是否显示时间戳，默认 true
- **showClearButton**: 是否显示清空按钮，默认 true
- **showSettingsButton**: 是否显示设置按钮，默认 true
- **enableVoiceInput**: 是否启用语音输入，默认 false
- **enableFileUpload**: 是否启用文件上传，默认 false
- **allowedFileTypes**: 允许上传的文件类型，默认 ['image/*', 'text/plain']
- **themeColor**: 主题颜色，默认 '#4a9eff'
- **modelType**: 模型类型，默认 ModelType.OPENAI
- **initialMessages**: 初始消息列表
- **maxHistory**: 最大历史记录数量，默认 50

#### 暴露方法

- **sendMessage()**: 发送消息
- **clearChat()**: 清空聊天
- **addMessage(message)**: 添加消息
- **loadMessages(messages)**: 加载消息列表

### ChatStateManager

聊天状态管理器，用于管理聊天历史和配置。

#### 方法

- **getMessages()**: 获取消息列表
- **setMessages(messages)**: 设置消息列表
- **addMessage(message)**: 添加单条消息
- **clearMessages()**: 清空消息
- **getConfig()**: 获取配置
- **setConfig(config)**: 设置配置
- **reset()**: 重置所有状态

## 高级用法

### 自定义API集成

```ts
import { ModelFactory, ModelType } from '@fe-base/ai-core';

// 配置自定义API
ModelFactory.setDefaultConfig(ModelType.CUSTOM, {
  baseUrl: 'https://your-api-endpoint.com/chat',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  customParams: {
    // 自定义参数
  }
});

// 创建实例并使用
const customModel = ModelFactory.createInstance(ModelType.CUSTOM);
```

### 响应式数据流

```ts
import { createChatMessageStream } from '@fe-base/ai-core';
import { ModelFactory, ModelType } from '@fe-base/ai-core';

const model = ModelFactory.createInstance(ModelType.OPENAI);
const messages = [{ role: 'user', content: 'Tell me a joke' }];

// 创建响应式数据流
const stream = createChatMessageStream(model, messages);

// 订阅数据流
stream.subscribe({
  next: (message) => {
    console.log('Current message:', message.content);
  },
  error: (error) => {
    console.error('Stream error:', error);
  },
  complete: () => {
    console.log('Stream completed');
  }
});

// 取消订阅
// stream.unsubscribe();
```

### 多实例管理

```ts
import { ModelFactory, ModelType } from '@fe-base/ai-core';

// 创建多个不同的实例
const openaiInstance = ModelFactory.createInstance(ModelType.OPENAI, {}, 'openai-main');
const gpt4Instance = ModelFactory.createInstance(ModelType.GPT4, {}, 'gpt4-advanced');

// 根据ID获取实例
const instance = ModelFactory.getInstance('openai-main');

// 检查实例是否存在
if (ModelFactory.hasInstance('gpt4-advanced')) {
  // 使用实例
}

// 清理不再需要的实例
ModelFactory.clearInstance('openai-main');
```

## 配置项

### 模型配置选项

```ts
interface ModelConfig {
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
  
  // 重试配置
  maxRetries?: number;      // 最大重试次数
  retryDelay?: number;      // 重试延迟（毫秒）
}
```

## 浏览器兼容性

- Chrome (最新2个版本)
- Firefox (最新2个版本)
- Safari (最新2个版本)
- Edge (最新2个版本)

## 开发指南

### 安装依赖

```bash
pnpm install
```

### 运行测试

```bash
pnpm test
```

### 构建项目

```bash
pnpm build
```

## License

MIT

## 贡献指南

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持OpenAI和自定义API集成
- 实现流式输出和响应式状态管理
- 提供完整的Vue 3组件

## 功能特性

- 支持多种AI模型对接（OpenAI、DeepSeek、自定义API）
- 流式输出封装，提供友好的回调接口
- 完整的状态管理，处理对话的各种状态变化
- 支持撤销/重做操作
- 统一的错误处理和重试机制

## 安装

```bash
pnpm add @tsc-base-fe/ai-core
```

## 基本使用

### 1. 使用默认服务实例

```typescript
import { aiService, ChatStatus } from '@tsc-base-fe/ai-core';

// 发送流式请求
const cancelFn = aiService.stream(
  {
    messages: [
      { role: 'system', content: '你是一个AI助手' },
      { role: 'user', content: '你好，请介绍一下自己' }
    ]
  },
  {
    onMessage: (message) => {
      console.log('收到消息:', message);
    },
    onChunk: (chunk) => {
      console.log('收到文本块:', chunk);
    },
    onComplete: () => {
      console.log('完成');
    },
    onError: (error) => {
      console.error('错误:', error);
    }
  }
);

// 取消请求（如果需要）
// cancelFn();
```

### 2. 创建自定义服务实例

```typescript
import { createAIService, ModelType, ModelConfig } from '@tsc-base-fe/ai-core';

// 配置
const config: ModelConfig = {
  apiKey: 'your-api-key',
  baseUrl: 'https://api.openai.com/v1/chat/completions',
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7
};

// 创建服务
const openaiService = createAIService(ModelType.OPENAI, config);

// 使用服务
openaiService.stream({
  messages: [{ role: 'user', content: '什么是人工智能？' }]
}, {
  onChunk: (chunk) => {
    console.log('收到:', chunk);
  }
});
```

### 3. 使用状态管理器

```typescript
import { createChatStateManager, createAIService, ChatStatus } from '@tsc-base-fe/ai-core';

// 创建状态管理器
const chatState = createChatStateManager();
const aiService = createAIService();

// 添加用户消息
const userMessage = chatState.addUserMessage('请解释量子计算');

// 发送到AI
const cancelFn = aiService.stream(
  { messages: chatState.getFormattedMessages() },
  {
    onMessage: (message) => {
      // 自动处理状态更新
      chatState.handleSSEMessage(message);
      console.log('当前状态:', chatState.getStatus());
    },
    onComplete: () => {
      console.log('所有消息:', chatState.getMessages());
    }
  }
);

// 取消生成
// chatState.cancelGenerating();

// 清空对话
// chatState.clearMessages();

// 撤销操作
// chatState.undo();
```

## API 参考

### AIService

- `constructor(modelType: ModelType = ModelType.CUSTOM, config?: ModelConfig)` - 创建服务实例
- `setConfig(config: ModelConfig): void` - 设置配置
- `request(params: any): Promise<any>` - 发送普通请求
- `stream(params: any, callbacks: StreamCallbacks): () => void` - 发送流式请求，返回取消函数
- `cancel(): void` - 取消当前请求
- `switchModel(modelType: ModelType, config?: ModelConfig): void` - 切换模型

### ChatStateManager

- `getStatus(): ChatStatus` - 获取当前状态
- `getMessages(): ChatMessage[]` - 获取消息列表
- `addUserMessage(content: string): ChatMessage` - 添加用户消息
- `addAssistantMessage(content: string): ChatMessage` - 添加助手消息
- `appendAssistantResponse(content: string): void` - 追加助手响应内容
- `clearMessages(): void` - 清空所有消息
- `startGenerating(): void` - 开始生成
- `completeGenerating(): void` - 完成生成
- `setError(error: Error): void` - 设置错误
- `cancelGenerating(): void` - 取消生成
- `handleSSEMessage(message: SSEMessage): void` - 处理SSE消息
- `undo(): boolean` - 撤销
- `redo(): boolean` - 重做
- `getFormattedMessages(): Array<{ role: string; content: string }>` - 获取格式化的消息列表

### 类型定义

#### ModelType
```typescript
enum ModelType {
  OPENAI = 'openai',
  GPT4 = 'gpt4',
  DEEPSEEK = 'deepseek',
  CUSTOM = 'custom',
}
```

#### ChatStatus
```typescript
enum ChatStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}
```

#### StreamCallbacks
```typescript
interface StreamCallbacks {
  onMessage?: (message: SSEMessage) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}
```

## 与UI组件配合使用

结合 `@tsc-base-fe/ui` 包中的 `Chat` 组件使用：

```vue
<template>
  <div class="chat-app">
    <Chat
      :model-type="ModelType.OPENAI"
      :model-config="modelConfig"
      @send="handleSend"
      @receive="handleReceive"
      @complete="handleComplete"
    />
  </div>
</template>

<script lang="ts" setup>
import { Chat } from '@tsc-base-fe/ui';
import { ModelType, ModelConfig } from '@tsc-base-fe/ai-core';
import type { ChatMessage } from '@tsc-base-fe/ai-core';

const modelConfig: ModelConfig = {
  apiKey: 'your-api-key',
};

const handleSend = (message: ChatMessage) => {
  console.log('发送消息:', message);
};

const handleReceive = (message: ChatMessage) => {
  console.log('收到回复:', message);
};

const handleComplete = (messages: ChatMessage[]) => {
  console.log('对话完成:', messages);
};
</script>

<style>
.chat-app {
  width: 100%;
  height: 100vh;
}
</style>
```

## 注意事项

1. 使用第三方API时，请确保正确配置API密钥和基础URL
2. 流式请求依赖于浏览器的 `ReadableStream` API，请确保浏览器兼容性
3. 长时间运行的对话可能会消耗较多内存，建议定期清理消息历史
4. 错误处理非常重要，特别是在网络不稳定的情况下

## 故障排除

- **无法连接到API**: 检查网络连接和API配置
- **流式输出不工作**: 确认服务器支持SSE（Server-Sent Events）或流式响应
- **内存占用过高**: 尝试限制消息历史记录的长度

## 许可证

MIT