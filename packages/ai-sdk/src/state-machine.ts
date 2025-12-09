import { 
  ChatMessage, 
  Conversation, 
  AIAgentConfig, 
  ChatContext, 
  SSEMessage, 
  EventType,
  ThinkingChunk,
  ToolCall 
} from './types';
import { AIService, createAIService, StreamResponse } from './ai-service';

export type ChatState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'thinking'
  | 'tool_executing'
  | 'waiting_tool'
  | 'error'
  | 'completed';

export type ChatEvent =
  | { type: 'SEND_MESSAGE'; message: string }
  | { type: 'SSE_CONNECTING' }
  | { type: 'SSE_CONNECTED' }
  | { type: 'SSE_MESSAGE'; sseMessage: SSEMessage }
  | { type: 'SSE_ERROR'; error: string }
  | { type: 'SSE_COMPLETE' }
  | { type: 'TOOL_STARTED'; toolName: string; params: Record<string, any> }
  | { type: 'TOOL_COMPLETED'; result: any }
  | { type: 'TOOL_ERROR'; error: string }
  | { type: 'THINKING_START' }
  | { type: 'THINKING_UPDATE'; text: string }
  | { type: 'THINKING_END' }
  | { type: 'TEXT_CHUNK'; text: string }
  | { type: 'RESET' }
  | { type: 'CANCEL' }
  | { type: 'STOP_STREAM' };

export interface StateMachineOptions {
  aiService?: AIService;
  maxThinkingBufferSize?: number;
  maxToolBufferSize?: number;
  autoClearBuffer?: boolean;
}

export class ChatStateMachine {
  private state: ChatState = 'idle';
  private context: ChatContext;
  private listeners: Set<(state: ChatState, context: ChatContext) => void> = new Set();
  private thinkingBuffer: string = '';
  private currentToolBuffer: string = '';
  private aiService: AIService;
  private currentStream: StreamResponse | null = null;
  private options: Required<StateMachineOptions>;

  constructor(
    initialContext: Partial<ChatContext> = {},
    options: StateMachineOptions = {}
  ) {
    this.context = {
      conversation: initialContext.conversation || this.createNewConversation(),
      config: initialContext.config || this.getDefaultConfig(),
      metadata: initialContext.metadata || {},
      activeTools: [],
      isStreaming: false
    };
    
    this.options = {
      aiService: options.aiService || createAIService(),
      maxThinkingBufferSize: options.maxThinkingBufferSize || 10000,
      maxToolBufferSize: options.maxToolBufferSize || 5000,
      autoClearBuffer: options.autoClearBuffer ?? true
    };
    
    this.aiService = this.options.aiService;
  }

  private createNewConversation(): Conversation {
    return {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      messages: [],
      thinkingStream: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private getDefaultConfig(): AIAgentConfig {
    return {
      name: 'AI Assistant',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are a helpful AI assistant.',
      apiEndpoint: '/api/chat/stream'
    };
  }

  public getState(): ChatState {
    return this.state;
  }

  public getContext(): ChatContext {
    return { ...this.context };
  }

  public subscribe(listener: (state: ChatState, context: ChatContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state, this.getContext()));
  }

  private transition(newState: ChatState): void {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`State transition: ${oldState} -> ${newState}`);
    
    this.context.isStreaming = newState === 'streaming' || 
                               newState === 'thinking' || 
                               newState === 'tool_executing';
    
    // 状态变更时的清理逻辑
    if (newState === 'idle' || newState === 'completed' || newState === 'error') {
      if (this.options.autoClearBuffer) {
        this.clearThinking();
        this.clearToolBuffer();
      }
    }
    
    this.notify();
  }

  private addMessage(message: ChatMessage): void {
    // 限制消息数量（可选）
    if (this.context.conversation.messages.length > 100) {
      this.context.conversation.messages = this.context.conversation.messages.slice(-100);
    }
    
    this.context.conversation.messages.push(message);
    this.context.conversation.updatedAt = Date.now();
    this.notify();
  }

