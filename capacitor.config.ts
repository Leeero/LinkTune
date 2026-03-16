import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linktune.app',
  appName: 'LinkTune',
  webDir: 'dist',
  // Android 特定配置
  android: {
    // 允许混合内容（HTTP 和 HTTPS）- 部分音乐源可能使用 HTTP
    allowMixedContent: true,
    // 使用传统桥接模式以获得更好的兼容性
    useLegacyBridge: false,
    // WebView 调试（生产环境建议关闭）
    webContentsDebuggingEnabled: false,
  },
  // 服务器配置
  server: {
    // 允许加载本地资源
    androidScheme: 'https',
    // 清除缓存（开发时有用）
    cleartext: true,
  },
  // 插件配置
  plugins: {
    // 状态栏配置
    StatusBar: {
      style: 'dark',
      backgroundColor: '#141414',
    },
    // 键盘配置
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
