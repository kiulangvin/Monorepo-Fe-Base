// 导出聊天组件
import Chat from './src/components/chat/Chat.vue';
import ChatBubble from './src/components/chat/ChatBubble.vue';
import ChatLoading from './src/components/chat/ChatLoading.vue';

// 组件列表
const components = {
  Chat,
  ChatBubble,
  ChatLoading,
};

// 导出组件安装函数
export function install(app: any) {
  Object.entries(components).forEach(([key, component]) => {
    app.component(key, component);
  });
}

// 导出所有组件
export {
  Chat,
  ChatBubble,
  ChatLoading,
};

// 导出默认安装函数
export default {
  install,
  ...components,
};