  private addThinkingChunk(text: string): void {
    // 限制思考缓冲区大小
    if (this.thinkingBuffer.length > this.options.maxThinkingBufferSize) {
      this.thinkingBuffer = this.thinkingBuffer.slice(-this.options.maxThinkingBufferSize);
    }
    
    const chunk: ThinkingChunk = {
      text,
      timestamp: Date.now(),
      isThinking: true
    };
    
    this.context.conversation.thinkingStream.push(chunk);
    this.thinkingBuffer += text;
    this.context.currentThinking = this.thinkingBuffer;
    
    // 限制思考流长度
    if (this.context.conversation.thinkingStream.length > 50) {
      this.context.conversation.thinkingStream = this.context.conversation.thinkingStream.slice(-50);
    }
    
    this.notify();
  }

  private startToolCall(toolName: string, params: Record<string, any> = {}): void {
    const toolCall: ToolCall = {
      name: toolName,
      params,
      status: 'started',
      timestamp: Date.now()
    };
    
    this.context.conversation.currentTool = toolCall;
    this.context.activeTools.push(toolCall);
    
    // 限制活动工具数量
    if (this.context.activeTools.length > 10) {
      this.context.activeTools = this.context.activeTools.slice(-10);
    }
    
    // 添加工具开始消息
    const toolMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'tool',
      content: `调用工具: ${toolName}`,
      timestamp: Date.now(),
      status: 'sent',
      eventType: 'TOOL_START',
      isToolCall: true,
      toolName,
      metadata: { params }
    };
    
