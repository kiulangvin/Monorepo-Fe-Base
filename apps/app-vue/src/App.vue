<template>
  <div class="app-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <h2>AI Chat Demo</h2>
        </div>
        <div class="version">v1.0.0</div>
      </div>
      
      <nav class="nav-menu">
        <router-link to="/" class="nav-item active">
          <span class="nav-icon">💬</span>
          <span class="nav-text">对话演示</span>
        </router-link>
      </nav>
    </div>
    <div class="main-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const currentTime = ref('');

const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  updateTime();
  const timer = setInterval(updateTime, 60000);
  
  onUnmounted(() => {
    clearInterval(timer);
  });
});
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  background: #f8fafc;
}

.sidebar {
  width: 240px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.version {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.nav-menu {
  flex: 1;
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border-left-color: white;
}

.nav-icon {
  font-size: 16px;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.connected {
  background: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>