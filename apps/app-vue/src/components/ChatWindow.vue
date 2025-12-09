<template>
  <div class="chat-window">
    <!-- 头部控制栏 -->
    <div class="chat-header">
      <div class="header-left">
        <h2 class="title">{{ title }}</h2>
        <div class="state-indicator" :class="currentState">
          <span class="state-dot"></span>
          <span class="state-text">{{ stateDisplayText }}</span>
        </div>
      </div>
      
      <div class="header-right">
        <div class="header-controls">
          <button 
            v-if="isProcessing"
            @click="handleStop"
            class="control-btn stop-btn"
            title="停止生成"
          >
            <span class="btn-icon">⏹️</span>
            <span class="btn-text">停止</span>
          </button>
          
          <button 
            @click="handleClear"
            class="control-btn clear-btn"
            title="清空对话"
          >
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">清空</span>
          </button>
          
          <button 
            @click="handleReset"
            class="control-btn reset-btn"
            title="重置对话"
          >
            <span class="btn-icon">🔄</span>
            <span class="btn-text">重置</span>
          </button>
          
          <button 
            v-if="isError"
            @click="handleRetry"
            class="control-btn retry-btn"
            title="重试"
          >
            <span class="btn-icon">🔁</span>
            <span class="btn-text">重试</span>
          </button>
        </div>
        
        <div class="config-toggle" @click="showConfig = !showConfig">
          <span class="toggle-icon">⚙️</span>
          <span class="toggle-text">配置</span>
        </div>
      </div>
    </div>

    <!-- 配置面板 -->
    <div v-if="showConfig" class="config-panel">
      <div class="config-section">
        <h3>AI配置</h3>
        <div class="config-grid">
          <div class="config-item">
            <label for="model">模型:</label>
            <select id="model" v-model="localConfig.model" @change="updateConfig">
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="claude-2">Claude 2</option>
              <option value="test-model">测试模型</option>
            </select>
          </div>
          
          <div class="config-item">
            <label for="temperature">温度:</label>
            <div class="slider-container">
              <input 
                id="temperature"
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                v-model.number="localConfig.temperature"
                @change="updateConfig"
                class="slider"
              >
              <span class="slider-value">{{ localConfig.temperature.toFixed(1) }}</span>
            </div>
          </div>
          
          <div class="config-item">
            <label for="systemPrompt">系统提示:</label>
            <textarea 
              id="systemPrompt"
              v-model="localConfig.systemPrompt"
              @change="updateConfig"
              rows="2"
              placeholder="输入系统提示..."
            ></textarea>
          </div>
          
          <div class="config-item">
            <label for="endpoint">API端点:</label>
            <input 
              id="endpoint"
              type="text"
              v-model="localConfig.apiEndpoint"
              @change="updateConfig"
              placeholder="/api/chat/stream"
            >
          </div>
        </div>
      </div>
      
      <div class="config-section">
        <h3>测试工具</h3>
        <div class="test-buttons">
          <button @click="simulateToolCall" class="test-btn">
            <span class="test-icon">🔧</span>
            模拟工具调用
          </button>
          
          <button @click="simulateThinking" class="test-btn">
            <span class="test-icon">💭</span>
            模拟思考过程
          </button>
          
          <button @click="simulateError" class="test-btn">
            <span class="test-icon">⚠️</span>
            模拟错误
          </button>
          
          <button @click="runFullTest" class="test-btn primary">
            <span class="test-icon">🧪</span>
            运行完整测试
          </button>
        </div>
      </div>
    </div>

    <!-- 消息区域 -->
    <div class="chat-messages" ref="messagesContainer">
      <!-- 欢迎消息 -->
      <div v-if="context.conversation.messages.length === 0" class="welcome-message">
        <div class="welcome-content">
          <div class="welcome-icon">🤖</div>
          <h3>欢迎使用AI对话状态机</h3>
          <p>这是一个基于SSE流式响应和状态机的AI对话系统演示。</p>
          <div class="welcome-features">
            <div class="feature">
              <span class="feature-icon">⚡</span>
              <span>实时流式响应</span>
            </div>
            <div class="feature">
              <span class="feature-icon">🧠</span>
              <span>AI思考过程</span>
            </div>
            <div class="feature">
              <span class="feature-icon">🔧</span>
              <span>工具调用演示</span>
            </div>
            <div class="feature">
              <span class="feature-icon">📊</span>
              <span>状态可视化</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div 
        v-for="(group, index) in groupedMessages"
        :key="`group-${index}`"
        :class="['message-group', group.type]"
      >
        <!-- 用户消息组 -->
        <div v-if="group.type === 'user'" class="user-group">
          <div class="message-avatar">
            <div class="avatar user-avatar">👤</div>
          </div>
          <div class="message-content-container">
            <div class="message-time">
              {{ formatTime(group.timestamp) }}
            </div>
            <div class="message-bubble user-bubble">
              <div class="bubble-content">
                {{ group.messages[0].content }}
              </div>
            </div>
          </div>
        </div>

        <!-- AI助手消息组 -->
        <div v-else-if="group.type === 'assistant'" class="assistant-group">
          <div class="message-avatar">
            <div class="avatar ai-avatar">🤖</div>
          </div>
          <div class="message-content-container">
            <div class="message-header">
              <span class="message-sender">AI助手</span>
              <span class="message-time">
                {{ formatTime(group.timestamp) }}
              </span>
            </div>
            
            <div class="message-bubble ai-bubble">
              <div 
                v-for="message in group.messages"
                :key="message.id"
                class="bubble-content"
                :class="{ 'streaming': message.status === 'sending' }"
              >
                <!-- 显示事件类型标签 -->
                <div v-if="message.eventType" class="event-tag">
                  <span class="event-tag-icon">{{ getEventIcon(message.eventType) }}</span>
                  <span class="event-tag-text">{{ formatEventType(message.eventType) }}</span>
                </div>
                
                <!-- 消息内容 -->
                <div class="message-text">
                  {{ message.content }}
                </div>
                
                <!-- 消息元数据 -->
                <div v-if="message.metadata" class="message-metadata">
                  <template v-if="message.metadata.duration">
                    <div class="metadata-item">
                      <span class="metadata-icon">⏱️</span>
                      <span class="metadata-text">{{ message.metadata.duration }}ms</span>
                    </div>
                  </template>
                  <template v-if="message.metadata.totalTokens">
                    <div class="metadata-item">
                      <span class="metadata-icon">🔢</span>
                      <span class="metadata-text">{{ message.metadata.totalTokens }} tokens</span>
                    </div>
                  </template>
                </div>
                
                <!-- 发送状态 -->
                <div v-if="message.status === 'sending'" class="sending-indicator">
                  <span class="sending-dots"></span>
                  <span>正在输入...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 思考消息组 -->
        <div v-else-if="group.type === 'thinking'" class="thinking-group">
          <div class="message-avatar">
            <div class="avatar thinking-avatar">💭</div>
          </div>
          <div class="message-content-container">
            <div class="message-header">
              <span class="message-sender">思考过程</span>
              <span class="message-time">
                {{ formatTime(group.timestamp) }}
              </span>
            </div>
            
            <div class="thinking-container">
              <div class="thinking-header">
                <span class="thinking-icon">🧠</span>
                <span class="thinking-title">AI正在思考...</span>
              </div>
              
              <div class="thinking-content">
                <!-- 实时思考流 -->
                <div v-if="currentThinking && isThinking" class="real-time-thinking">
                  <div class="thinking-text">{{ currentThinking }}</div>
                  <div class="thinking-animation">
                    <span class="thinking-dot"></span>
                    <span class="thinking-dot"></span>
                    <span class="thinking-dot"></span>
                  </div>
                </div>
                
                <!-- 历史思考记录 -->
                <div v-else class="thinking-history">
                  <div 
                    v-for="(chunk, idx) in recentThinkingChunks"
                    :key="idx"
                    class="thinking-chunk"
                  >
                    {{ chunk.text }}
                  </div>
                </div>
              </div>
              
              <!-- 思考元数据 -->
              <div v-if="thinkingStream.length > 0" class="thinking-stats">
                <span class="stat-item">
                  <span class="stat-icon">📝</span>
                  共{{ thinkingStream.length }}条思考记录
                </span>
                <span v-if="recentThinking" class="stat-item">
                  <span class="stat-icon">📏</span>
                  长度: {{ recentThinking.length }}字符
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 工具消息组 -->
        <div v-else-if="group.type === 'tool'" class="tool-group">
          <div class="message-avatar">
            <div class="avatar tool-avatar">🔧</div>
          </div>
          <div class="message-content-container">
            <div class="message-header">
              <span class="message-sender">工具调用</span>
              <span class="message-time">
                {{ formatTime(group.timestamp) }}
              </span>
            </div>
            
            <div class="tool-container">
              <div 
                v-for="message in group.messages"
                :key="message.id"
                class="tool-call"
              >
                <div class="tool-header">
                  <div class="tool-info">
                    <span class="tool-icon">{{ getToolIcon(message.toolName) }}</span>
                    <span class="tool-name">{{ message.toolName || '未知工具' }}</span>
                    <span class="tool-status" :class="getToolStatus(message)">
                      {{ getToolStatusText(message) }}
                    </span>
                  </div>
                  
                  <div v-if="message.eventType === 'TOOL_START'" class="tool-params">
                    <span class="params-label">参数:</span>
                    <pre class="params-content">{{ JSON.stringify(message.metadata?.params || {}, null, 2) }}</pre>
                  </div>
                  
                  <div v-if="message.eventType === 'TOOL_END' && message.metadata?.result" class="tool-result">
                    <span class="result-label">结果:</span>
                    <pre class="result-content">{{ JSON.stringify(message.metadata.result, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 系统消息组 -->
        <div v-else class="system-group">
          <div class="system-message">
            <div class="system-icon">ℹ️</div>
            <div class="system-content">
              {{ group.messages.map(m => m.content).join(' ') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 正在处理指示器 -->
      <div v-if="isProcessing" class="processing-indicator">
        <div v-if="isConnecting" class="connecting-indicator">
          <div class="connecting-spinner"></div>
          <div class="connecting-text">正在连接到AI服务...</div>
        </div>
        
        <div v-if="isStreaming && !currentThinking" class="streaming-indicator">
          <div class="streaming-spinner"></div>
          <div class="streaming-text">AI正在生成回复...</div>
          <div v-if="progressPercentage > 0" class="streaming-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ Math.round(progressPercentage) }}%
              <span v-if="estimatedTimeRemaining" class="eta">
                (预计剩余: {{ estimatedTimeRemaining }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <!-- 错误状态 -->
      <div v-if="isError" class="error-state">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <div class="error-message">
            <h4>对话出现错误</h4>
            <p>{{ context.metadata?.lastError || '未知错误' }}</p>
          </div>
          <div class="error-actions">
            <button @click="handleRetry" class="error-btn retry-btn">重试</button>
            <button @click="handleReset" class="error-btn reset-btn">重置</button>
          </div>
        </div>
      </div>

      <!-- 正常输入 -->
      <form @submit.prevent="handleSubmit" class="input-form">
        <div class="input-wrapper">
          <textarea
            ref="inputTextarea"
            v-model="inputMessage"
            :disabled="!canSendMessage"
            :placeholder="inputPlaceholder"
            rows="1"
            class="message-input"
            @keydown.enter.exact.prevent="handleSubmit"
            @keydown.enter.shift.exact="handleNewLine"
            @input="adjustTextareaHeight"
          ></textarea>
          
          <div class="input-actions">
            <div class="input-stats">
              <span v-if="inputMessage.length > 0" class="char-count">
                {{ inputMessage.length }}字符
              </span>
              <span v-if="isProcessing" class="processing-status">
                {{ processingStatusText }}
              </span>
            </div>
            
            <div class="action-buttons">
              <button
                type="button"
                @click="handleQuickPrompt"
                :disabled="isProcessing"
                class="action-btn quick-btn"
                title="快速提问"
              >
                <span class="btn-icon">⚡</span>
              </button>
              
              <button
                type="submit"
                :disabled="!canSendMessage || !inputMessage.trim()"
                class="action-btn send-btn"
                :class="{ 'sending': isProcessing }"
              >
                <span v-if="isProcessing" class="btn-icon">⏳</span>
                <span v-else class="btn-icon">📤</span>
                <span class="btn-text">{{ isProcessing ? '发送中...' : '发送' }}</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 快捷提问建议 -->
        <div v-if="!isProcessing && inputMessage.length === 0" class="quick-suggestions">
          <span class="suggestions-label">试试问这些:</span>
          <div class="suggestion-buttons">
            <button
              v-for="(suggestion, index) in quickSuggestions"
              :key="index"
              @click="useSuggestion(suggestion)"
              class="suggestion-btn"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- 底部状态栏 -->
    <div class="chat-footer">
      <div class="footer-left">
        <div class="footer-stats">
          <span class="stat-item">
            <span class="stat-icon">💬</span>
            消息: {{ context.conversation.messages.length }}
          </span>
          <span class="stat-item">
            <span class="stat-icon">🧠</span>
            思考: {{ thinkingStream.length }}
          </span>
          <span class="stat-item">
            <span class="stat-icon">🔧</span>
            工具: {{ toolCalls.length }}
          </span>
        </div>
      </div>
      
      <div class="footer-right">
        <div class="debug-toggle" @click="showDebug = !showDebug">
          <span class="debug-icon">🐛</span>
          <span class="debug-text">调试信息</span>
          <span class="debug-arrow">{{ showDebug ? '▲' : '▼' }}</span>
        </div>
      </div>
    </div>

    <!-- 调试面板 -->
    <div v-if="showDebug" class="debug-panel">
      <div class="debug-header">
        <h4>状态机调试信息</h4>
        <button @click="copyDebugInfo" class="copy-btn" title="复制调试信息">
          📋
        </button>
      </div>
      
      <div class="debug-content">
        <div class="debug-section">
          <h5>当前状态</h5>
          <div class="state-grid">
            <div class="state-item">
              <span class="state-label">状态:</span>
              <span class="state-value" :class="currentState">{{ currentState }}</span>
            </div>
            <div class="state-item">
              <span class="state-label">可发送:</span>
              <span class="state-value" :class="{ 'true': canSendMessage, 'false': !canSendMessage }">
                {{ canSendMessage ? '是' : '否' }}
              </span>
            </div>
            <div class="state-item">
              <span class="state-label">最后事件:</span>
              <span class="state-value">{{ lastEventType || '无' }}</span>
            </div>
            <div class="state-item">
              <span class="state-label">流式状态:</span>
              <span class="state-value" :class="{ 'true': isStreamActive, 'false': !isStreamActive }">
                {{ isStreamActive ? '活动' : '空闲' }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="debug-section">
          <h5>进度信息</h5>
          <pre class="debug-pre">{{ JSON.stringify(streamProgress, null, 2) }}</pre>
        </div>
        
        <div class="debug-section">
          <h5>最近思考</h5>
          <div class="recent-thinking">
            <pre v-if="recentThinking">{{ recentThinking }}</pre>
            <div v-else class="no-thinking">暂无思考记录</div>
          </div>
        </div>
        
        <div class="debug-section">
          <h5>状态机统计</h5>
          <pre class="debug-pre">{{ JSON.stringify(getStats(), null, 2) }}</pre>
        </div>
        
        <div class="debug-section">
          <h5>工具调用历史</h5>
          <div v-if="toolCalls.length > 0" class="tool-history">
            <div 
              v-for="(tool, index) in toolCalls.slice(-3)"
              :key="index"
              class="tool-history-item"
            >
              <span class="tool-history-name">{{ tool.name }}</span>
              <span class="tool-history-time">{{ formatTime(tool.timestamp) }}</span>
              <span class="tool-history-event">{{ formatEventType(tool.eventType || '') }}</span>
            </div>
          </div>
          <div v-else class="no-tools">暂无工具调用记录</div>
        </div>
        
        <div class="debug-section">
          <h5>原始上下文</h5>
          <div class="context-view">
            <div class="context-tabs">
              <button 
                v-for="tab in contextTabs"
                :key="tab"
                @click="activeContextTab = tab"
                :class="{ 'active': activeContextTab === tab }"
                class="context-tab"
              >
                {{ tab }}
              </button>
            </div>
            
            <div class="context-content">
              <pre v-if="activeContextTab === 'conversation'">{{ JSON.stringify(context.conversation, null, 2) }}</pre>
              <pre v-if="activeContextTab === 'config'">{{ JSON.stringify(context.config, null, 2) }}</pre>
              <pre v-if="activeContextTab === 'metadata'">{{ JSON.stringify(context.metadata, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import type { SSEMessage, EventType } from '@ai-sdk/ai-core';
import { useChatStateMachine } from '@ai-sdk/ai-core';

// Props
interface Props {
  title?: string;
  endpoint?: string;
  initialMessage?: string;
  showWelcome?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'AI对话状态机演示',
  endpoint: '/api/chat/stream',
  initialMessage: '',
  showWelcome: true
});

// 响应式数据
const inputMessage = ref(props.initialMessage);
const showConfig = ref(false);
const showDebug = ref(false);
const messagesContainer = ref<HTMLElement>();
const inputTextarea = ref<HTMLTextAreaElement>();
const activeContextTab = ref('conversation');

// 本地配置
const localConfig = ref({
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  systemPrompt: '你是一个有用的AI助手，请用中文回答。可以思考，可以调用工具，请展示完整的过程。',
  apiEndpoint: props.endpoint
});

// 使用状态机
const {
  currentState,
  context,
  isIdle,
  isConnecting,
  isStreaming,
  isThinking,
  isToolExecuting,
  isWaitingTool,
  isError,
  isCompleted,
  isProcessing,
  canSendMessage,
  currentTool,
  currentThinking,
  lastEventType,
  groupedMessages,
  thinkingStream,
  recentThinking,
  toolCalls,
  isStreamActive,
  progressPercentage,
  estimatedTimeRemaining,
  debugInfo,
  streamProgress,
  
  sendMessage,
  stopStream,
  retry,
  reset,
  updateConfig: updateConfigFn,
  clearConversation,
  simulateTestStream,
  triggerSSEMessage,
  getStats
} = useChatStateMachine({
  endpoint: props.endpoint,
  initialConfig: localConfig.value,
  onStateChange: (state) => {
    console.log('State changed to:', state);
    scrollToBottom();
  },
  onStreamStart: () => {
    console.log('Stream started');
  },
  onStreamEnd: () => {
    console.log('Stream ended');
  },
  onError: (error) => {
    console.error('Chat error:', error);
  },
  onProgress: (progress) => {
    console.log('Stream progress:', progress);
  },
  onThinkingUpdate: (thinking) => {
    console.log('Thinking updated:', thinking);
  },
  onToolCall: (tool) => {
    console.log('Tool called:', tool);
  },
  onToolResult: (tool) => {
    console.log('Tool result:', tool);
  }
});

// 计算属性
const stateDisplayText = computed(() => {
  const stateMap: Record<string, string> = {
    idle: '等待输入',
    connecting: '连接中',
    streaming: '流式响应',
    thinking: '思考中',
    tool_executing: '执行工具',
    waiting_tool: '等待工具',
    error: '错误',
    completed: '完成'
  };
  return stateMap[currentState.value] || currentState.value;
});

const processingStatusText = computed(() => {
  if (isConnecting.value) return '正在连接...';
  if (isThinking.value) return '思考中...';
  if (isToolExecuting.value) return '执行工具...';
  if (isStreaming.value) return '生成回复...';
  return '处理中...';
});

const inputPlaceholder = computed(() => {
  if (!canSendMessage.value) {
    return processingStatusText.value;
  }
  return '输入消息... (Enter发送，Shift+Enter换行)';
});

const recentThinkingChunks = computed(() => {
  return thinkingStream.value.slice(-10);
});

const quickSuggestions = computed(() => [
  '你好，请介绍一下自己',
  '什么是状态机？',
  '模拟一个工具调用过程',
  '帮我写一个Vue组件',
  '思考一下如何优化代码'
]);

const contextTabs = computed(() => ['conversation', 'config', 'metadata']);

// 方法
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatEventType = (eventType: EventType | string) => {
  const eventMap: Record<string, string> = {
    START: '开始',
    TOOL_START: '工具开始',
    TOOL: '工具执行',
    TOOL_END: '工具结束',
    THINK_START: '思考开始',
    THINK: '思考',
    THINK_END: '思考结束',
    ECHARTS_START: '图表开始',
    ECHARTS: '图表',
    ECHARTS_END: '图表结束',
    INTENTION_RECOGNIZE: '意图识别',
    RETRIEVE: '检索',
    TEXT: '文本',
    END: '结束',
    ERROR: '错误'
  };
  return eventMap[eventType] || eventType;
};

const getEventIcon = (eventType: EventType | string) => {
  const iconMap: Record<string, string> = {
    START: '🚀',
    TOOL_START: '🔧',
    TOOL: '⚙️',
    TOOL_END: '✅',
    THINK_START: '💭',
    THINK: '🧠',
    THINK_END: '✨',
    TEXT: '💬',
    END: '🏁',
    ERROR: '⚠️'
  };
  return iconMap[eventType] || '📝';
};

const getToolIcon = (toolName?: string) => {
  if (!toolName) return '🔧';
  
  const iconMap: Record<string, string> = {
    search: '🔍',
    calculator: '🧮',
    weather: '☁️',
    translate: '🌐',
    database: '🗄️',
    api: '🔌',
    file: '📄'
  };
  
  const key = toolName.toLowerCase();
  return iconMap[key] || '🔧';
};

const getToolStatus = (message: any) => {
  if (message.eventType === 'TOOL_START') return 'started';
  if (message.eventType === 'TOOL') return 'executing';
  if (message.eventType === 'TOOL_END') return 'completed';
  return 'unknown';
};

const getToolStatusText = (message: any) => {
  const status = getToolStatus(message);
  const statusMap: Record<string, string> = {
    started: '开始',
    executing: '执行中',
    completed: '完成',
    unknown: '未知'
  };
  return statusMap[status];
};

const adjustTextareaHeight = () => {
  nextTick(() => {
    const textarea = inputTextarea.value;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  });
};

const scrollToBottom = () => {
  nextTick(() => {
    const container = messagesContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
};

const handleSubmit = async () => {
  if (!canSendMessage.value || !inputMessage.value.trim()) return;
  
  const message = inputMessage.value.trim();
  inputMessage.value = '';
  
  await sendMessage(message);
  adjustTextareaHeight();
};

const handleNewLine = () => {
  inputMessage.value += '\n';
  adjustTextareaHeight();
};

const handleStop = () => {
  stopStream();
};

const handleClear = () => {
  clearConversation();
};

const handleReset = async () => {
  await reset();
  inputMessage.value = '';
};

const handleRetry = async () => {
  await retry();
};

const handleQuickPrompt = () => {
  const prompts = [
    '请详细解释一下状态机的工作原理',
    '帮我写一个React组件示例',
    '什么是SSE？和WebSocket有什么区别？',
    '模拟一个完整的对话流程，包含思考和工具调用'
  ];
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  inputMessage.value = randomPrompt || '';
};

const useSuggestion = (suggestion: string) => {
  inputMessage.value = suggestion || '';
};

const updateConfig = () => {
  updateConfigFn(localConfig.value);
};

// 测试方法
const simulateToolCall = () => {
  const toolMessages: SSEMessage[] = [
    {
      eventType: 'TOOL_START',
      eventSn: 0,
      content: { text: '' },
      metadata: {
        toolName: 'search_database',
        toolParams: { query: 'Vue状态机最佳实践', limit: 10 }
      }
    },
    {
      eventType: 'TOOL',
      eventSn: 0,
      content: { text: '正在搜索数据库...找到5条相关记录' }
    },
    {
      eventType: 'TOOL_END',
      eventSn: 0,
      content: { text: '' },
      metadata: {
        toolResult: {
          success: true,
          data: [
            'Vue状态机使用XState库实现',
            '状态机应该保持纯净，不包含UI逻辑',
            '使用TypeScript确保类型安全',
            '状态转移应该是可预测的',
            '错误处理是状态机设计的关键部分'
          ]
        }
      }
    }
  ];
  
  toolMessages.forEach(msg => {
    setTimeout(() => triggerSSEMessage(msg), 100);
  });
};

const simulateThinking = () => {
  const thinkMessages: SSEMessage[] = [
    {
      eventType: 'THINK_START',
      eventSn: 0,
      content: { text: '<think>' }
    },
    {
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '\n用户想要测试思考过程。\n' }
    },
    {
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '这是一个模拟的思考过程，用于演示状态机如何处理AI的内部思考。\n' }
    },
    {
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '思考过程可以展示AI的推理链条，帮助用户理解AI是如何得出答案的。\n' }
    },
    {
      eventType: 'THINK_END',
      eventSn: 0,
      content: { text: '</think>' }
    },
    {
      eventType: 'TEXT',
      eventSn: 0,
      content: { text: '这是一个思考过程的演示。AI通过内部推理来回答问题，这个过程对用户是透明的。' }
    }
  ];
  
  thinkMessages.forEach((msg, index) => {
    setTimeout(() => triggerSSEMessage(msg), index * 200);
  });
};

const simulateError = () => {
  triggerSSEMessage({
    eventType: 'ERROR',
    eventSn: 0,
    content: { text: '模拟错误：这是一个测试用的错误消息，用于演示错误处理机制。' }
  });
};

const runFullTest = async () => {
  console.log('开始完整测试...');
  
  // 发送测试消息
  await sendMessage('请执行完整测试流程');
  
  // 延迟模拟各种事件
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'START',
      eventSn: 0,
      content: { text: '开始完整测试流程...' }
    });
  }, 500);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'THINK_START',
      eventSn: 0,
      content: { text: '<think>' }
    });
  }, 1000);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '\n开始分析测试需求...\n' }
    });
  }, 1500);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '这是一个完整的测试流程演示。\n' }
    });
  }, 2000);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'THINK',
      eventSn: 0,
      content: { text: '将展示思考、工具调用和回复的完整过程。\n' }
    });
  }, 2500);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'THINK_END',
      eventSn: 0,
      content: { text: '</think>' }
    });
  }, 3000);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'TOOL_START',
      eventSn: 0,
      content: { text: '' },
      metadata: {
        toolName: 'test_tool',
        toolParams: { test: true, mode: 'full_demo' }
      }
    });
  }, 3500);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'TOOL',
      eventSn: 0,
      content: { text: '执行测试工具...进度50%' }
    });
  }, 4000);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'TOOL_END',
      eventSn: 0,
      content: { text: '' },
      metadata: {
        toolResult: {
          success: true,
          message: '测试工具执行完成',
          data: { sample: 'test data' }
        }
      }
    });
  }, 4500);
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'TEXT',
      eventSn: 0,
      content: { text: '测试流程第一部分完成。现在展示流式文本回复：\n\n' }
    });
  }, 5000);
  
  const textParts = [
    '这是一个',
    '流式文本',
    '回复的',
    '演示。',
    '每个部分',
    '都会',
    '逐步显示。',
    '\n\n',
    '状态机',
    '确保',
    '整个流程',
    '的',
    '可控性',
    '和',
    '可预测性。'
  ];
  
  textParts.forEach((part, index) => {
    setTimeout(() => {
      triggerSSEMessage({
        eventType: 'TEXT',
        eventSn: 0,
        content: { text: part }
      });
    }, 5500 + index * 200);
  });
  
  setTimeout(() => {
    triggerSSEMessage({
      eventType: 'END',
      eventSn: 0,
      content: { text: '\n\n完整测试流程结束！' },
      metadata: {
        duration: 8000,
        messageId: 'test-demo-123',
        promptTokens: 150,
        totalTokens: 300,
        completionTokens: 150
      }
    });
  }, 5500 + textParts.length * 200);
};