    this.addMessage(toolMessage);
  }

  private updateToolCall(result: any, status: ToolCall['status'] = 'completed'): void {
    if (this.context.conversation.currentTool) {
      this.context.conversation.currentTool.result = result;
      this.context.conversation.currentTool.status = status;
      
      // 添加工具完成消息
      const toolMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'tool',
        content: `工具 ${this.context.conversation.currentTool.name} 执行${status === 'completed' ? '完成' : '中'}...`,
        timestamp: Date.now(),
        status: 'sent',
        eventType: 'TOOL_END',
        isToolCall: true,
        toolName: this.context.conversation.currentTool.name,
        metadata: { result, status }
      };
      
      this.addMessage(toolMessage);
      
      // 如果工具执行完成，清除当前工具引用
      if (status === 'completed') {
        this.context.conversation.currentTool = undefined;
      }
    }
  }

  private clearThinking(): void {
    this.thinkingBuffer = '';
    this.context.currentThinking = '';
    this.context.conversation.thinkingStream = [];
  }

  private clearToolBuffer(): void {
    this.currentToolBuffer = '';
  }

  private async startStreaming(message: string): Promise<void> {
    try {
      this.transition('connecting');
      
      // 创建用户消息
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        status: 'sent'
      };
      this.addMessage(userMessage);

      // 准备消息历史
      const messages = [
        ...(this.context.config.systemPrompt ? [{
          role: 'system',
          content: this.context.config.systemPrompt
        }] : []),
        ...this.context.conversation.messages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .slice(-10) // 保留最近10条消息
          .map(msg => ({
            role: msg.role,
            content: msg.content
          })),
        { role: 'user', content: message }
      ];

      // 开始流式请求
      this.currentStream = await this.aiService.streamChat({
        messages,
        model: this.context.config.model,
        temperature: this.context.config.temperature,
        maxTokens: this.context.config.maxTokens,
        stream: true,
        systemPrompt: this.context.config.systemPrompt
      });

      this.transition('streaming');

      // 处理流式响应
      for await (const sseMessage of this.currentStream.stream) {
        await this.processSSEMessage(sseMessage);
        
        // 如果状态变为error或idle，停止处理
        if (this.state === 'error' || this.state === 'idle') {
          break;
        }
      }

      // 如果没有错误，标记为完成
      if (this.state !== 'error') {
        this.send({ type: 'SSE_COMPLETE' });
      }
      
    } catch (error) {
      console.error('Stream error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Stream error';
      this.send({ 
        type: 'SSE_ERROR', 
        error: errorMessage 
      });
      
      // 添加错误消息
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `流式请求错误: ${errorMessage}`,
        timestamp: Date.now(),
        status: 'error',
        eventType: 'ERROR'
      };
      this.addMessage(errorMsg);
      
    } finally {
      this.currentStream = null;
    }
  }

  private stopStreaming(): void {
    if (this.currentStream) {
      this.currentStream.cancel();
      this.currentStream = null;
    }
    
    if (this.aiService.isActive()) {
      this.aiService.cancel();
    }
    
    // 如果正在流式传输，添加取消消息
    if (this.state === 'streaming' || this.state === 'thinking' || this.state === 'tool_executing') {
      const cancelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: '用户取消了请求',
        timestamp: Date.now(),
        status: 'sent'
      };
      this.addMessage(cancelMsg);
    }
  }

  public async send(event: ChatEvent): Promise<void> {
    try {
      console.log('Processing event:', event.type);
      
      switch (this.state) {
        case 'idle':
          await this.handleIdleState(event);
          break;
        case 'connecting':
          await this.handleConnectingState(event);
          break;
        case 'streaming':
        case 'thinking':
        case 'tool_executing':
        case 'waiting_tool':
          await this.handleProcessingState(event);
          break;
        case 'error':
          await this.handleErrorState(event);
          break;
        case 'completed':
          await this.handleCompletedState(event);
          break;
      }
    } catch (error) {
      console.error('State machine error:', error, event);
      this.transition('error');
      this.context.metadata = {
        ...this.context.metadata,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastEvent: event
      };
      this.notify();
    }
  }

  private async handleIdleState(event: ChatEvent): Promise<void> {
    switch (event.type) {
      case 'SEND_MESSAGE':
        await this.startStreaming(event.message);
        break;
        
      case 'RESET':
        this.context = {
          conversation: this.createNewConversation(),
          config: this.getDefaultConfig(),
          metadata: {},
          activeTools: [],
          isStreaming: false
        };
        this.clearThinking();
        this.clearToolBuffer();
        this.notify();
        break;
    }
  }

  private async handleConnectingState(event: ChatEvent): Promise<void> {
    switch (event.type) {
      case 'SSE_CONNECTED':
        this.transition('streaming');
        break;
        
      case 'SSE_ERROR':
        this.transition('error');
        this.context.metadata = {
          ...this.context.metadata,
          lastError: event.error
        };
        break;
        
      case 'CANCEL':
      case 'STOP_STREAM':
        this.stopStreaming();
        this.transition('idle');
        break;
    }
  }

  private async handleProcessingState(event: ChatEvent): Promise<void> {
    switch (event.type) {
      case 'SSE_MESSAGE':
        await this.processSSEMessage(event.sseMessage);
        break;
        
      case 'SSE_COMPLETE':
        this.transition('completed');
        break;
        
      case 'SSE_ERROR':
        this.transition('error');
        this.context.metadata = {
          ...this.context.metadata,
          lastError: event.error
        };
        break;
        
      case 'CANCEL':
      case 'STOP_STREAM':
        this.stopStreaming();
        this.transition('idle');
        break;
    }
  }

  private async handleErrorState(event: ChatEvent): Promise<void> {
    switch (event.type) {
      case 'RESET':
        this.context = {
          conversation: this.createNewConversation(),
          config: this.getDefaultConfig(),
          metadata: {},
          activeTools: [],
          isStreaming: false
        };
        this.transition('idle');
        break;
        
      case 'SEND_MESSAGE':
        // 从错误状态重新发送消息
        await this.startStreaming(event.message);
        break;
    }
  }

  private async handleCompletedState(event: ChatEvent): Promise<void> {
    switch (event.type) {
      case 'SEND_MESSAGE':
        await this.handleIdleState(event);
        break;
        
      case 'RESET':
        await this.handleErrorState(event);
        break;
    }
  }

  private async processSSEMessage(sseMessage: SSEMessage): Promise<void> {
    this.context.lastEventType = sseMessage.eventType;
    
    // 根据事件类型处理
    const eventHandlers: Record<EventType, () => void> = {
      START: () => this.handleStartEvent(sseMessage),
      THINK_START: () => this.handleThinkStartEvent(sseMessage),
      THINK: () => this.handleThinkEvent(sseMessage),
      THINK_END: () => this.handleThinkEndEvent(sseMessage),
      TOOL_START: () => this.handleToolStartEvent(sseMessage),
      TOOL: () => this.handleToolEvent(sseMessage),
      TOOL_END: () => this.handleToolEndEvent(sseMessage),
      TEXT: () => this.handleTextEvent(sseMessage),
      INTENTION_RECOGNIZE: () => this.handleAnalysisEvent(sseMessage),
      RETRIEVE: () => this.handleAnalysisEvent(sseMessage),
      ECHARTS_START: () => this.handleEchartsEvent(sseMessage),
      ECHARTS: () => this.handleEchartsEvent(sseMessage),
      ECHARTS_END: () => this.handleEchartsEvent(sseMessage),
      END: () => this.handleEndEvent(sseMessage),
      ERROR: () => this.handleErrorEvent(sseMessage)
    };

    const handler = eventHandlers[sseMessage.eventType];
    if (handler) {
      handler();
    } else {
      console.warn('Unhandled event type:', sseMessage.eventType);
    }
  }

  private handleStartEvent(sseMessage: SSEMessage): void {
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: sseMessage.content.text,
      timestamp: Date.now(),
      status: 'sending',
      eventType: 'START'
    };
    
    this.addMessage(assistantMessage);
    this.send({ type: 'SSE_CONNECTED' });
  }

  private handleThinkStartEvent(sseMessage: SSEMessage): void {
    this.transition('thinking');
    this.clearThinking();
    
    const thinkMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'thinking',
      content: '开始思考...',
      timestamp: Date.now(),
      status: 'sending',
      eventType: 'THINK_START',
      isThinking: true
    };
    
    this.addMessage(thinkMessage);
  }

  private handleThinkEvent(sseMessage: SSEMessage): void {
    if (this.state !== 'thinking') {
      this.transition('thinking');
    }
    
    this.addThinkingChunk(sseMessage.content.text);
    
    // 更新最后一个思考消息
    const messages = this.context.conversation.messages;
    const lastThinkingMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'thinking' && msg.eventType === 'THINK_START');
    
    if (lastThinkingMessage) {
      lastThinkingMessage.content = `思考中: ${this.thinkingBuffer.slice(0, 100)}...`;
      this.notify();
    }
  }

  private handleThinkEndEvent(sseMessage: SSEMessage): void {
    // 创建思考结果消息
    if (this.thinkingBuffer) {
      const thinkResultMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'thinking',
        content: `思考完成: ${this.thinkingBuffer.slice(0, 150)}...`,
        timestamp: Date.now(),
        status: 'sent',
        eventType: 'THINK_END',
        isThinking: true,
        metadata: { 
          fullThought: this.thinkingBuffer,
          thoughtLength: this.thinkingBuffer.length
        }
      };
      
      this.addMessage(thinkResultMessage);
    }
    
    this.clearThinking();
    this.transition('streaming');
  }

  private handleToolStartEvent(sseMessage: SSEMessage): void {
    const toolName = sseMessage.metadata?.toolName || 'unknown_tool';
    const params = sseMessage.metadata?.toolParams || {};
    
    this.startToolCall(toolName, params);
    this.transition('tool_executing');
  }

  private handleToolEvent(sseMessage: SSEMessage): void {
    if (this.state !== 'tool_executing') {
      this.transition('tool_executing');
    }
    
    this.currentToolBuffer += sseMessage.content.text;
    
    // 更新工具执行进度
    if (this.context.conversation.currentTool) {
      const progressMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'tool',
        content: `工具执行中: ${this.currentToolBuffer.slice(0, 100)}...`,
        timestamp: Date.now(),
        status: 'sending',
        eventType: 'TOOL',
        isToolCall: true,
        toolName: this.context.conversation.currentTool.name
      };
      
      this.addMessage(progressMessage);
    }
  }

  private handleToolEndEvent(sseMessage: SSEMessage): void {
    const result = sseMessage.metadata?.toolResult;
    this.updateToolCall(result, 'completed');
    this.clearToolBuffer();
    this.transition('waiting_tool');
  }

  private handleTextEvent(sseMessage: SSEMessage): void {
    if (this.state !== 'streaming') {
      this.transition('streaming');
    }
    
    // 查找或创建助理消息用于文本流式传输
    let assistantMessage = this.context.conversation.messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant' && msg.status === 'sending');
    
    if (!assistantMessage) {
      assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: sseMessage.content.text,
        timestamp: Date.now(),
        status: 'sending',
        eventType: 'TEXT'
      };
      this.addMessage(assistantMessage);
    } else {
      assistantMessage.content += sseMessage.content.text;
      this.notify();
    }
  }

  private handleAnalysisEvent(sseMessage: SSEMessage): void {
    const analysisMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `${sseMessage.eventType === 'INTENTION_RECOGNIZE' ? '意图识别' : '检索'}中: ${sseMessage.content.text}`,
      timestamp: Date.now(),
      status: 'sent',
      eventType: sseMessage.eventType,
      metadata: sseMessage.metadata
    };
    
    this.addMessage(analysisMessage);
  }

  private handleEchartsEvent(sseMessage: SSEMessage): void {
    const eventType = sseMessage.eventType;
    let content = '';
    
    if (eventType === 'ECHARTS_START') {
      content = '开始生成图表...';
    } else if (eventType === 'ECHARTS') {
      content = `图表数据: ${sseMessage.content.text}`;
    } else {
      content = '图表生成完成';
    }
    
    const echartsMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      status: eventType === 'ECHARTS_END' ? 'sent' : 'sending',
      eventType: eventType,
      metadata: sseMessage.metadata
    };
    
    this.addMessage(echartsMessage);
  }

  private handleEndEvent(sseMessage: SSEMessage): void {
    // 标记最后一个助理消息为已发送
    const messages = this.context.conversation.messages;
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant' && msg.status === 'sending');
    
    if (lastAssistantMessage) {
      lastAssistantMessage.status = 'sent';
      lastAssistantMessage.content += sseMessage.content.text || '';
      lastAssistantMessage.metadata = {
        ...lastAssistantMessage.metadata,
        ...sseMessage.metadata
      };
    }
    
    // 添加完成消息
    const endMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: sseMessage.content.text || '对话完成',
      timestamp: Date.now(),
      status: 'sent',
      eventType: 'END',
      metadata: sseMessage.metadata
    };
    
    this.addMessage(endMessage);
  }

  private handleErrorEvent(sseMessage: SSEMessage): void {
    const errorMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `错误: ${sseMessage.content.text}`,
      timestamp: Date.now(),
      status: 'error',
      eventType: 'ERROR',
      metadata: sseMessage.metadata
    };
    
    this.addMessage(errorMessage);
    this.send({ type: 'SSE_ERROR', error: sseMessage.content.text });
  }

  /**
   * 获取状态机统计信息
   */
  public getStats() {
    return {
      state: this.state,
      messageCount: this.context.conversation.messages.length,
      thinkingChunks: this.context.conversation.thinkingStream.length,
      activeTools: this.context.activeTools.length,
      isStreaming: this.context.isStreaming,
      lastEvent: this.context.lastEventType,
      conversationId: this.context.conversation.id
    };
  }

  /**
   * 销毁状态机
   */
  public destroy(): void {
    this.stopStreaming();
    this.listeners.clear();
    this.clearThinking();
    this.clearToolBuffer();
  }
}