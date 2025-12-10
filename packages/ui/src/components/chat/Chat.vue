<template>
  <div class="chat-container">
    <!-- 聊天头部 -->
    <div v-if="showHeader" class="chat-header">
      <h3 class="chat-title">{{ title || 'AI助手' }}</h3>
      <div class="chat-actions">
        <button v-if="canUndo" @click="handleUndo" class="header-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 1a9 9 0 0 0-9 9v4l-3-3m3 3l3-3m-9 9h18a5 5 0 0 0 4.546-2.916l-1.732-3.235A5 5 0 0 0 17 13h-1.5"></path>
          </svg>
          撤销
        </button>
        <button v-if="canRedo" @click="handleRedo" class="header-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 23a9 9 0 0 1-9-9V8l-3 3m3-3l3 3m9 9H3a5 5 0 0 1-4.546-2.916L5.732 7.765A5 5 0 0 1 7 8h1.5"></path>
          </svg>
          重做
        </button>
        <button @click="handleClear" class="header-btn danger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          清空
        </button>
      </div>
    </div>

    <!-- 聊天内容区 -->
    <div class="chat-messages" ref="messagesContainer">
      <!-- 系统提示 -->
      <div v-if="systemMessage" class="system-message">
        {{ systemMessage }}
      </div>

      <!-- 消息列表 -->
      <ChatBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :show-actions="message.role === 'assistant'"
        @regenerate="handleRegenerate"
        @copy="handleCopy"
      />

      <!-- 加载中状态 -->
      <ChatLoading
        v-if="status === ChatStatus.GENERATING"
        :show-cancel="true"
        @cancel="handleCancel"
      />

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        <div class="error-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ error.message }}</span>
          <button @click="handleRetry" class="retry-btn">重试</button>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-container">
      <div class="input-wrapper">
        <textarea
          v-model="inputText"
          :disabled="status === ChatStatus.GENERATING"
          class="chat-input"
          placeholder="输入您的问题..."
          @keydown.enter.prevent="handleEnterKey"
          rows="1"
          ref="inputRef"
        ></textarea>
      </div>
      <button
        :disabled="!inputText.trim() || status === ChatStatus.GENERATING"
        @click="handleSend"
        class="send-btn"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import ChatBubble from './ChatBubble.vue';
import ChatLoading from './ChatLoading.vue';
import {
  AIService,
  ChatStateManager,
  ChatStatus,
  type ChatMessage,
  type ModelConfig,
  ModelType,
  createAIService,
  createChatStateManager,
} from '@tsc-base-fe/ai-core';

interface Props {
  modelType?: ModelType;
  modelConfig?: ModelConfig;
  showHeader?: boolean;
  title?: string;
  systemMessage?: string;
  initialMessages?: ChatMessage[];
}

interface Emits {
  (e: 'send', message: ChatMessage): void;
  (e: 'receive', message: ChatMessage): void;
  (e: 'complete', messages: ChatMessage[]): void;
  (e: 'error', error: Error): void;
  (e: 'statusChange', status: ChatStatus): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelType: ModelType.CUSTOM,
  showHeader: true,
  title: '',
  systemMessage: '',
});

const emit = defineEmits<Emits>();

// 响应式数据
const inputText = ref('');
const messagesContainer = ref<HTMLElement>();
const inputRef = ref<HTMLTextAreaElement>();

// 服务实例
const aiService = ref<AIService>(createAIService(props.modelType, props.modelConfig));
const chatStateManager = ref<ChatStateManager>(createChatStateManager());

// 计算属性
const messages = computed(() => chatStateManager.value.getMessages());
const status = computed(() => chatStateManager.value.getStatus());
const error = computed(() => chatStateManager.value.getError());
const canUndo = computed(() => chatStateManager.value['currentHistoryIndex'].value > 0);
const canRedo = computed(() => {
  const manager = chatStateManager.value;
  return manager['currentHistoryIndex'].value < manager['history'].length - 1;
});

// 监听模型配置变化
watch(() => props.modelConfig, (newConfig) => {
  if (newConfig) {
    aiService.value.setConfig(newConfig);
  }
}, { deep: true });

// 初始化
onMounted(() => {
  // 加载初始消息
  if (props.initialMessages && props.initialMessages.length > 0) {
    props.initialMessages.forEach(msg => {
      if (msg.role === 'user') {
        chatStateManager.value.addUserMessage(msg.content);
      } else if (msg.role === 'assistant') {
        chatStateManager.value.addAssistantMessage(msg.content);
      } else if (msg.role === 'system') {
        chatStateManager.value.addSystemMessage(msg.content);
      }
    });
  }
});

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

