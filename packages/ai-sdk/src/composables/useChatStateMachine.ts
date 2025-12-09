import { ref, computed, onUnmounted, readonly, reactive, watch } from 'vue';

import {
  ChatStateMachine,
  ChatEvent,
  ChatContext,
  ChatState,
  createAIService,
  AIService,
  AIServiceOptions,
  SSEMessage,
  StreamProgress,
  StateMachineOptions,
  AIAgentConfig,
  Conversation
} from '../index';

export interface UseChatStateMachineOptions extends Partial<AIServiceOptions> {
  stateMachineOptions?: Partial<StateMachineOptions>;
  initialConfig?: Partial<AIAgentConfig>;
  initialConversation?: Partial<Conversation>;
  onSSEMessage?: (sse: SSEMessage) => void;
  onStateChange?: (state: ChatState, context: ChatContext) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: StreamProgress) => void;
  onThinkingUpdate?: (thinking: string) => void;
  onToolCall?: (tool: { name: string; params: any }) => void;
  onToolResult?: (tool: { name: string; result: any }) => void;
}

export function useChatStateMachine(
  options: UseChatStateMachineOptions = {}
) {
  // 创建AIService
  const aiService = reactive(createAIService({
    endpoint: options.endpoint,
    headers: options.headers,
    timeout: options.timeout,
    retryCount: options.retryCount,
    retryDelay: options.retryDelay,
    onOpen: () => {
      console.log('AIService connected');
      options.onStreamStart?.();
    },
    onClose: () => {
      console.log('AIService disconnected');
      options.onStreamEnd?.();
    },
    onError: (error) => {
      console.error('AIService error:', error);
      options.onError?.(error);
    },
    onProgress: (progress) => {
      streamProgress.value = progress;
      options.onProgress?.(progress);
    }
  }));

  // 初始化上下文
  const initialContext: Partial<ChatContext> = {
    config: {
      name: 'AI Assistant',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      systemPrompt: 'You are a helpful AI assistant.',
      apiEndpoint: options.endpoint || '/api/chat/stream',
      ...options.initialConfig
    },
    conversation: {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      messages: [],
      thinkingStream: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...options.initialConversation
    },
    activeTools: [],
    isStreaming: false
  };

  // 创建状态机
  const stateMachine = ref<ChatStateMachine>(
    new ChatStateMachine(initialContext, {
      aiService,
      ...options.stateMachineOptions
    })
  );

  // 响应式状态
  const currentState = ref<ChatState>(stateMachine.value.getState());
  const context = ref<ChatContext>(stateMachine.value.getContext());
  const streamProgress = ref<StreamProgress>({
    totalChunks: 0,
    receivedChunks: 0
  });

  // 订阅状态变化
  const unsubscribe = stateMachine.value.subscribe((newState, newContext) => {
    currentState.value = newState;
    context.value = newContext;
    options.onStateChange?.(newState, newContext);
    
    // 触发特定回调
    if (newContext.currentThinking && newContext.currentThinking !== context.value.currentThinking) {
      options.onThinkingUpdate?.(newContext.currentThinking);
    }
  });

  // 监听器清理
  onUnmounted(() => {
    unsubscribe();
    stopStream();
    stateMachine.value.destroy();
  });

  // 计算属性
  const isIdle = computed(() => currentState.value === 'idle');
  const isConnecting = computed(() => currentState.value === 'connecting');
  const isStreaming = computed(() => currentState.value === 'streaming');
  const isThinking = computed(() => currentState.value === 'thinking');
  const isToolExecuting = computed(() => currentState.value === 'tool_executing');
  const isWaitingTool = computed(() => currentState.value === 'waiting_tool');
  const isError = computed(() => currentState.value === 'error');
  const isCompleted = computed(() => currentState.value === 'completed');
  
  const canSendMessage = computed(() => 
    currentState.value === 'idle' || 
    currentState.value === 'completed' ||
    currentState.value === 'error'
  );
  
  const isProcessing = computed(() =>
    currentState.value === 'connecting' ||
    currentState.value === 'streaming' ||
    currentState.value === 'thinking' ||
    currentState.value === 'tool_executing' ||
    currentState.value === 'waiting_tool'
  );
  
  const isStreamActive = computed(() => aiService.isActive());
  
  const currentTool = computed(() => context.value.conversation.currentTool);
  const currentThinking = computed(() => context.value.currentThinking);
  const lastEventType = computed(() => context.value.lastEventType);
  
  // 进度计算
  const progressPercentage = computed(() => {
    if (streamProgress.value.totalChunks === 0) return 0;
    return Math.min(100, (streamProgress.value.receivedChunks / streamProgress.value.totalChunks) * 100);
  });
  
  const estimatedTimeRemaining = computed(() => {
    if (!streamProgress.value.estimatedTimeRemaining) return null;
    const seconds = Math.ceil(streamProgress.value.estimatedTimeRemaining / 1000);
    return seconds > 0 ? `${seconds}秒` : '即将完成';
  });

  // 消息分组
  const groupedMessages = computed(() => {
    const groups: Array<{
      type: 'user' | 'assistant' | 'thinking' | 'tool' | 'system';
      messages: ChatContext['conversation']['messages'];
      timestamp: number;
    }> = [];
    
    let currentGroup: typeof groups[0] | null = null;
    
    for (const message of context.value.conversation.messages) {
      if (!currentGroup || currentGroup.type !== message.role) {
        currentGroup = {
          type: message.role,
          messages: [message],
          timestamp: message.timestamp
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    }
    
    return groups;
  });

  // 工具调用历史
  const toolCalls = computed(() => {
    return context.value.conversation.messages
      .filter(msg => msg.isToolCall)
      .map(msg => ({
        name: msg.toolName || 'unknown',
        timestamp: msg.timestamp,
        eventType: msg.eventType,
        metadata: msg.metadata
      }));
  });

  // 思考流
  const thinkingStream = computed(() => context.value.conversation.thinkingStream);
  
  // 最近思考
  const recentThinking = computed(() => {
    const stream = thinkingStream.value;
    if (stream.length === 0) return '';
    
    const lastChunks = stream.slice(-5);
    return lastChunks.map(chunk => chunk.text).join('');
  });

  // 调试信息
  const debugInfo = computed(() => ({
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
  }));

  // 方法
  const sendMessage = async (content: string): Promise<void> => {
    if (!canSendMessage.value || !content.trim()) return;
    
    try {
      await stateMachine.value.send({
        type: 'SEND_MESSAGE',
        message: content.trim()
      });
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  };

  const stopStream = (): void => {
    stateMachine.value.send({ type: 'STOP_STREAM' });
  };

  const retry = async (): Promise<void> => {
    const lastUserMessage = context.value.conversation.messages
      .filter(msg => msg.role === 'user')
      .pop();
    
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  };

  const reset = async (): Promise<void> => {
    await stateMachine.value.send({ type: 'RESET' });
    streamProgress.value = {
      totalChunks: 0,
      receivedChunks: 0
    };
  };

  const cancel = async (): Promise<void> => {
    await stateMachine.value.send({ type: 'CANCEL' });
  };

  const updateConfig = (config: Partial<AIAgentConfig>): void => {
    context.value.config = {
      ...context.value.config,
      ...config
    };
  };

  const clearConversation = (): void => {
    context.value.conversation.messages = [];
    context.value.conversation.thinkingStream = [];
    context.value.conversation.currentTool = undefined;
    context.value.activeTools = [];
    context.value.currentThinking = '';
    context.value.lastEventType = undefined;
    context.value.conversation.updatedAt = Date.now();
  };

  const exportConversation = (): string => {
    return JSON.stringify({
      conversation: context.value.conversation,
      config: context.value.config,
      timestamp: Date.now()
    }, null, 2);
  };

  const importConversation = (data: string): void => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.conversation && parsed.config) {
        context.value.conversation = {
          ...context.value.conversation,
          ...parsed.conversation,
          messages: parsed.conversation.messages || [],
          thinkingStream: parsed.conversation.thinkingStream || []
        };
        
        context.value.config = {
          ...context.value.config,
          ...parsed.config
        };
      }
    } catch (error) {
      console.error('Import conversation error:', error);
      throw new Error('Invalid conversation data');
    }
  };

  // 模拟测试
  const simulateTestStream = async (customMessages?: SSEMessage[]): Promise<void> => {
    const messages = customMessages || AIService.createTestMessages();
    
    // 临时替换AI服务
    const originalStreamChat = aiService.streamChat;
    
    aiService.streamChat = async () => {
      const mockStream = AIService.createMockStream(messages, 150);
      
      return {
        stream: mockStream,
        progress: {
          totalChunks: messages.length,
          receivedChunks: 0
        },
        cancel: () => {}
      };
    };
    
    try {
      await sendMessage('测试消息');
    } finally {
      // 恢复原始服务
      aiService.streamChat = originalStreamChat;
    }
  };

  // 手动触发SSE消息（用于测试）
  const triggerSSEMessage = (sseMessage: SSEMessage): void => {
    stateMachine.value.send({
      type: 'SSE_MESSAGE',
      sseMessage
    });
  };

  // 手动触发状态变化
  const triggerStateChange = async (event: ChatEvent): Promise<void> => {
    await stateMachine.value.send(event);
  };

  // 获取统计信息
  const getStats = () => {
    return stateMachine.value.getStats();
  };

  // 监听工具调用
  watch(() => context.value.conversation.currentTool, (newTool, oldTool) => {
    if (newTool && newTool !== oldTool) {
      options.onToolCall?.({
        name: newTool.name,
        params: newTool.params
      });
      
      if (newTool.result && newTool.result !== oldTool?.result) {
        options.onToolResult?.({
          name: newTool.name,
          result: newTool.result
        });
      }
    }
  }, { deep: true });

  return {
    // 状态
    currentState: readonly(currentState),
    context: readonly(context),
    streamProgress: readonly(streamProgress),
    
    // 计算属性
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
    
    // 方法
    sendMessage,
    stopStream,
    retry,
    reset,
    cancel,
    updateConfig,
    clearConversation,
    exportConversation,
    importConversation,
    simulateTestStream,
    triggerSSEMessage,
    triggerStateChange,
    getStats,
    
    // 服务
    aiService: readonly(aiService),
    
    // 原始状态机（高级用法）
    stateMachine
  };
}

/**
 * 创建预配置的状态机hook
 */
export function createChatStateMachine(options: UseChatStateMachineOptions = {}) {
  return () => useChatStateMachine(options);
}

/**
 * 快捷hook：创建基础的聊天状态机
 */
export function useBasicChatStateMachine(endpoint?: string) {
  return useChatStateMachine({
    endpoint: endpoint || '/api/chat/stream',
    onError: (error) => {
      console.error('Chat error:', error);
      alert(`聊天错误: ${error.message}`);
    }
  });
}

/**
 * 快捷hook：创建带调试的聊天状态机
 */
export function useDebugChatStateMachine(endpoint?: string) {
  const { debugInfo, ...rest } = useChatStateMachine({
    endpoint: endpoint || '/api/chat/stream',
    onStateChange: (state, context) => {
      console.log('State changed:', state, context);
    },
    onSSEMessage: (sse) => {
      console.log('SSE message:', sse);
    }
  });
  
  return {
    ...rest,
    debugInfo
  };
}