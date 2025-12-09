export * from './types';
export * from './ai-service';
export * from './state-machine';
export * from './composables/useChatStateMachine';

// 实用函数
export const createChatId = () => crypto.randomUUID();
export const createMessageId = () => crypto.randomUUID();

// 工具函数
export function formatEventType(eventType: string): string {
  const eventMap: Record<string, string> = {
    START: '开始',
    TOOL_START: '工具开始',
    TOOL: '工具执行',
    TOOL_END: '工具结束',
    THINK_START: '思考开始',
    THINK: '思考',
    THINK_END: '思考结束',
    ECHARTS_START: '图表开始',
    ECHARTS: '图表生成',
    ECHARTS_END: '图表结束',
    INTENTION_RECOGNIZE: '意图识别',
    RETRIEVE: '检索',
    TEXT: '文本',
    END: '结束',
    ERROR: '错误'
  };
  
  return eventMap[eventType] || eventType;
}

export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    user: '用户',
    assistant: 'AI助手',
    thinking: '思考',
    tool: '工具',
    system: '系统'
  };
  
  return roleMap[role] || role;
}