const copyDebugInfo = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(debugInfo.value, null, 2));
    alert('调试信息已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
  }
};

// 生命周期
onMounted(() => {
  scrollToBottom();
  adjustTextareaHeight();
});

// 监听输入变化
watch(inputMessage, adjustTextareaHeight);

// 监听消息变化，滚动到底部
watch(() => context.value.conversation.messages.length, () => {
  scrollToBottom();
});

// 暴露给父组件的接口
const exposedApi = {
  // 状态
  currentState,
  isProcessing,
  isStreaming,
  isThinking,
  isToolExecuting,
  canSendMessage,
  
  // 数据
  context,
  groupedMessages,
  thinkingStream,
  toolCalls,
  
  // 进度
  progressPercentage,
  estimatedTimeRemaining,
  isStreamActive,
  
  // 方法
  sendMessage,
  stopStream,
  reset,
  retry,
  simulateTestStream,
  triggerSSEMessage,
  
  // 调试信息
  getDebugInfo: () => ({
    state: currentState.value,
    canSendMessage: canSendMessage.value,
    isStreaming: isStreaming.value,
    isThinking: isThinking.value,
    isToolExecuting: isToolExecuting.value,
    lastEventType: lastEventType.value,
    messageCount: context.value.conversation.messages.length,
    thinkingChunks: thinkingStream.value.length,
    toolCalls: toolCalls.value.length,
    conversationId: context.value.conversation.id,
    progress: {
      percentage: progressPercentage.value,
      chunks: `${streamProgress.value.receivedChunks}/${streamProgress.value.totalChunks}`,
      estimatedTime: estimatedTimeRemaining.value
    }
  }),
  
  // 统计信息
  getStats: () => ({
    state: currentState.value,
    messageCount: context.value.conversation.messages.length,
    thinkingChunks: thinkingStream.value.length,
    activeTools: context.value.activeTools.length,
    isStreaming: context.value.isStreaming,
    lastEvent: context.value.lastEventType,
    conversationId: context.value.conversation.id
  })
};

