<template>
  <div class="app-container2" :class="{ 'dark': isDarkMode }">
    <header class="app-header">
      <h1>AI 聊天演示</h1>
      <div class="header-controls">
        <select v-model="selectedModel" class="model-select">
          <option :value="ModelType.DEEPSEEK">DeepSeek</option>
          <option :value="ModelType.CUSTOM">自定义 API</option>
        </select>
        <button @click="toggleTheme" class="theme-toggle">
          {{ isDarkMode ? '浅色模式' : '深色模式' }}
        </button>
      </div>
    </header>
    
    <main class="chat-container">
      <div class="messages-container" ref="messagesContainer">
        <div v-for="message in chatHistory" :key="message.id || message.timestamp" class="message-wrapper">
          <div class="message-header">
            <span class="message-role">{{ message.role === 'user' ? '我' : message.role === 'system' ? '系统' : 'AI' }}</span>
            <span class="message-time">{{ formatTime(message.timestamp || Date.now()) }}</span>
          </div>
          <div class="message-content" :class="message.role">
            {{ message.content }}
          </div>
        </div>
        <div v-if="isProcessing" class="loading">
          <div class="loading-spinner"></div>
          <span>AI 正在思考...</span>
        </div>
      </div>
      
      <div class="input-container">
        <textarea 
          v-model="inputMessage" 
          class="message-input" 
          placeholder="请输入您的问题..."
          @keydown.enter.ctrl="handleSend"
          @keydown.enter.meta="handleSend"
          rows="3"
        ></textarea>
        <div class="input-actions">
          <span class="input-hint">按 Ctrl+Enter 发送</span>
          <button 
            @click="handleSend" 
            class="send-button" 
            :disabled="!inputMessage.trim() || isProcessing"
          >
            发送
          </button>
        </div>
      </div>
    </main>
    
    <footer class="app-footer">
      <p>使用 AI-CORE 构建 | 测试版本</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { ModelType,type ModelConfig, ModelFactory, type StreamCallbacks, type StreamChunk, 
  type ChatMessage, type ModelService } from '@tsc-base-fe/ai-core';

// 消息容器引用，用于自动滚动
const messagesContainer = ref<HTMLElement>();

// 输入框消息
const inputMessage = ref('');

// 模型选择
const selectedModel = ref<ModelType>(ModelType.DEEPSEEK); // 默认使用DEEPSEEK模型

// 深色模式
const isDarkMode = ref(false);

// 处理状态
const isProcessing = ref(false);

// AI回复消息
const aiReply = ref('');

// 模型实例引用
const modelService = ref<ModelService | null>(null);

// 聊天历史
const chatHistory = ref<Array<{
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}>>([]);

// 获取环境变量的安全方法
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  try {
    return import.meta.env[key] || defaultValue;
  } catch {
    return defaultValue;
  }
};

