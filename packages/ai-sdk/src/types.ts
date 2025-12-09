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
  | 'ERROR';

export interface SSEMessage {
  eventType: EventType;
  eventSn: number;
  content: {
    text: string;
    [key: string]: any;
  };
  metadata?: {
    duration?: number;
    messageId?: string;
    promptTokens?: number;
    startTime?: string;
    endTime?: string;
    totalTokens?: number;
    completionTokens?: number;
    toolName?: string;
    toolParams?: Record<string, any>;
    toolResult?: any;
    [key: string]: any;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'thinking' | 'tool';
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
  eventType?: EventType;
  metadata?: Record<string, any>;
  isThinking?: boolean;
  isToolCall?: boolean;
  toolName?: string;
}

export interface ThinkingChunk {
  text: string;
  timestamp: number;
  isThinking: boolean;
}

export interface ToolCall {
  name: string;
  params: Record<string, any>;
  result?: any;
  status: 'started' | 'executing' | 'completed' | 'error';
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  thinkingStream: ThinkingChunk[];
  currentTool?: ToolCall;
  createdAt: number;
  updatedAt: number;
}

export interface AIAgentConfig {
  name: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  systemPrompt?: string;
  apiEndpoint?: string;
}

export interface ChatContext {
  conversation: Conversation;
  config: AIAgentConfig;
  metadata?: Record<string, any>;
  isStreaming?: boolean;
  currentThinking?: string;
  activeTools: ToolCall[];
  lastEventType?: EventType;
}

export interface StreamProgress {
  totalChunks: number;
  receivedChunks: number;
  estimatedTimeRemaining?: number;
  speed?: number;
}