// 监听消息变化，自动滚动
watch(() => messages.value.length, scrollToBottom);

// 处理发送消息
const handleSend = async () => {
  const content = inputText.value.trim();
  if (!content || status.value === ChatStatus.GENERATING) return;

  // 添加用户消息
  const userMessage = chatStateManager.value.addUserMessage(content);
  emit('send', userMessage);
  
  // 清空输入
  inputText.value = '';
  
  // 发送请求到AI
  await sendToAI();
};

// 处理回车键
const handleEnterKey = (event: KeyboardEvent) => {
  // Shift + Enter 换行，单独 Enter 发送
  if (!event.shiftKey) {
    handleSend();
  }
};

// 发送到AI
const sendToAI = async () => {
  try {
    // 准备请求参数
    const params = {
      messages: chatStateManager.value.getFormattedMessages(),
    };

    // 发送流式请求
    const cancelFn = aiService.value.stream(params, {
      onMessage: (message) => {
        chatStateManager.value.handleSSEMessage(message);
        emit('statusChange', status.value);
      },
      onComplete: () => {
        const lastMessage = messages.value[messages.value.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          emit('receive', lastMessage);
        }
        emit('complete', messages.value);
        emit('statusChange', status.value);
      },
      onError: (err) => {
        chatStateManager.value.setError(err);
        emit('error', err);
        emit('statusChange', status.value);
      },
    });

    // 保存取消函数，以便后续使用
    chatStateManager.value['cancelFn'] = cancelFn;

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    chatStateManager.value.setError(error);
    emit('error', error);
    emit('statusChange', status.value);
  }
};

// 处理取消
const handleCancel = () => {
  aiService.value.cancel();
  chatStateManager.value.cancelGenerating();
  emit('statusChange', status.value);
};

// 处理重试
const handleRetry = () => {
  chatStateManager.value.resetStatus();
  sendToAI();
};

// 处理重新生成
const handleRegenerate = (message: ChatMessage) => {
  // 找到消息的索引
  const index = messages.value.findIndex(m => m.id === message.id);
  if (index !== -1) {
    // 移除该消息之后的所有消息
    messages.value.splice(index);
    // 重置状态并重新发送
    chatStateManager.value.resetStatus();
    sendToAI();
  }
};

// 处理复制
const handleCopy = (message: ChatMessage) => {
  // 可以在这里添加复制成功的提示
  console.log('内容已复制:', message.content);
};

// 处理清空
const handleClear = () => {
  if (confirm('确定要清空所有对话吗？')) {
    chatStateManager.value.clearMessages();
    emit('complete', messages.value);
    emit('statusChange', status.value);
  }
};

// 处理撤销
const handleUndo = () => {
  if (chatStateManager.value.undo()) {
    emit('complete', messages.value);
    emit('statusChange', status.value);
  }
};

// 处理重做
const handleRedo = () => {
  if (chatStateManager.value.redo()) {
    emit('complete', messages.value);
    emit('statusChange', status.value);
  }
};

// 暴露方法给父组件
defineExpose({
  sendMessage: handleSend,
  cancel: handleCancel,
  retry: handleRetry,
  clear: handleClear,
  undo: handleUndo,
  redo: handleRedo,
  addMessage: (message: ChatMessage) => {
    if (message.role === 'user') {
      chatStateManager.value.addUserMessage(message.content);
    } else if (message.role === 'assistant') {
      chatStateManager.value.addAssistantMessage(message.content);
    } else if (message.role === 'system') {
      chatStateManager.value.addSystemMessage(message.content);
    }
  },
  getMessages: () => messages.value,
  getStatus: () => status.value,
});
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.chat-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.chat-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: transparent;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.header-btn.danger:hover {
  background-color: #fee2e2;
  border-color: #f87171;
  color: #b91c1c;
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.system-message {
  padding: 12px 16px;
  background-color: #f0f9ff;
  border-left: 4px solid #3b82f6;
  border-radius: 8px;
  color: #1d4ed8;
  font-size: 14px;
  margin-bottom: 16px;
}

.error-message {
  margin-top: 16px;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b91c1c;
  font-size: 14px;
}

.retry-btn {
  margin-left: auto;
  padding: 6px 12px;
  background-color: #ef4444;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #dc2626;
}

.chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.input-wrapper {
  flex: 1;
  position: relative;
}

.chat-input {
  width: 100%;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  font-size: 16px;
  font-family: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #3b82f6;
}

.chat-input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #3b82f6;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background-color: #2563eb;
  transform: scale(1.05);
}

.send-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>