// 根据选择的模型获取配置
const getModelConfig = (): ModelConfig => {
  const config: ModelConfig = {};
  
  // 模拟模式配置，为所有模型启用模拟模式，方便测试
  const mockConfig = {
    mockMode: false,
    mockDelay: 50, // 模拟延迟，毫秒
    mockResponse: '这是来自 ai-core 的模拟响应。您的问题已被处理，这是一个示例回答。'
  };
  
  switch (selectedModel.value) {
    case ModelType.DEEPSEEK:
      config.apiKey = getEnvVar('VITE_DEEPSEEK_API_KEY', 'mock-key');
      config.baseUrl = getEnvVar('VITE_DEEPSEEK_API_URL', 'https://api.deepseek.com/v1/chat/completions');
      config.modelName = 'deepseek-chat';
      Object.assign(config, mockConfig); // 启用模拟模式
      break;
    case ModelType.CUSTOM:
      config.apiKey = getEnvVar('VITE_CUSTOM_API_KEY', 'mock-key');
      config.baseUrl = getEnvVar('VITE_CUSTOM_API_URL', 'http://localhost:3000/api/chat');
      Object.assign(config, mockConfig); // 启用模拟模式
      break;
  }
  
  console.log('当前模型配置:', config);
  return config;
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 自动滚动到底部
const scrollToBottom = () => {
  // 使用requestAnimationFrame确保在DOM更新后执行滚动
  requestAnimationFrame(() => {
    if (messagesContainer.value) {
      try {
        const previousScrollTop = messagesContainer.value.scrollTop;
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        console.log('滚动到底部:', previousScrollTop, '->', messagesContainer.value.scrollHeight);
      } catch (error) {
        console.error('滚动失败:', error);
      }
    } else {
      console.warn('消息容器未找到，无法滚动');
    }
  });
};

// 显示系统消息
const showSystemMessage = (message: string) => {
  chatHistory.value.push({
    id: `system-${Date.now()}`,
    role: 'system',
    content: message,
    timestamp: Date.now()
  });
  scrollToBottom();
  saveChatHistory();
};

// 处理发送消息
const handleSend = async () => {
  const message = inputMessage.value.trim();
  if (!message || isProcessing.value) return;
  
  // 清空输入框
  inputMessage.value = '';
  
  // 创建用户消息
  const userMessage = {
    id: `user-${Date.now()}`,
    role: 'user' as const,
    content: message,
    timestamp: Date.now()
  };
  
  // 更新聊天历史
  chatHistory.value.push(userMessage);
  
  // 自动滚动
  scrollToBottom();
  
  try {
    isProcessing.value = true;
    aiReply.value = '';
    
    // 确保模型实例已初始化
    if (!modelService.value || modelService.value.getModelType() !== selectedModel.value) {
      // 销毁旧实例并创建新实例
      if (modelService.value) {
        ModelFactory.destroyInstance(modelService.value.getModelType());
      }
      
      // 创建新的模型实例
      try {
        modelService.value = ModelFactory.getInstance(selectedModel.value, getModelConfig());
        console.log('创建新的模型实例:', selectedModel.value);
      } catch (initError) {
        console.error('创建模型实例失败:', initError);
        throw new Error('初始化AI服务失败，请检查配置');
      }
    }
    
    // 准备请求参数
    const messages: ChatMessage[] = chatHistory.value
      .filter(msg => msg.role !== 'system') // 过滤掉系统消息
      .slice(-10) // 只保留最近10条消息作为上下文
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    // 准备AI回复消息
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessage = {
      id: aiMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now()
    };
    chatHistory.value.push(aiMessage);
    
    // 定义流式回调函数
    const callbacks: StreamCallbacks = {
      onStart: () => {
        console.log('开始接收数据');
      },
      onChunk: (chunk: StreamChunk) => {
        console.log('收到数据块:', chunk, '时间戳:', new Date().toISOString());
        // 处理流式数据块
        if (chunk.content) {
          // 根据实际返回格式调整
          const contentToAdd = typeof chunk.content === 'string' ? chunk.content : (chunk.content.text || '');
          if (contentToAdd) {
            console.log('添加内容:', contentToAdd.length, '字符');
            // 强制Vue响应式更新
            aiMessage.content += contentToAdd;
            // 在Vue 3中，有时需要强制重新渲染，这里使用下一个宏任务来确保更新
            setTimeout(() => {
              // 重新触发响应式
              chatHistory.value = [...chatHistory.value];
              // 每次收到新内容后立即滚动到底部，确保用户能看到最新内容
              scrollToBottom();
            }, 0);
          }
        }
      },
      onComplete: () => {
        console.log('流式请求完成');
        aiReply.value = '';
        isProcessing.value = false;
        scrollToBottom();
        saveChatHistory();
      },
      onError: (error: Error) => {
        console.error('流式请求错误:', error);
        handleError(error);
      }
    };
    
    // 使用流式请求
    await modelService.value.streamRequest(messages, callbacks);
  } catch (error) {
    console.error('发送消息失败:', error);
    handleError(error as Error);
  }
};

// 处理错误
const handleError = (error: Error) => {
  console.error('发生错误:', error);
  isProcessing.value = false;
  
  // 添加错误消息到聊天历史
  showSystemMessage(`发生错误: ${error.message}`);
  
  // 重置模型服务实例
  modelService.value = null;
};

// 切换主题
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  // 保存主题设置到 localStorage
  localStorage.setItem('ai-chat-theme', isDarkMode.value ? 'dark' : 'light');
  // 应用主题到 document
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// 保存聊天历史到localStorage
const saveChatHistory = () => {
  if (chatHistory.value.length > 0) {
    localStorage.setItem('ai-chat-history', JSON.stringify(chatHistory.value.slice(-20))); // 只保存最近20条消息
  }
};

// 监听聊天历史变化
watch(chatHistory, () => {
  saveChatHistory();
}, { deep: true });

// 监听模型切换
watch(selectedModel, () => {
  // 切换模型时重置模型服务实例
  if (modelService.value) {
    ModelFactory.destroyInstance(modelService.value.getModelType());
    modelService.value = null;
  }
  console.log('模型已切换:', selectedModel.value);
  // 显示模型切换提示
  showSystemMessage(`已切换到 ${selectedModel.value === ModelType.DEEPSEEK ? 'Deepseek' : '自定义API'} 模型`);
});

// 组件卸载时清理
onUnmounted(() => {
  saveChatHistory(); // 最后保存一次
  
  // 清理模型实例
  if (modelService.value) {
    try {
      modelService.value.cancel?.(); // 尝试取消可能正在进行的请求
    } catch (e) {
      console.error('取消请求失败:', e);
    }
    ModelFactory.destroyInstance(modelService.value.getModelType());
    modelService.value = null;
  }
});

// 组件挂载时加载主题设置和初始化
onMounted(() => {
  // 加载主题设置
  const savedTheme = localStorage.getItem('ai-chat-theme');
  if (savedTheme) {
    isDarkMode.value = savedTheme === 'dark';
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    isDarkMode.value = true;
  }
  
  // 初始化应用主题
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
  }
  
  // 尝试从localStorage加载聊天历史
  const savedHistory = localStorage.getItem('ai-chat-history');
  if (savedHistory) {
    try {
      chatHistory.value = JSON.parse(savedHistory);
    } catch (e) {
      console.error('加载聊天历史失败:', e);
    }
  }
  
  // 初始化模型服务
  try {
    modelService.value = ModelFactory.getInstance(selectedModel.value, getModelConfig());
    console.log('ChatWindow 组件已挂载，当前模型:', selectedModel.value);
    console.log('配置:', getModelConfig());
  } catch (error) {
    console.error('初始化模型服务失败:', error);
    showSystemMessage('初始化AI服务失败，请检查配置');
  }
  
  // 自动滚动到底部
  scrollToBottom();
});
</script>

