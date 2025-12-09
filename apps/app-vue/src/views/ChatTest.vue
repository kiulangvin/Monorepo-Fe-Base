<template>
  <div class="chat-test-page">
    <div class="page-header">
      <h1>AI对话状态机测试</h1>
      <p class="page-subtitle">基于Monorepo + TypeScript + Vue的完整实现</p>
      
      <div class="test-controls">
        <div class="endpoint-config">
          <label for="endpoint">API端点:</label>
          <input
            id="endpoint"
            v-model="endpoint"
            type="text"
            placeholder="/api/chat/stream"
          >
          <button @click="updateEndpoint" class="update-btn">更新</button>
        </div>
        
        <div class="preset-buttons">
          <button @click="useMockEndpoint" class="preset-btn mock-btn">
            使用模拟端点
          </button>
          <button @click="useLocalEndpoint" class="preset-btn local-btn">
            使用本地端点
          </button>
          <button @click="useProdEndpoint" class="preset-btn prod-btn">
            使用生产端点
          </button>
        </div>
      </div>
    </div>
    
    <div class="layout-container">
      <!-- 左侧：对话窗口 -->
      <div class="chat-section">
        <ChatWindow
          ref="chatWindow"
          :endpoint="currentEndpoint"
          title="AI对话状态机演示"
          :initial-message="initialMessage"
          :show-welcome="true"
        />
      </div>
      
      <!-- 右侧：控制面板 -->
      <div class="control-section">
        <div class="control-panel">
          <div class="panel-section">
            <h3>🎯 快速测试</h3>
            <div class="quick-tests">
              <button 
                v-for="test in quickTests"
                :key="test.id"
                @click="runQuickTest(test)"
                class="quick-test-btn"
                :class="test.type"
              >
                <span class="test-icon">{{ test.icon }}</span>
                <span class="test-text">{{ test.label }}</span>
              </button>
            </div>
          </div>
          
          <div class="panel-section">
            <h3>⚙️ 状态机控制</h3>
            <div class="state-controls">
              <div class="control-group">
                <label>手动触发事件:</label>
                <div class="event-buttons">
                  <button 
                    v-for="event in manualEvents"
                    :key="event.type"
                    @click="triggerManualEvent(event)"
                    class="event-btn"
                    :class="event.type"
                  >
                    {{ event.label }}
                  </button>
                </div>
              </div>
              
              <div class="control-group">
                <label>测试场景:</label>
                <div class="scenario-buttons">
                  <button 
                    v-for="scenario in testScenarios"
                    :key="scenario.id"
                    @click="runTestScenario(scenario)"
                    class="scenario-btn"
                  >
                    <span class="scenario-icon">{{ scenario.icon }}</span>
                    <span class="scenario-text">{{ scenario.label }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="panel-section">
            <h3>📊 实时监控</h3>
            <div class="monitor-panel">
              <div class="monitor-item">
                <span class="monitor-label">当前状态:</span>
                <span class="monitor-value" :class="monitorData.state">
                  {{ monitorData.state }}
                </span>
              </div>
              
              <div class="monitor-item">
                <span class="monitor-label">消息数量:</span>
                <span class="monitor-value">{{ monitorData.messageCount }}</span>
              </div>
              
              <div class="monitor-item">
                <span class="monitor-label">思考记录:</span>
                <span class="monitor-value">{{ monitorData.thinkingChunks }}</span>
              </div>
              
              <div class="monitor-item">
                <span class="monitor-label">工具调用:</span>
                <span class="monitor-value">{{ monitorData.toolCalls }}</span>
              </div>
              
              <div class="monitor-item">
                <span class="monitor-label">最后事件:</span>
                <span class="monitor-value">{{ monitorData.lastEvent || '无' }}</span>
              </div>
              
              <div class="monitor-item">
                <span class="monitor-label">流式状态:</span>
                <span class="monitor-value" :class="{ active: monitorData.isStreamActive }">
                  {{ monitorData.isStreamActive ? '活动' : '空闲' }}
                </span>
              </div>
            </div>
            
            <div class="progress-monitor">
              <div class="progress-label">处理进度:</div>
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  :style="{ width: `${monitorData.progressPercentage}%` }"
                ></div>
              </div>
              <div class="progress-text">
                {{ Math.round(monitorData.progressPercentage) }}%
              </div>
            </div>
          </div>
          
          <div class="panel-section">
            <h3>📋 日志输出</h3>
            <div class="log-panel">
              <div class="log-header">
                <span>系统日志</span>
                <button @click="clearLogs" class="clear-logs-btn">清空</button>
              </div>
              <div class="log-content" ref="logContent">
                <div 
                  v-for="(log, index) in logs"
                  :key="index"
                  class="log-entry"
                  :class="log.level"
                >
                  <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                  <span class="log-level">{{ log.level.toUpperCase() }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部信息 -->
    <div class="page-footer">
      <div class="footer-info">
        <div class="info-item">
          <span class="info-icon">📁</span>
          <span>项目结构: Monorepo + TypeScript + Vue 3</span>
        </div>
        <div class="info-item">
          <span class="info-icon">⚡</span>
          <span>使用 fetch + SSE 流式处理</span>
        </div>
        <div class="info-item">
          <span class="info-icon">🧠</span>
          <span>完整的状态机实现</span>
        </div>
        <div class="info-item">
          <span class="info-icon">🔧</span>
          <span>支持工具调用和思考过程</span>
        </div>
      </div>
      <div class="footer-links">
        <a href="#" class="footer-link">GitHub</a>
        <a href="#" class="footer-link">文档</a>
        <a href="#" class="footer-link">API参考</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import ChatWindow from '../components/ChatWindow.vue';

// 响应式数据
const endpoint = ref('/api/chat/stream');
const currentEndpoint = ref('/api/chat/stream');
const initialMessage = ref('你好，请介绍一下这个系统');
const chatWindow = ref<InstanceType<typeof ChatWindow>>();

// 日志系统
interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

const logs = ref<LogEntry[]>([
  {
    timestamp: Date.now(),
    level: 'info',
    message: '系统初始化完成，AI对话状态机已就绪'
  },
  {
    timestamp: Date.now(),
    level: 'info',
    message: '使用端点: ' + currentEndpoint.value
  }
]);

const logContent = ref<HTMLElement>();

// 监控数据
const monitorData = ref({
  state: 'idle',
  messageCount: 0,
  thinkingChunks: 0,
  toolCalls: 0,
  lastEvent: '',
  isStreamActive: false,
  progressPercentage: 0
});

// 快速测试选项
const quickTests = [
  { id: 1, type: 'normal', icon: '💬', label: '普通对话', action: 'normal' },
  { id: 2, type: 'thinking', icon: '🧠', label: '思考过程', action: 'thinking' },
  { id: 3, type: 'tool', icon: '🔧', label: '工具调用', action: 'tool' },
  { id: 4, type: 'error', icon: '⚠️', label: '错误处理', action: 'error' },
  { id: 5, type: 'stream', icon: '⚡', label: '流式响应', action: 'stream' },
  { id: 6, type: 'full', icon: '🧪', label: '完整测试', action: 'full' }
];

// 手动触发事件
const manualEvents = [
  { type: 'start', label: 'START事件' },
  { type: 'think_start', label: 'THINK_START' },
  { type: 'think', label: 'THINK事件' },
  { type: 'think_end', label: 'THINK_END' },
  { type: 'tool_start', label: 'TOOL_START' },
  { type: 'tool_end', label: 'TOOL_END' },
  { type: 'text', label: 'TEXT事件' },
  { type: 'end', label: 'END事件' },
  { type: 'error', label: 'ERROR事件' }
];

// 测试场景
const testScenarios = [
  { id: 1, icon: '📚', label: '知识问答', scenario: 'knowledge' },
  { id: 2, icon: '💻', label: '代码生成', scenario: 'code' },
  { id: 3, icon: '🔍', label: '数据分析', scenario: 'analysis' },
  { id: 4, icon: '🎨', label: '创意写作', scenario: 'creative' },
  { id: 5, icon: '🔄', label: '复杂流程', scenario: 'complex' }
];

// 方法
const updateEndpoint = () => {
  currentEndpoint.value = endpoint.value;
  addLog('info', `API端点已更新为: ${endpoint.value}`);
};

const useMockEndpoint = () => {
  endpoint.value = 'mock://api/chat/stream';
  updateEndpoint();
  addLog('success', '已切换到模拟端点（使用本地测试数据）');
};

const useLocalEndpoint = () => {
  endpoint.value = 'http://localhost:3000/api/chat/stream';
  updateEndpoint();
  addLog('success', '已切换到本地开发端点');
};

const useProdEndpoint = () => {
  endpoint.value = 'https://api.example.com/chat/stream';
  updateEndpoint();
  addLog('success', '已切换到生产环境端点');
};

const runQuickTest = (test: any) => {
  addLog('info', `开始快速测试: ${test.label}`);
  
  // 这里可以调用 chatWindow 的方法来执行测试
  switch (test.action) {
    case 'thinking':
      // 模拟思考过程
      break;
    case 'tool':
      // 模拟工具调用
      break;
    case 'error':
      // 模拟错误
      break;
    case 'full':
      // 完整测试
      break;
    default:
      // 普通对话
      break;
  }
};

const triggerManualEvent = (event: any) => {
  addLog('info', `手动触发事件: ${event.label}`);
  // 这里可以调用状态机的方法来手动触发事件
};

const runTestScenario = (scenario: any) => {
  addLog('info', `运行测试场景: ${scenario.label}`);
  // 这里可以调用 chatWindow 的方法来运行测试场景
};

const addLog = (level: LogEntry['level'], message: string) => {
  logs.value.push({
    timestamp: Date.now(),
    level,
    message
  });
  
  // 滚动到底部
  nextTick(() => {
    if (logContent.value) {
      logContent.value.scrollTop = logContent.value.scrollHeight;
    }
  });
  
  // 更新监控数据
  updateMonitorData();
};

const clearLogs = () => {
  logs.value = [];
  addLog('info', '日志已清空');
};

const formatLogTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const updateMonitorData = () => {
  if (chatWindow.value) {
    const debugInfo = chatWindow.value.getDebugInfo();
    monitorData.value = {
      state: debugInfo.state || 'idle',
      messageCount: debugInfo.messageCount || 0,
      thinkingChunks: debugInfo.thinkingChunks || 0,
      toolCalls: debugInfo.toolCalls || 0,
      lastEvent: debugInfo.lastEventType || '',
      isStreamActive: debugInfo.isStreaming || false,
      progressPercentage: debugInfo.progress?.percentage || 0
    };
  }
};

// 定时更新监控数据
onMounted(() => {
  setInterval(updateMonitorData, 1000);
  
  // 初始日志
  addLog('success', '测试页面加载完成');
  addLog('info', '开始监控状态机运行状态');
});
</script>

<style scoped>
.chat-test-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.page-header {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.page-subtitle {
  margin: 0 0 20px 0;
  color: #6b7280;
  font-size: 14px;
}

.test-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.endpoint-config {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.endpoint-config label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.endpoint-config input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.endpoint-config input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.update-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.update-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.preset-buttons {
  display: flex;
  gap: 8px;
}

.preset-btn {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #f3f4f6;
  transform: translateY(-1px);
}

.mock-btn { border-color: #f59e0b; color: #92400e; }
.local-btn { border-color: #10b981; color: #065f46; }
.prod-btn { border-color: #3b82f6; color: #1e40af; }

.layout-container {
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
}

.chat-section {
  flex: 3;
  min-width: 0;
}

.control-section {
  flex: 1;
  min-width: 300px;
  max-width: 400px;
}

.control-panel {
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.panel-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
}

.quick-tests {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.quick-test-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-test-btn:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.quick-test-btn.normal { background: #dbeafe; color: #1e40af; }
.quick-test-btn.thinking { background: #ede9fe; color: #5b21b6; }
.quick-test-btn.tool { background: #fef3c7; color: #92400e; }
.quick-test-btn.error { background: #fee2e2; color: #991b1b; }
.quick-test-btn.stream { background: #dcfce7; color: #065f46; }
.quick-test-btn.full { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }

.test-icon {
  font-size: 14px;
}

.state-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.event-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.event-btn {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  font-size: 11px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.event-btn:hover {
  background: #f3f4f6;
}

.event-btn.start { border-color: #3b82f6; color: #1e40af; }
.event-btn.think_start,
.event-btn.think,
.event-btn.think_end { border-color: #8b5cf6; color: #5b21b6; }
.event-btn.tool_start,
.event-btn.tool_end { border-color: #f59e0b; color: #92400e; }
.event-btn.text { border-color: #10b981; color: #065f46; }
.event-btn.end { border-color: #6b7280; color: #374151; }
.event-btn.error { border-color: #ef4444; color: #991b1b; }

.scenario-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.scenario-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.scenario-btn:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.scenario-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.scenario-text {
  font-size: 12px;
  color: #374151;
  text-align: center;
}

.monitor-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.monitor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #e5e7eb;
}

.monitor-item:last-child {
  border-bottom: none;
}

.monitor-label {
  font-size: 12px;
  color: #6b7280;
}

.monitor-value {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: white;
  border: 1px solid #d1d5db;
}

.monitor-value.idle { background: #d1fae5; border-color: #10b981; color: #065f46; }
.monitor-value.connecting { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
.monitor-value.streaming { background: #dbeafe; border-color: #3b82f6; color: #1e40af; }
.monitor-value.thinking { background: #ede9fe; border-color: #8b5cf6; color: #5b21b6; }
.monitor-value.tool_executing { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
.monitor-value.waiting_tool { background: #fed7aa; border-color: #f97316; color: #c2410c; }
.monitor-value.error { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
.monitor-value.completed { background: #d1fae5; border-color: #10b981; color: #065f46; }

.monitor-value.active { background: #d1fae5; border-color: #10b981; color: #065f46; }

.progress-monitor {
  margin-top: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.progress-label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: #6b7280;
  text-align: right;
}

.log-panel {
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
  height: 200px;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #111827;
  border-bottom: 1px solid #374151;
}

.log-header span {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
}

.clear-logs-btn {
  padding: 2px 8px;
  border: 1px solid #374151;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-logs-btn:hover {
  background: #374151;
  color: #e5e7eb;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.log-entry:hover {
  background: rgba(255, 255, 255, 0.05);
}

.log-entry.info { color: #e5e7eb; }
.log-entry.warn { color: #fbbf24; }
.log-entry.error { color: #ef4444; }
.log-entry.success { color: #10b981; }

.log-time {
  color: #9ca3af;
  min-width: 70px;
}

.log-level {
  min-width: 40px;
  text-align: center;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
}

.log-entry.info .log-level { background: rgba(59, 130, 246, 0.2); }
.log-entry.warn .log-level { background: rgba(251, 191, 36, 0.2); }
.log-entry.error .log-level { background: rgba(239, 68, 68, 0.2); }
.log-entry.success .log-level { background: rgba(16, 185, 129, 0.2); }

.log-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-footer {
  margin-top: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.footer-info {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.info-icon {
  font-size: 14px;
}

.footer-links {
  display: flex;
  gap: 16px;
}

.footer-link {
  font-size: 12px;
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #1e40af;
  text-decoration: underline;
}
</style>