// 暴露API给父组件
defineExpose(exposedApi);
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 头部样式 */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.state-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.state-indicator.idle .state-dot { background: #10b981; }
.state-indicator.connecting .state-dot { background: #f59e0b; animation: pulse 1.5s infinite; }
.state-indicator.streaming .state-dot { background: #3b82f6; animation: pulse 1s infinite; }
.state-indicator.thinking .state-dot { background: #8b5cf6; animation: pulse 0.8s infinite; }
.state-indicator.tool_executing .state-dot { background: #ef4444; animation: pulse 0.8s infinite; }
.state-indicator.waiting_tool .state-dot { background: #f97316; }
.state-indicator.error .state-dot { background: #dc2626; }
.state-indicator.completed .state-dot { background: #10b981; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.stop-btn { background: rgba(239, 68, 68, 0.3); }
.stop-btn:hover { background: rgba(239, 68, 68, 0.4); }

.clear-btn { background: rgba(107, 114, 128, 0.3); }
.clear-btn:hover { background: rgba(107, 114, 128, 0.4); }

.reset-btn { background: rgba(245, 158, 11, 0.3); }
.reset-btn:hover { background: rgba(245, 158, 11, 0.4); }

.retry-btn { background: rgba(16, 185, 129, 0.3); }
.retry-btn:hover { background: rgba(16, 185, 129, 0.4); }

.config-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.config-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 配置面板 */
.config-panel {
  padding: 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { max-height: 0; opacity: 0; }
  to { max-height: 500px; opacity: 1; }
}

.config-section {
  margin-bottom: 20px;
}

.config-section:last-child {
  margin-bottom: 0;
}

.config-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.config-item select,
.config-item input[type="text"],
.config-item textarea {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.config-item select:focus,
.config-item input[type="text"]:focus,
.config-item textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.slider-value {
  min-width: 30px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
}

.test-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.test-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.test-btn:hover {
  background: #f3f4f6;
  transform: translateY(-1px);
}

.test-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.test-btn.primary:hover {
  background: #2563eb;
}

.test-icon {
  font-size: 14px;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f9fafb;
}

.welcome-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 300px;
}

.welcome-content {
  text-align: center;
  max-width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.welcome-content h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #1f2937;
}

.welcome-content p {
  margin: 0 0 20px 0;
  color: #6b7280;
  line-height: 1.5;
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 12px;
  color: #4b5563;
}

.feature-icon {
  font-size: 14px;
}

/* 消息组样式 */
.message-group {
  margin-bottom: 20px;
}

.user-group,
.assistant-group,
.thinking-group,
.tool-group {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.user-avatar { background: #3b82f6; color: white; }
.ai-avatar { background: #10b981; color: white; }
.thinking-avatar { background: #8b5cf6; color: white; }
.tool-avatar { background: #f59e0b; color: white; }

.message-content-container {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}

.message-time {
  font-size: 11px;
  color: #9ca3af;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 80%;
  position: relative;
}

.user-bubble {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
  margin-left: auto;
}

.ai-bubble {
  background: white;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.bubble-content {
  line-height: 1.5;
}

.bubble-content.streaming {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0.5; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}

.event-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 12px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 8px;
}

.event-tag-icon {
  font-size: 10px;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.message-metadata {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6b7280;
}

.metadata-icon {
  font-size: 10px;
}

.sending-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.sending-dots {
  display: flex;
  gap: 2px;
}

.sending-dots::after {
  content: '...';
  animation: dots 1.5s steps(4, end) infinite;
}

@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

/* 思考容器 */
.thinking-container {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

.thinking-icon {
  font-size: 14px;
}

.thinking-title {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
}

.thinking-content {
  padding: 12px;
  min-height: 60px;
  max-height: 200px;
  overflow-y: auto;
}

.real-time-thinking {
  animation: pulse 2s infinite;
}

.thinking-text {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
  white-space: pre-wrap;
}

.thinking-animation {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
  animation: bounce 1.4s infinite ease-in-out;
}

.thinking-dot:nth-child(2) { animation-delay: -0.16s; }
.thinking-dot:nth-child(3) { animation-delay: -0.32s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.thinking-history {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.thinking-chunk {
  margin-bottom: 4px;
  padding: 4px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #8b5cf6;
}

.thinking-stats {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: white;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: #9ca3af;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 工具容器 */
.tool-container {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  overflow: hidden;
}

.tool-call {
  padding: 12px;
  border-bottom: 1px solid #fde68a;
}

.tool-call:last-child {
  border-bottom: none;
}

.tool-header {
  margin-bottom: 8px;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-icon {
  font-size: 14px;
}

.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
}

.tool-status {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.tool-status.started { background: #fef3c7; color: #92400e; }
.tool-status.executing { background: #fef3c7; color: #92400e; animation: pulse 1s infinite; }
.tool-status.completed { background: #d1fae5; color: #065f46; }

.params-label,
.result-label {
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 4px;
}

.params-content,
.result-content {
  margin: 0;
  padding: 8px;
  background: white;
  border-radius: 4px;
  font-size: 11px;
  color: #374151;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #fde68a;
}

/* 系统消息 */
.system-group {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.system-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 12px;
  color: #6b7280;
}

.system-icon {
  font-size: 12px;
}

/* 处理指示器 */
.processing-indicator {
  margin: 20px 0;
  text-align: center;
}

.connecting-indicator,
.streaming-indicator {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.connecting-spinner,
.streaming-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.connecting-text,
.streaming-text {
  font-size: 13px;
  color: #6b7280;
}

.streaming-progress {
  width: 200px;
  margin-top: 8px;
}

.progress-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.eta {
  font-size: 10px;
  color: #9ca3af;
}

/* 输入区域 */
.chat-input-area {
  border-top: 1px solid #e5e7eb;
  background: white;
}

.error-state {
  padding: 12px 20px;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
}

.error-message {
  flex: 1;
}

.error-message h4 {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: #dc2626;
}

.error-message p {
  margin: 0;
  font-size: 12px;
  color: #991b1b;
}

.error-actions {
  display: flex;
  gap: 8px;
}

.error-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.error-btn.retry-btn {
  background: #10b981;
  color: white;
}

.error-btn.retry-btn:hover {
  background: #059669;
}

.error-btn.reset-btn {
  background: #f3f4f6;
  color: #374151;
}

.error-btn.reset-btn:hover {
  background: #e5e7eb;
}

.input-form {
  padding: 16px 20px;
}

.input-wrapper {
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.message-input {
  width: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  font-family: inherit;
}

.message-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
}

.input-stats {
  font-size: 12px;
  color: #9ca3af;
}

.char-count {
  margin-right: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn {
  background: #f3f4f6;
  color: #6b7280;
}

.quick-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.send-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.send-btn.sending {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
}

.quick-suggestions {
  margin-top: 12px;
}

.suggestions-label {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.suggestion-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion-btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

/* 底部状态栏 */
.chat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
}

.footer-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6b7280;
}

.stat-icon {
  font-size: 10px;
}

.debug-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.debug-toggle:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.debug-icon {
  font-size: 10px;
}

.debug-arrow {
  font-size: 10px;
  margin-left: 4px;
}

/* 调试面板 */
.debug-panel {
  max-height: 300px;
  overflow-y: auto;
  background: #1f2937;
  color: #e5e7eb;
  border-top: 1px solid #374151;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { max-height: 0; opacity: 0; }
  to { max-height: 300px; opacity: 1; }
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #111827;
  border-bottom: 1px solid #374151;
}

.debug-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.copy-btn {
  padding: 4px 8px;
  border: none;
  background: #374151;
  color: #9ca3af;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #4b5563;
  color: #e5e7eb;
}

.debug-content {
  padding: 20px;
}

.debug-section {
  margin-bottom: 20px;
}

.debug-section:last-child {
  margin-bottom: 0;
}

.debug-section h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.state-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #374151;
  border-radius: 4px;
  font-size: 12px;
}

.state-label {
  color: #9ca3af;
}

.state-value {
  font-weight: 500;
}

.state-value.idle { color: #10b981; }
.state-value.connecting { color: #f59e0b; }
.state-value.streaming { color: #3b82f6; }
.state-value.thinking { color: #8b5cf6; }
.state-value.tool_executing { color: #ef4444; }
.state-value.waiting_tool { color: #f97316; }
.state-value.error { color: #dc2626; }
.state-value.completed { color: #10b981; }

.state-value.true { color: #10b981; }
.state-value.false { color: #ef4444; }

.debug-pre {
  margin: 0;
  padding: 12px;
  background: #374151;
  border-radius: 4px;
  font-size: 11px;
  color: #e5e7eb;
  max-height: 100px;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.recent-thinking,
.no-thinking,
.tool-history,
.no-tools {
  padding: 12px;
  background: #374151;
  border-radius: 4px;
  font-size: 12px;
  color: #e5e7eb;
  max-height: 100px;
  overflow-y: auto;
}

.no-thinking,
.no-tools {
  color: #9ca3af;
  font-style: italic;
  text-align: center;
}

.tool-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #4b5563;
}

.tool-history-item:last-child {
  border-bottom: none;
}

.context-view {
  background: #374151;
  border-radius: 4px;
  overflow: hidden;
}

.context-tabs {
  display: flex;
  background: #111827;
  border-bottom: 1px solid #374151;
}

.context-tab {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.context-tab:hover {
  background: #374151;
  color: #e5e7eb;
}

.context-tab.active {
  background: #374151;
  color: #e5e7eb;
  border-bottom: 2px solid #3b82f6;
}

.context-content {
  padding: 12px;
  max-height: 150px;
  overflow-y: auto;
}

.context-content pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}
</style>