<style scoped>
/* 全局样式 */
:root {
  --primary-color: #1890ff;
  --text-color: #262626;
  --bg-color: #ffffff;
  --header-bg: #f5f5f5;
  --border-color: #d9d9d9;
  --footer-bg: #fafafa;
  --user-message-bg: #e6f7ff;
  --assistant-message-bg: #f0f0f0;
  --system-message-bg: #fff2e8;
  transition: all 0.3s ease;
}

.dark {
  --text-color: #f5f5f5;
  --bg-color: #141414;
  --header-bg: #242424;
  --border-color: #333333;
  --footer-bg: #1a1a1a;
  --user-message-bg: #001529;
  --assistant-message-bg: #242424;
  --system-message-bg: #332211;
}

.app-container2 {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  width: 100%;
  color: var(--text-color);
  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-header {
  background-color: var(--header-bg);
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.header-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.model-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.3s;
}

.model-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.theme-toggle {
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.theme-toggle:hover {
  background-color: #40a9ff;
}

/* 聊天容器 */
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 1rem;
  overflow: hidden;
}

/* 消息容器 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 400px;
}

/* 消息包装器 */
.message-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  animation: fadeIn 0.3s ease-in-out;
}

/* 消息头部 */
.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  opacity: 0.7;
}

.message-role {
  font-weight: 600;
}

.message-time {
  font-size: 0.75rem;
}

/* 消息内容 */
.message-content {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  line-height: 1.6;
  word-wrap: break-word;
  font-size: 15px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-content.user {
  background-color: var(--user-message-bg);
  align-self: flex-end;
  margin-left: auto;
  max-width: 80%;
  border-bottom-right-radius: 2px;
}

.message-content.assistant {
  background-color: var(--assistant-message-bg);
  align-self: flex-start;
  margin-right: auto;
  max-width: 80%;
  border-bottom-left-radius: 2px;
}

.message-content.system {
  background-color: var(--system-message-bg);
  color: #f5222d;
  align-self: center;
  max-width: 60%;
  text-align: center;
  font-size: 0.9rem;
  border-radius: 16px;
  padding: 0.5rem 0.75rem;
}

/* 加载动画 */
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color);
  opacity: 0.7;
  font-size: 0.9rem;
  align-self: flex-start;
  margin-top: 0.5rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--border-color);
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 输入容器 */
.input-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.message-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-size: 1rem;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.3s;
}

.message-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-hint {
  font-size: 0.8rem;
  color: var(--text-color);
  opacity: 0.6;
}

.send-button {
  padding: 0.5rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.send-button:hover:not(:disabled) {
  background-color: #40a9ff;
}

.send-button:active:not(:disabled) {
  background-color: #096dd9;
}

.send-button:disabled {
  background-color: var(--border-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.app-footer {
  background-color: var(--footer-bg);
  padding: 1rem 2rem;
  border-top: 1px solid var(--border-color);
  text-align: center;
  color: var(--text-color);
  font-size: 0.9rem;
}

/* 自定义滚动条 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: var(--bg-color);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .header-controls {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .model-select, .theme-toggle {
    flex: 1;
    min-width: 150px;
  }
  
  .chat-container {
    padding: 0.5rem;
  }
  
  .messages-container {
    min-height: 300px;
    padding: 0.75rem;
  }
  
  .message-content {
    font-size: 14px;
  }
  
  .message-content.user,
  .message-content.assistant {
    max-width: 90%;
    padding: 0.6rem 0.8rem;
  }
  
  .message-content.system {
    max-width: 80%;
  }
}
</style>