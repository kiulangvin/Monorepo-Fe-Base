# UI 组件包

基于Vue 3的AI聊天组件库，支持流式输出显示和丰富的交互功能。

## 组件列表

- `Chat` - 完整的聊天组件，包含消息展示、输入和操作区域
- `ChatBubble` - 单个消息气泡组件
- `ChatLoading` - 加载状态组件

## 安装

```bash
pnpm add @tsc-base-fe/ui
```

## 全局引入

```javascript
// main.js
import { createApp } from 'vue';
import App from './App.vue';
import AIChatUI from '@tsc-base-fe/ui';
import '@tsc-base-fe/ui/dist/style.css';

const app = createApp(App);
app.use(AIChatUI);
app.mount('#app');
```

## 按需引入

```vue
<template>
  <div class="chat-container">
    <Chat />
  </div>
</template>

<script setup>
import { Chat } from '@tsc-base-fe/ui';
import '@tsc-base-fe/ui/dist/style.css';
</script>
```

## Chat 组件

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `model-type` | `string` | `'custom'` | 模型类型 ('openai', 'gpt4', 'deepseek', 'custom') |
| `model-config` | `object` | `{}` | 模型配置，包含apiKey、baseUrl等 |
| `placeholder` | `string` | `'请输入消息...'` | 输入框占位符 |
| `messages` | `Array` | `[]` | 预设消息列表 |
| `auto-scroll` | `boolean` | `true` | 是否自动滚动到底部 |
| `show-timestamps` | `boolean` | `true` | 是否显示时间戳 |
| `max-history-lines` | `number` | `100` | 最大历史记录行数 |
| `theme` | `string` | `'light'` | 主题 ('light', 'dark') |
| `compact` | `boolean` | `false` | 是否使用紧凑模式 |

### Emits

| 事件名 | 参数 | 说明 |
|-------|------|------|
| `send` | `message` | 发送消息时触发 |
| `receive` | `message` | 收到消息时触发 |
| `complete` | `messages` | 对话完成时触发 |
| `error` | `error` | 发生错误时触发 |
| `cancel` | - | 取消生成时触发 |
| `clear` | - | 清空对话时触发 |
| `regenerate` | `messageId` | 重新生成时触发 |
| `copy` | `content` | 复制内容时触发 |

### 暴露的方法

| 方法名 | 参数 | 说明 |
|-------|------|------|
| `sendMessage` | `content: string` | 发送消息 |
| `clearMessages` | - | 清空消息 |
| `regenerateLast` | - | 重新生成最后一条消息 |
| `cancelGenerating` | - | 取消生成 |
| `scrollToBottom` | - | 滚动到底部 |

### 示例

```vue
<template>
  <div class="chat-app">
    <Chat
      ref="chatRef"
      model-type="openai"
      :model-config="modelConfig"
      placeholder="请输入您的问题..."
      :auto-scroll="true"
      @send="handleSend"
      @complete="handleComplete"
      @error="handleError"
    />
    
    <button @click="clearChat">清空对话</button>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Chat } from '@tsc-base-fe/ui';
import type { ChatMessage } from '@tsc-base-fe/ai-core';

const chatRef = ref();
const modelConfig = {
  apiKey: 'your-api-key',
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7
};

// 初始消息
const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是AI助手，有什么可以帮助你的吗？',
    createdAt: new Date().toISOString()
  }
];

// 生命周期挂载时设置初始消息
onMounted(() => {
  // 可以在这里设置初始消息
  // chatRef.value.setMessages(initialMessages);
});

// 处理发送消息
const handleSend = (message: ChatMessage) => {
  console.log('发送的消息:', message);
};

// 处理对话完成
const handleComplete = (messages: ChatMessage[]) => {
  console.log('对话完成，当前消息列表:', messages);
};

// 处理错误
const handleError = (error: Error) => {
  console.error('发生错误:', error);
};

// 清空对话
const clearChat = () => {
  chatRef.value?.clearMessages();
};
</script>

<style scoped>
.chat-app {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  height: 80vh;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

button {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

## ChatBubble 组件

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `message` | `object` | 必选 | 消息对象，包含id、role、content等 |
| `show-time` | `boolean` | `true` | 是否显示时间 |
| `on-copy` | `function` | - | 复制回调函数 |
| `on-regenerate` | `function` | - | 重新生成回调函数 |

### 示例

```vue
<template>
  <div class="message-list">
    <ChatBubble
      v-for="msg in messages"
      :key="msg.id"
      :message="msg"
      :show-time="true"
      @copy="handleCopy"
      @regenerate="handleRegenerate"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ChatBubble } from '@tsc-base-fe/ui';
