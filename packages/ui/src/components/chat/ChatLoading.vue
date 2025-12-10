<template>
  <div class="chat-loading">
    <div class="loading-avatar">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"></path>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </div>
    <div class="loading-content">
      <div class="loading-bubble">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
      <button v-if="showCancel" @click="onCancel" class="cancel-btn">
        取消
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  showCancel?: boolean;
}

interface Emits {
  (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
  showCancel: true,
});

const emit = defineEmits<Emits>();

const onCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
.chat-loading {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.loading-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: #10b981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.loading-bubble {
  padding: 12px 16px;
  background-color: #f3f4f6;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading-dot {
  width: 8px;
  height: 8px;
  background-color: #6b7280;
  border-radius: 50%;
  animation: loading-bounce 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes loading-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.cancel-btn {
  padding: 6px 12px;
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background-color: #e5e7eb;
  color: #374151;
}
</style>