<template>
  <div class="chat-bubble" :class="{ 'user': message.role === 'user', 'assistant': message.role === 'assistant' }">
    <div class="chat-avatar">
      <svg v-if="message.role === 'user'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"></path>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </div>
    <div class="chat-content">
      <div class="chat-message" v-html="formattedContent"></div>
      <div v-if="message.timestamp" class="chat-time">
        {{ formatTime(message.timestamp) }}
      </div>
    </div>
    <div v-if="showActions" class="chat-actions">
      <button @click="onRegenerate" class="action-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
      <button @click="onCopy" class="action-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { ChatMessage } from '@tsc-base-fe/ai-core';

interface Props {
  message: ChatMessage;
  showActions?: boolean;
}

interface Emits {
  (e: 'regenerate', message: ChatMessage): void;
  (e: 'copy', message: ChatMessage): void;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: false,
});

const emit = defineEmits<Emits>();

// 格式化消息内容（支持简单的Markdown）
const formattedContent = computed(() => {
  let content = props.message.content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  
  // 格式化代码块
  content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  return content;
});

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 重新生成
const onRegenerate = () => {
  emit('regenerate', props.message);
};

// 复制内容
const onCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content);
    emit('copy', props.message);
  } catch (error) {
    console.error('复制失败:', error);
  }
};
</script>

<style scoped>
.chat-bubble {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.chat-bubble.user {
  flex-direction: row-reverse;
}

.chat-bubble.assistant {
  flex-direction: row;
}

.chat-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user .chat-avatar {
  background-color: #3b82f6;
  color: white;
}

.assistant .chat-avatar {
  background-color: #10b981;
  color: white;
}

.chat-content {
  flex: 1;
  max-width: calc(100% - 44px);
}

.user .chat-content {
  text-align: right;
}

.chat-message {
  padding: 12px 16px;
  border-radius: 16px;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.user .chat-message {
  background-color: #3b82f6;
  color: white;
}

.assistant .chat-message {
  background-color: #f3f4f6;
  color: #374151;
}

.chat-time {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.chat-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.chat-bubble:hover .chat-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #6b7280;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.user .action-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

/* 代码样式 */
:deep(pre) {
  background-color: #1f2937;
  color: #f3f4f6;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  line-height: 1.4;
}

:deep(code) {
  background-color: #e5e7eb;
  color: #1f2937;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
}

:deep(pre code) {
  background: none;
  padding: 0;
  border-radius: 0;
  color: inherit;
}
</style>