import type { ChatMessage } from '@tsc-base-fe/ai-core';

const messages = ref<ChatMessage[]>([
  {
    id: '1',
    role: 'user',
    content: '你好，请介绍一下自己',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    role: 'assistant',
    content: '我是一个AI助手，可以回答问题、提供建议等。',
    createdAt: new Date().toISOString()
  }
]);

const handleCopy = (content: string) => {
  console.log('复制的内容:', content);
};

const handleRegenerate = (messageId: string) => {
  console.log('重新生成消息:', messageId);
};
</script>
```

## ChatLoading 组件

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `on-cancel` | `function` | - | 取消回调函数 |

### 示例

```vue
<template>
  <div v-if="isLoading" class="loading-container">
    <ChatLoading @cancel="handleCancel" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ChatLoading } from '@tsc-base-fe/ui';

const isLoading = ref(true);

const handleCancel = () => {
  isLoading.value = false;
  console.log('取消加载');
};
</script>
```

## 主题定制

### CSS 变量

可以通过覆盖CSS变量来自定义主题：

```css
:root {
  /* 主色调 */
  --ai-primary-color: #1890ff;
  --ai-primary-hover: #40a9ff;
  --ai-primary-active: #096dd9;
  
  /* 文字颜色 */
  --ai-text-primary: #262626;
  --ai-text-secondary: #8c8c8c;
  --ai-text-disabled: #bfbfbf;
  
  /* 背景颜色 */
  --ai-bg-primary: #ffffff;
  --ai-bg-secondary: #f5f5f5;
  --ai-bg-hover: #fafafa;
  
  /* 边框颜色 */
  --ai-border-color: #d9d9d9;
  --ai-border-radius: 4px;
  
  /* 阴影 */
  --ai-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  /* 消息气泡颜色 */
  --ai-user-bubble-bg: #e6f7ff;
  --ai-assistant-bubble-bg: #f5f5f5;
  
  /* 深色模式变量 */
  --ai-dark-bg-primary: #141414;
  --ai-dark-bg-secondary: #242424;
  --ai-dark-text-primary: #f5f5f5;
  --ai-dark-text-secondary: #a0a0a0;
  --ai-dark-border-color: #333333;
  --ai-dark-user-bubble-bg: #1a293f;
  --ai-dark-assistant-bubble-bg: #2d2d2d;
}
```

## 响应式设计

组件支持响应式布局，可以在不同设备上正常显示：

```css
/* 平板和移动设备适配 */
@media (max-width: 768px) {
  .ai-chat-container {
    width: 100% !important;
    height: 100vh !important;
    border-radius: 0 !important;
  }
  
  .ai-chat-input-container {
    padding: 10px !important;
  }
}
```

## 高级配置

### 自定义消息格式化

可以通过继承组件并重写格式化方法来自定义消息显示：

```vue
<script setup>
import { defineComponent, h } from 'vue';
import { ChatBubble } from '@tsc-base-fe/ui';

export default defineComponent({
  name: 'CustomChatBubble',
  extends: ChatBubble,
  setup(props, { slots }) {
    // 重写格式化内容的方法
    const formatContent = (content) => {
      // 自定义格式化逻辑
      return content.replace(/@([^\s]+)/g, '<span class="mention">@$1</span>');
    };
    
    return () => h(ChatBubble, {
      ...props,
      ...{
        message: {
          ...props.message,
          content: formatContent(props.message.content)
        }
      }
    }, slots);
  }
});
</script>

<style>
.mention {
  color: #1890ff;
  font-weight: 500;
}
</style>
```

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 许可证

MIT